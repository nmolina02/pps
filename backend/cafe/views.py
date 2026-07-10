from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from .models import Answer, Case, Participant, Question, QuizSession, SessionQuestion, Student, TeacherProfile, Topic
from .permissions import IsSessionHost
from .serializers import (
    CaseDetailSerializer,
    CaseListSerializer,
    CaseWriteSerializer,
    CreateSessionSerializer,
    JoinSessionSerializer,
    ParticipantSerializer,
    QuestionPublicSerializer,
    QuestionSerializer,
    QuestionWriteSerializer,
    QuizSessionSerializer,
    SessionQuestionSerializer,
    StudentPreferencesSerializer,
    StudentSerializer,
    SubmitAnswerSerializer,
    TeacherProfilePreferencesSerializer,
    TeacherProfileSerializer,
    TopicSerializer,
)
from .utils import generate_session_code


def _time_remaining(session_question):
    if not session_question.started_at:
        return None
    deadline = session_question.started_at + timezone.timedelta(
        seconds=session_question.duration_seconds
    )
    return max(0, round((deadline - timezone.now()).total_seconds()))


def _speed_factor(elapsed_seconds, duration_seconds):
    """1.0 si contestó al instante, decae linealmente hasta 0.5 justo en el límite
    (incluyendo el margen de gracia, que no otorga velocidad extra)."""
    if duration_seconds <= 0:
        return 1.0
    fraction = min(max(elapsed_seconds / duration_seconds, 0.0), 1.0)
    return 1.0 - (fraction / 2)


def _leaderboard(session):
    participants = (
        session.participants.select_related('student')
        .annotate(total_score=Sum('answers__score'))
        .order_by('-total_score', 'student__full_name')
    )
    return [
        {
            'legajo': p.student.legajo,
            'full_name': p.student.full_name,
            'total_score': p.total_score or 0,
        }
        for p in participants
    ]


def _tally(session_question):
    question = session_question.question
    if question.question_type == Question.Type.FILL_BLANK:
        rows = (
            session_question.answers.values('free_text')
            .annotate(votes=Count('id'))
            .order_by('-votes')
        )
        return [{'text': row['free_text'], 'votes': row['votes']} for row in rows]
    return list(
        question.options.annotate(
            votes=Count('answer', filter=Q(answer__session_question=session_question))
        ).values('id', 'text', 'votes')
    )


def _current_question(session):
    return session.session_questions.filter(started_at__isnull=False).order_by('-order').first()


def _host_state_payload(session):
    current = _current_question(session)
    payload = {
        'session': QuizSessionSerializer(session).data,
        'participant_count': session.participants.count(),
        'leaderboard': _leaderboard(session),
        'current_question': None,
    }
    if current:
        payload['current_question'] = {
            'order': current.order,
            'points': current.points,
            'duration_seconds': current.duration_seconds,
            'time_remaining_seconds': _time_remaining(current),
            'accepts_answers': current.accepts_answers,
            'revealed': current.revealed_at is not None,
            'answers_received': current.answers.count(),
            'question': QuestionSerializer(current.question).data,
            'tally': _tally(current),
        }
    return payload


class TopicListView(generics.ListAPIView):
    queryset = Topic.objects.all()
    serializer_class = TopicSerializer
    pagination_class = None


class CaseListView(generics.ListAPIView):
    serializer_class = CaseListSerializer

    def get_queryset(self):
        qs = Case.objects.select_related('topic').order_by('topic__name', 'title')
        topic_slug = self.request.query_params.get('topic')
        if topic_slug:
            qs = qs.filter(topic__slug=topic_slug)
        return qs


class CaseDetailView(generics.RetrieveAPIView):
    serializer_class = CaseDetailSerializer
    lookup_field = 'slug'
    queryset = Case.objects.select_related('topic').prefetch_related('questions__options')


class QuestionListView(generics.ListAPIView):
    """Banco de preguntas, filtrable por topic — lo usa el docente para armar una sesión."""

    serializer_class = QuestionSerializer

    def get_queryset(self):
        qs = Question.objects.select_related('topic', 'case').prefetch_related('options').order_by('id')
        topic_slug = self.request.query_params.get('topic')
        if topic_slug:
            qs = qs.filter(topic__slug=topic_slug)
        return qs


class CreateSessionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        question_ids = [item['question_id'] for item in data['questions']]
        questions_by_id = {
            q.id: q
            for q in Question.objects.filter(id__in=question_ids, topic_id=data['topic_id'])
        }
        if len(questions_by_id) != len(set(question_ids)):
            return Response(
                {
                    'error': {
                        'code': 'invalid_questions',
                        'message': 'Alguna pregunta no existe o no pertenece al topic indicado.',
                        'details': {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = QuizSession.objects.create(
            code=generate_session_code(), topic_id=data['topic_id'], host=request.user
        )
        SessionQuestion.objects.bulk_create(
            [
                SessionQuestion(
                    session=session,
                    question=questions_by_id[item['question_id']],
                    order=index + 1,
                    points=item['points'],
                    duration_seconds=item['duration_seconds'],
                    grace_seconds=item['grace_seconds'],
                )
                for index, item in enumerate(data['questions'])
            ]
        )
        return Response(QuizSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class JoinSessionView(views.APIView):
    def post(self, request, code):
        session = get_object_or_404(QuizSession, code=code)
        serializer = JoinSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = Student.objects.filter(legajo=serializer.validated_data['legajo']).first()
        if student is None:
            return Response(
                {
                    'error': {
                        'code': 'legajo_not_found',
                        'message': 'Ese legajo no está registrado. Pedile al docente que cargue tu perfil.',
                        'details': {},
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        participant, _created = Participant.objects.get_or_create(session=session, student=student)
        return Response(ParticipantSerializer(participant).data, status=status.HTTP_200_OK)


class StartQuestionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def post(self, request, code, order):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        session_question = get_object_or_404(SessionQuestion, session=session, order=order)

        session_question.started_at = timezone.now()
        session_question.revealed_at = None
        session_question.save(update_fields=['started_at', 'revealed_at'])

        if session.status != QuizSession.Status.ACTIVE:
            session.status = QuizSession.Status.ACTIVE
            session.save(update_fields=['status'])

        return Response(_host_state_payload(session))


class RevealQuestionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def post(self, request, code, order):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        session_question = get_object_or_404(SessionQuestion, session=session, order=order)

        session_question.revealed_at = timezone.now()
        session_question.save(update_fields=['revealed_at'])

        return Response(_host_state_payload(session))


class FinishSessionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def post(self, request, code):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        session.status = QuizSession.Status.FINISHED
        session.save(update_fields=['status'])
        return Response(QuizSessionSerializer(session).data)


class SessionHostStateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def get(self, request, code):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        return Response(_host_state_payload(session))


class SessionQuestionListView(views.APIView):
    """Lista ordenada de las preguntas de una sesión con su progreso (started_at/
    revealed_at), para que el dashboard del docente sepa qué sigue sin adivinarlo."""

    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def get(self, request, code):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        questions = (
            session.session_questions.select_related('question')
            .prefetch_related('question__options')
            .order_by('order')
        )
        return Response(SessionQuestionSerializer(questions, many=True).data)


class SessionStudentStateView(views.APIView):
    def get(self, request, code):
        session = get_object_or_404(QuizSession, code=code)

        participant = None
        participant_id = request.query_params.get('participant_id')
        if participant_id:
            participant = Participant.objects.filter(id=participant_id, session=session).first()

        current = _current_question(session)
        payload = {'session': QuizSessionSerializer(session).data, 'current_question': None}

        if current:
            has_answered = bool(
                participant
                and Answer.objects.filter(
                    participant=participant, session_question=current
                ).exists()
            )
            question_payload = {
                'order': current.order,
                'points': current.points,
                'duration_seconds': current.duration_seconds,
                'time_remaining_seconds': _time_remaining(current),
                'accepts_answers': current.accepts_answers,
                'has_answered': has_answered,
                'revealed': current.revealed_at is not None,
                'question': QuestionPublicSerializer(current.question).data,
            }
            if current.revealed_at is not None:
                question_payload['tally'] = _tally(current)
                question_payload['correct_option_ids'] = list(
                    current.question.options.filter(is_correct=True).values_list('id', flat=True)
                )
                question_payload['justification'] = current.question.justification
            payload['current_question'] = question_payload

        return Response(payload)


class SubmitAnswerView(views.APIView):
    def post(self, request, code, order):
        session = get_object_or_404(QuizSession, code=code)
        session_question = get_object_or_404(
            SessionQuestion.objects.select_related('question'), session=session, order=order
        )
        serializer = SubmitAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        participant = get_object_or_404(Participant, id=data['participant_id'], session=session)

        if not session_question.accepts_answers:
            return Response(
                {
                    'error': {
                        'code': 'deadline_passed',
                        'message': 'El tiempo para responder esta pregunta ya venció.',
                        'details': {},
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if Answer.objects.filter(participant=participant, session_question=session_question).exists():
            return Response(
                {
                    'error': {
                        'code': 'already_answered',
                        'message': 'Ya respondiste esta pregunta.',
                        'details': {},
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        question = session_question.question
        option_ids = data['option_ids']
        if option_ids:
            valid_ids = set(question.options.values_list('id', flat=True))
            if not set(option_ids).issubset(valid_ids):
                return Response(
                    {
                        'error': {
                            'code': 'invalid_option',
                            'message': 'Alguna opción no pertenece a esta pregunta.',
                            'details': {},
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        elapsed_seconds = (timezone.now() - session_question.started_at).total_seconds()
        ratio = question.score_ratio(option_ids=option_ids, free_text=data['free_text'])
        speed_factor = _speed_factor(elapsed_seconds, session_question.duration_seconds)
        earned_points = round(session_question.points * ratio * speed_factor)

        answer = Answer.objects.create(
            participant=participant,
            session_question=session_question,
            free_text=data['free_text'],
            is_correct=ratio >= 1.0,
            score=earned_points,
            response_seconds=elapsed_seconds,
        )
        if option_ids:
            answer.selected_options.set(option_ids)

        return Response(
            {'is_correct': answer.is_correct, 'score': earned_points},
            status=status.HTTP_201_CREATED,
        )


class StudentProfileView(views.APIView):
    """Lookup público por legajo (sin contraseña, según lo definido para el login de
    alumnos). GET devuelve legajo + nombre asignado por el docente vía CSV + las
    preferencias de UX guardadas — nunca puntajes ni historial, eso queda detrás de
    StudentHistoryView (docente-only). PATCH solo permite tocar avatar/theme: legajo
    y full_name son de solo lectura acá, los carga el docente."""

    def get(self, request, legajo):
        student = get_object_or_404(Student, legajo=legajo)
        return Response(StudentSerializer(student).data)

    def patch(self, request, legajo):
        student = get_object_or_404(Student, legajo=legajo)
        serializer = StudentPreferencesSerializer(student, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StudentSerializer(student).data)


class StudentHistoryView(views.APIView):
    """Historial de un alumno a través de todas las sesiones en las que participó,
    con el puntaje acumulado por cuestionario y el total across-sessions."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, legajo):
        student = get_object_or_404(Student, legajo=legajo)
        participations = (
            student.participations.select_related('session', 'session__topic')
            .annotate(
                session_score=Sum('answers__score'),
                questions_answered=Count('answers'),
            )
            .order_by('-session__created_at')
        )

        sessions = [
            {
                'session_code': p.session.code,
                'topic': TopicSerializer(p.session.topic).data,
                'status': p.session.status,
                'created_at': p.session.created_at,
                'questions_answered': p.questions_answered,
                'score': p.session_score or 0,
            }
            for p in participations
        ]

        return Response(
            {
                'student': StudentSerializer(student).data,
                'total_score': sum(s['score'] for s in sessions),
                'sessions': sessions,
            }
        )


class QuestionCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = QuestionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        return Response(QuestionSerializer(question).data, status=status.HTTP_201_CREATED)


class QuestionUpdateView(views.APIView):
    """A diferencia de Case, no hay endpoint público por id (solo listado
    filtrado por topic), así que acá sí hace falta el GET para precargar
    el form de edición del docente."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        return Response(QuestionSerializer(question).data)

    def patch(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        serializer = QuestionWriteSerializer(question, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        return Response(QuestionSerializer(question).data)


class TeacherProfileView(views.APIView):
    """Preferencias de UI del docente logueado (avatar/tema), análogo a
    StudentProfileView pero atado a request.user en vez de a un legajo público."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _created = TeacherProfile.objects.get_or_create(user=request.user)
        return Response(TeacherProfileSerializer(profile).data)

    def patch(self, request):
        profile, _created = TeacherProfile.objects.get_or_create(user=request.user)
        serializer = TeacherProfilePreferencesSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(TeacherProfileSerializer(profile).data)


class CaseCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CaseWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        return Response(CaseDetailSerializer(case).data, status=status.HTTP_201_CREATED)


class CaseUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, slug):
        case = get_object_or_404(Case, slug=slug)
        serializer = CaseWriteSerializer(case, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        return Response(CaseDetailSerializer(case).data)


class StudentLeaderboardView(views.APIView):
    """Ranking de todos los alumnos por puntaje acumulado a través de todos los
    cuestionarios en los que participaron (histórico, no una sesión puntual)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        students = Student.objects.annotate(
            total_score=Sum('participations__answers__score'),
            sessions_played=Count('participations', distinct=True),
        ).order_by('-total_score', 'full_name')

        return Response(
            [
                {
                    'legajo': s.legajo,
                    'full_name': s.full_name,
                    'total_score': s.total_score or 0,
                    'sessions_played': s.sessions_played,
                }
                for s in students
            ]
        )
