from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .models import Case, CaseGraphic, Participant, Question, QuestionOption, Quiz, QuizSession, SessionQuestion, Student, TeacherProfile, Topic

User = get_user_model()


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['id', 'name', 'slug']


class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['id', 'text', 'image', 'is_correct']


class QuestionOptionPublicSerializer(serializers.ModelSerializer):
    """Igual que QuestionOptionSerializer pero sin revelar cuál es la correcta."""

    class Meta:
        model = QuestionOption
        fields = ['id', 'text', 'image']


class QuestionSerializer(serializers.ModelSerializer):
    """Vista completa (modo exploración async de un caso): incluye respuesta y justificación."""

    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'image', 'question_type', 'options', 'justification', 'conceptual_error']


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Vista para el alumno durante una sesión en vivo, antes del reveal: sin respuesta correcta."""

    options = QuestionOptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'image', 'question_type', 'options']


class CaseListSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)

    class Meta:
        model = Case
        fields = ['id', 'slug', 'title', 'topic']


class CaseGraphicSerializer(serializers.ModelSerializer):
    """El gráfico de un caso, con identidad propia (id) y su Topic — el tipo
    de diagrama no se persiste: el frontend lo matchea por la forma de `data`."""

    topic = TopicSerializer(read_only=True)

    class Meta:
        model = CaseGraphic
        fields = ['id', 'topic', 'data']


class CaseDetailSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)
    graphic = serializers.SerializerMethodField()
    author = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = Case
        fields = [
            'id', 'slug', 'title', 'topic', 'author', 'scenario', 'guiding_questions',
            'theory', 'graphic', 'questions',
        ]

    def get_graphic(self, obj):
        graphic = getattr(obj, 'graphic', None)
        return CaseGraphicSerializer(graphic).data if graphic else None


class CaseWriteSerializer(serializers.ModelSerializer):
    """Alta/edición de un caso por el docente. El slug se genera del título y
    nunca se reasigna en un update, para no romper links ya compartidos.
    `graphic_data` es el JSON crudo del gráfico — vive en su propia fila
    (CaseGraphic, uno a uno con el Case, mismo Topic), no elige tipo el
    docente: se matchea por forma en el frontend."""

    graphic_data = serializers.JSONField(required=False, allow_null=True, default=None)

    class Meta:
        model = Case
        fields = [
            'id', 'slug', 'topic', 'title', 'scenario', 'guiding_questions',
            'theory', 'graphic_data',
        ]
        read_only_fields = ['id', 'slug']

    def create(self, validated_data):
        graphic_data = validated_data.pop('graphic_data', None)
        validated_data['slug'] = self._unique_slug(validated_data['title'])
        case = super().create(validated_data)
        CaseGraphic.objects.create(case=case, topic=case.topic, data=graphic_data)
        return case

    def update(self, instance, validated_data):
        has_graphic_data = 'graphic_data' in validated_data
        graphic_data = validated_data.pop('graphic_data', None)
        case = super().update(instance, validated_data)
        graphic, _created = CaseGraphic.objects.get_or_create(case=case, defaults={'topic': case.topic})
        update_fields = []
        if graphic.topic_id != case.topic_id:
            graphic.topic = case.topic
            update_fields.append('topic')
        if has_graphic_data:
            graphic.data = graphic_data
            update_fields.append('data')
        if update_fields:
            graphic.save(update_fields=update_fields)
        return case

    @staticmethod
    def _unique_slug(title):
        base = slugify(title)
        slug = base
        suffix = 2
        while Case.objects.filter(slug=slug).exists():
            slug = f'{base}-{suffix}'
            suffix += 1
        return slug


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'legajo', 'full_name', 'avatar', 'theme']


class StudentPreferencesSerializer(serializers.ModelSerializer):
    """Único subconjunto de campos que un alumno puede tocar de su propio perfil
    (sin auth, solo por legajo) — legajo y full_name los carga exclusivamente el docente."""

    class Meta:
        model = Student
        fields = ['avatar', 'theme']

    def validate_avatar(self, value):
        if not 0 <= value <= 7:
            raise serializers.ValidationError('El avatar debe estar entre 0 y 7.')
        return value


class TeacherProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = TeacherProfile
        fields = ['username', 'avatar', 'theme']


class TeacherProfilePreferencesSerializer(serializers.ModelSerializer):
    """Único subconjunto de campos que el docente puede tocar de su propio
    perfil de UI (avatar/tema) — mismo esquema que StudentPreferencesSerializer."""

    class Meta:
        model = TeacherProfile
        fields = ['avatar', 'theme']

    def validate_avatar(self, value):
        if not 0 <= value <= 7:
            raise serializers.ValidationError('El avatar debe estar entre 0 y 7.')
        return value


class ParticipantSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)

    class Meta:
        model = Participant
        fields = ['id', 'student', 'joined_at']


class JoinSessionSerializer(serializers.Serializer):
    legajo = serializers.CharField(min_length=1, max_length=20)


class SessionQuestionOptionSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    image = serializers.CharField(required=False, allow_blank=True, default='')
    is_correct = serializers.BooleanField(default=False)


class CreateSessionQuestionSerializer(serializers.Serializer):
    """Una pregunta escrita ahí mismo al armar el cuestionario — no elegida de
    un banco: nace y vive dentro de esta sesión puntual, sin `case` ni
    `conceptual_error` (eso es de la evaluación de casos, otra funcionalidad)."""

    text = serializers.CharField()
    image = serializers.CharField(required=False, allow_blank=True, default='')
    question_type = serializers.ChoiceField(choices=Question.Type.choices)
    justification = serializers.CharField(required=False, allow_blank=True, default='')
    options = SessionQuestionOptionSerializer(many=True)
    points = serializers.IntegerField(min_value=0, max_value=10000, default=100)
    duration_seconds = serializers.IntegerField(min_value=5, max_value=300, default=20)
    grace_seconds = serializers.IntegerField(min_value=0, max_value=30, default=2)

    def validate(self, attrs):
        question_type = attrs['question_type']
        is_fill_blank = question_type == Question.Type.FILL_BLANK
        is_survey = question_type == Question.Type.SURVEY
        options = attrs['options']

        min_options = 1 if is_fill_blank else 2
        if len(options) < min_options:
            raise serializers.ValidationError({'options': f'Se necesitan al menos {min_options} opción(es).'})

        if is_survey:
            for o in options:
                if not o['text'].strip() and not o['image'].strip():
                    raise serializers.ValidationError({'options': 'Cada opción de una encuesta necesita texto o imagen.'})
            return attrs

        if not attrs['justification'].strip():
            raise serializers.ValidationError({'justification': 'Este tipo de pregunta necesita una justificación.'})

        for o in options:
            if not o['text'].strip():
                raise serializers.ValidationError({'options': 'Cada opción necesita texto.'})

        if not is_fill_blank:
            correct_count = sum(1 for o in options if o['is_correct'])
            if question_type == Question.Type.SINGLE_CHOICE and correct_count != 1:
                raise serializers.ValidationError(
                    {'options': 'Opción única necesita exactamente una opción correcta.'}
                )
            if question_type == Question.Type.MULTIPLE_CHOICE and correct_count < 1:
                raise serializers.ValidationError(
                    {'options': 'Opción múltiple necesita al menos una opción correcta.'}
                )
        return attrs


class QuizWriteSerializer(serializers.Serializer):
    """Alta/edición de un cuestionario persistido: título + con qué docentes
    puntuales se comparte (por username, no todo-o-nada) + sus preguntas
    (nacen atadas a este Quiz, ver CreateSessionQuestionSerializer). Sin
    Topic — un cuestionario se arma por unidad de clase, no por tema. En una
    edición, `questions` reemplaza por completo las anteriores."""

    title = serializers.CharField(max_length=200)
    shared_with_usernames = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    questions = CreateSessionQuestionSerializer(many=True)

    def validate_questions(self, value):
        if not value:
            raise serializers.ValidationError('El cuestionario necesita al menos una pregunta.')
        return value

    def validate_shared_with_usernames(self, value):
        usernames = [u.strip() for u in value if u.strip()]
        existing = set(User.objects.filter(username__in=usernames).values_list('username', flat=True))
        missing = sorted(set(usernames) - existing)
        if missing:
            raise serializers.ValidationError(f'Usuario(s) inexistente(s): {", ".join(missing)}.')
        return usernames


class QuizSerializer(serializers.ModelSerializer):
    host = serializers.CharField(source='host.username', read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    shared_with = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'host', 'shared_with', 'question_count', 'created_at']

    def get_shared_with(self, obj):
        return list(obj.shared_with.values_list('username', flat=True))


class QuizQuestionDetailSerializer(serializers.ModelSerializer):
    """Una pregunta de un Quiz con su respuesta completa, para precargar el
    form de edición — mismo shape que la escritura (CreateSessionQuestionSerializer)
    más `id`/`order` de solo lectura."""

    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'order', 'text', 'image', 'question_type', 'justification', 'options',
            'points', 'duration_seconds', 'grace_seconds',
        ]


class QuizDetailSerializer(serializers.ModelSerializer):
    """Detalle de un Quiz para el form de edición — docente-only (dueño),
    a diferencia de QuizSerializer incluye las preguntas completas."""

    host = serializers.CharField(source='host.username', read_only=True)
    shared_with = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'host', 'shared_with', 'questions', 'created_at']

    def get_shared_with(self, obj):
        return list(obj.shared_with.values_list('username', flat=True))

    def get_questions(self, obj):
        return QuizQuestionDetailSerializer(obj.questions.order_by('order'), many=True).data


class QuizSessionSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source='quiz.title', read_only=True, default=None)

    class Meta:
        model = QuizSession
        fields = ['id', 'code', 'quiz_title', 'status', 'created_at']


class SessionQuestionSerializer(serializers.ModelSerializer):
    """Vista docente-only de una pregunta dentro de una sesión: pregunta completa
    (con respuesta) + su estado de progreso (arrancada/revelada o no)."""

    question = QuestionSerializer(read_only=True)

    class Meta:
        model = SessionQuestion
        fields = ['order', 'points', 'duration_seconds', 'grace_seconds', 'started_at', 'revealed_at', 'question']


class SubmitAnswerSerializer(serializers.Serializer):
    participant_id = serializers.IntegerField()
    option_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    free_text = serializers.CharField(required=False, allow_blank=True, default='')
