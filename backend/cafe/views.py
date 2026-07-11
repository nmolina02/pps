from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from .models import Answer, Case, Participant, Question, QuestionOption, Quiz, QuizSession, SessionQuestion, Student, TeacherProfile, Topic
from .permissions import IsSessionHost
from .serializers import (
    CaseDetailSerializer,
    CaseListSerializer,
    CaseWriteSerializer,
    JoinSessionSerializer,
    ParticipantSerializer,
    QuestionPublicSerializer,
    QuestionSerializer,
    QuizDetailSerializer,
    QuizSerializer,
    QuizSessionSerializer,
    QuizWriteSerializer,
    SessionQuestionSerializer,
    StudentPreferencesSerializer,
    StudentSerializer,
    SubmitAnswerSerializer,
    TeacherProfilePreferencesSerializer,
    TeacherProfileSerializer,
    TopicSerializer,
)
from .utils import generate_session_code

User = get_user_model()


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
    participants = session.participants.select_related('student').order_by('-total_score', 'student__full_name')
    return [
        {
            'legajo': p.student.legajo,
            'full_name': p.student.full_name,
            'total_score': p.total_score,
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
    return session.session_questions.filter(started_at__isnull=False).order_by('-question__order').first()


def _create_quiz_questions(quiz, topic_id, questions_data):
    """Crea las Question/QuestionOption de un Quiz a partir de la data ya
    validada por CreateSessionQuestionSerializer — usado tanto al crear como
    al editar (donde las preguntas anteriores ya se borraron antes de llamar
    esto)."""
    for index, item in enumerate(questions_data):
        question = Question.objects.create(
            topic_id=topic_id,
            quiz=quiz,
            order=index + 1,
            text=item['text'],
            question_type=item['question_type'],
            justification=item['justification'],
            points=item['points'],
            duration_seconds=item['duration_seconds'],
            grace_seconds=item['grace_seconds'],
        )
        is_fill_blank = item['question_type'] == Question.Type.FILL_BLANK
        QuestionOption.objects.bulk_create(
            [
                QuestionOption(
                    question=question,
                    text=o['text'],
                    is_correct=True if is_fill_blank else o['is_correct'],
                )
                for o in item['options']
            ]
        )


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


class QuizListCreateView(views.APIView):
    """Cuestionarios persistidos: propios + los que otros docentes marcaron
    como compartidos. `post` arma uno nuevo escribiendo las preguntas ahí
    mismo (no se eligen de un banco), quedan atadas a este Quiz."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        quizzes = (
            Quiz.objects.select_related('topic', 'host')
            .annotate(question_count=Count('questions'))
            .filter(Q(host=request.user) | Q(shared_with=request.user))
            .distinct()
            .order_by('-created_at')
        )
        return Response(QuizSerializer(quizzes, many=True).data)

    def post(self, request):
        serializer = QuizWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        shared_users = User.objects.filter(username__in=data['shared_with_usernames'])

        with transaction.atomic():
            quiz = Quiz.objects.create(topic_id=data['topic_id'], host=request.user, title=data['title'])
            quiz.shared_with.set(shared_users)
            _create_quiz_questions(quiz, data['topic_id'], data['questions'])

        quiz.question_count = len(data['questions'])
        return Response(QuizSerializer(quiz).data, status=status.HTTP_201_CREATED)


class QuizDetailView(views.APIView):
    """Detalle/edición/borrado de un cuestionario — solo quien lo creó puede
    verlo acá, editarlo o eliminarlo (los docentes con los que se compartió
    solo pueden listarlo y arrancar sesiones, ver QuizListCreateView/
    QuizStartView). Eliminar borra en cascada sus sesiones jugadas y el
    historial de puntajes asociado — decisión explícita para mantener esto
    simple."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk, host=request.user)
        return Response(QuizDetailSerializer(quiz).data)

    def patch(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk, host=request.user)
        serializer = QuizWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        shared_users = User.objects.filter(username__in=data['shared_with_usernames'])

        with transaction.atomic():
            quiz.title = data['title']
            quiz.topic_id = data['topic_id']
            quiz.save(update_fields=['title', 'topic'])
            quiz.shared_with.set(shared_users)
            quiz.questions.all().delete()
            _create_quiz_questions(quiz, data['topic_id'], data['questions'])

        quiz.question_count = len(data['questions'])
        return Response(QuizSerializer(quiz).data)

    def delete(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk, host=request.user)
        quiz.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuizStartView(views.APIView):
    """Arranca una corrida en vivo nueva de un cuestionario ya persistido —
    esto es lo que permite reutilizarlo cuatrimestre a cuatrimestre sin
    reescribir las preguntas."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz.objects.filter(Q(host=request.user) | Q(shared_with=request.user)), pk=pk)

        with transaction.atomic():
            session = QuizSession.objects.create(
                code=generate_session_code(), quiz=quiz, topic_id=quiz.topic_id, host=request.user
            )
            SessionQuestion.objects.bulk_create(
                [SessionQuestion(session=session, question=q) for q in quiz.questions.order_by('order')]
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
        session_question = get_object_or_404(SessionQuestion, session=session, question__order=order)

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
        session_question = get_object_or_404(SessionQuestion, session=session, question__order=order)

        session_question.revealed_at = timezone.now()
        session_question.save(update_fields=['revealed_at'])

        return Response(_host_state_payload(session))


class FinishSessionView(views.APIView):
    """Al finalizar se descarta el detalle de respuesta por pregunta
    (Answer) — el puntaje total por participante ya quedó persistido en
    Participant.total_score (se incrementa en vivo en SubmitAnswerView), así
    que el leaderboard/historial no pierde nada, pero no queda para siempre
    quién marcó qué opción en cada pregunta de cada sesión jugada."""

    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def post(self, request, code):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        session.status = QuizSession.Status.FINISHED
        session.save(update_fields=['status'])
        Answer.objects.filter(session_question__session=session).delete()
        return Response(QuizSessionSerializer(session).data)


class CancelSessionView(views.APIView):
    """Cancela una sesión iniciada por error o de la que el docente se
    arrepiente — a diferencia de finalizar, acá no se guarda nada: se borra
    la sesión entera (participantes, respuestas, progreso) en cascada."""

    permission_classes = [permissions.IsAuthenticated, IsSessionHost]

    def post(self, request, code):
        session = get_object_or_404(QuizSession, code=code)
        self.check_object_permissions(request, session)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
            .order_by('question__order')
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
                own_answer = (
                    Answer.objects.filter(participant=participant, session_question=current).first()
                    if participant
                    else None
                )
                if own_answer:
                    question_payload['your_result'] = {
                        'is_correct': own_answer.is_correct,
                        'score': own_answer.score,
                    }
            payload['current_question'] = question_payload

        return Response(payload)


class SubmitAnswerView(views.APIView):
    def post(self, request, code, order):
        session = get_object_or_404(QuizSession, code=code)
        session_question = get_object_or_404(
            SessionQuestion.objects.select_related('question'), session=session, question__order=order
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

        # Se incrementa en vivo (no se recalcula sumando Answer más tarde)
        # porque las Answer se purgan al finalizar la sesión — este campo
        # es la única fuente de verdad del leaderboard/historial después.
        participant.total_score = F('total_score') + earned_points
        participant.save(update_fields=['total_score'])

        # No devolvemos is_correct/score acá: el puntaje ya queda calculado y
        # guardado, pero el alumno no se entera de si acertó hasta que el
        # docente revele la pregunta (SessionStudentStateView es quien lo
        # expone, y solo una vez revealed_at está seteado).
        return Response({'submitted': True}, status=status.HTTP_201_CREATED)


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
    """Historial de un alumno a través de todas las sesiones en las que
    participó, con el puntaje total por sesión (Participant.total_score,
    no el detalle de qué contestó en cada pregunta — eso no se persiste)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, legajo):
        student = get_object_or_404(Student, legajo=legajo)
        participations = (
            student.participations.select_related('session', 'session__topic')
            .order_by('-session__created_at')
        )

        sessions = [
            {
                'session_code': p.session.code,
                'topic': TopicSerializer(p.session.topic).data,
                'status': p.session.status,
                'created_at': p.session.created_at,
                'score': p.total_score,
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
            total_score=Sum('participations__total_score'),
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


class QuizLeaderboardView(views.APIView):
    """Ranking histórico de un cuestionario puntual, sumando el
    Participant.total_score de todas las sesiones jugadas de ese Quiz (sin
    importar qué docente las arrancó, mientras tenga acceso al Quiz). Si se
    usó 'limpiar puntaje acumulado' sobre esas sesiones, esos Participant ya
    no existen y no aparecen acá — por eso puede devolver vacío aunque el
    cuestionario se haya jugado antes."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        quiz = get_object_or_404(Quiz.objects.filter(Q(host=request.user) | Q(shared_with=request.user)), pk=pk)
        rows = (
            Participant.objects.filter(session__quiz=quiz)
            .values('student__legajo', 'student__full_name')
            .annotate(total_score=Sum('total_score'), sessions_played=Count('id'))
            .order_by('-total_score', 'student__full_name')
        )
        return Response(
            [
                {
                    'legajo': row['student__legajo'],
                    'full_name': row['student__full_name'],
                    'total_score': row['total_score'] or 0,
                    'sessions_played': row['sessions_played'],
                }
                for row in rows
            ]
        )


class ClearMyHistoryView(views.APIView):
    """Limpia el puntaje acumulado por los jugadores en las sesiones que ESTE
    docente arrancó (propias o de un Quiz compartido por otro), acotado a
    los cuestionarios puntuales que elija en `quiz_ids` — dropea los
    Participant (donde vive total_score, y en cascada cualquier Answer que
    quedara de una sesión todavía no finalizada), no las QuizSession en sí:
    el historial de qué cuestionario se corrió cuándo se mantiene, solo se
    resetea el puntaje. No toca sesiones de otros docentes ni los Quiz
    persistidos."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        quiz_ids = request.data.get('quiz_ids')
        if not isinstance(quiz_ids, list) or not quiz_ids:
            return Response(
                {
                    'error': {
                        'code': 'quiz_ids_required',
                        'message': 'Elegí al menos un cuestionario para limpiar.',
                        'details': {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        participants = Participant.objects.filter(session__host=request.user, session__quiz_id__in=quiz_ids)
        deleted_participants = participants.count()
        participants.delete()
        return Response({'deleted_participants': deleted_participants})
