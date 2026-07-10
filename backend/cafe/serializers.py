from django.utils.text import slugify
from rest_framework import serializers

from .models import Case, Participant, Question, QuestionOption, QuizSession, SessionQuestion, Student, TeacherProfile, Topic


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['id', 'name', 'slug']


class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['id', 'text', 'is_correct']


class QuestionOptionPublicSerializer(serializers.ModelSerializer):
    """Igual que QuestionOptionSerializer pero sin revelar cuál es la correcta."""

    class Meta:
        model = QuestionOption
        fields = ['id', 'text']


class QuestionSerializer(serializers.ModelSerializer):
    """Vista completa (modo exploración async de un caso, banco docente): incluye
    respuesta y justificación. `topic`/`case` van como id crudo — alcanza para
    que el form de edición del docente sepa qué preseleccionar."""

    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'topic', 'case', 'text', 'question_type', 'options', 'justification', 'conceptual_error']


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Vista para el alumno durante una sesión en vivo, antes del reveal: sin respuesta correcta."""

    options = QuestionOptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'question_type', 'options']


class QuestionOptionWriteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=255)
    is_correct = serializers.BooleanField(default=False)


class QuestionWriteSerializer(serializers.ModelSerializer):
    """Alta/edición de una pregunta del banco por el docente, con sus opciones.
    En un update, si vienen `options` se reemplazan por completo — más simple
    que diffear por id y suficiente porque no hay respuestas históricas que
    referencien una QuestionOption puntual fuera de una sesión ya jugada."""

    options = QuestionOptionWriteSerializer(many=True)

    class Meta:
        model = Question
        fields = ['id', 'topic', 'case', 'text', 'question_type', 'justification', 'conceptual_error', 'options']
        read_only_fields = ['id']

    def validate(self, attrs):
        question_type = attrs.get('question_type') or getattr(self.instance, 'question_type', None)
        options = attrs.get('options')
        if options is not None:
            self._validate_options(question_type, options)
        return attrs

    @staticmethod
    def _validate_options(question_type, options):
        is_fill_blank = question_type == Question.Type.FILL_BLANK
        min_options = 1 if is_fill_blank else 2
        if len(options) < min_options:
            raise serializers.ValidationError(
                {'options': f'Se necesitan al menos {min_options} opción(es).'}
            )
        if is_fill_blank:
            return
        correct_count = sum(1 for o in options if o['is_correct'])
        if question_type == Question.Type.SINGLE_CHOICE and correct_count != 1:
            raise serializers.ValidationError(
                {'options': 'Opción única necesita exactamente una opción correcta.'}
            )
        if question_type == Question.Type.MULTIPLE_CHOICE and correct_count < 1:
            raise serializers.ValidationError(
                {'options': 'Opción múltiple necesita al menos una opción correcta.'}
            )

    def create(self, validated_data):
        options = validated_data.pop('options')
        question = Question.objects.create(**validated_data)
        self._save_options(question, options)
        return question

    def update(self, instance, validated_data):
        options = validated_data.pop('options', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if options is not None:
            instance.options.all().delete()
            self._save_options(instance, options)
        return instance

    @staticmethod
    def _save_options(question, options):
        # Para fill_blank cada opción es una "respuesta aceptada": se guarda
        # siempre como correcta, el docente no marca nada en el form.
        is_fill_blank = question.question_type == Question.Type.FILL_BLANK
        QuestionOption.objects.bulk_create(
            [
                QuestionOption(
                    question=question,
                    text=o['text'],
                    is_correct=True if is_fill_blank else o['is_correct'],
                )
                for o in options
            ]
        )


class CaseListSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)

    class Meta:
        model = Case
        fields = ['id', 'slug', 'title', 'topic', 'visual_model']


class CaseDetailSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Case
        fields = [
            'id', 'slug', 'title', 'topic', 'scenario', 'guiding_questions',
            'theory', 'visual_model', 'visual_model_data', 'questions',
        ]


class CaseWriteSerializer(serializers.ModelSerializer):
    """Alta/edición de un caso por el docente. El slug se genera del título y
    nunca se reasigna en un update, para no romper links ya compartidos."""

    class Meta:
        model = Case
        fields = [
            'id', 'slug', 'topic', 'title', 'scenario', 'guiding_questions',
            'theory', 'visual_model', 'visual_model_data',
        ]
        read_only_fields = ['id', 'slug']

    def create(self, validated_data):
        validated_data['slug'] = self._unique_slug(validated_data['title'])
        return super().create(validated_data)

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


class CreateSessionQuestionSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    points = serializers.IntegerField(min_value=0, max_value=10000, default=100)
    duration_seconds = serializers.IntegerField(min_value=5, max_value=300, default=20)
    grace_seconds = serializers.IntegerField(min_value=0, max_value=30, default=2)


class CreateSessionSerializer(serializers.Serializer):
    topic_id = serializers.IntegerField()
    questions = CreateSessionQuestionSerializer(many=True)

    def validate_topic_id(self, value):
        if not Topic.objects.filter(id=value).exists():
            raise serializers.ValidationError('Topic inexistente.')
        return value

    def validate_questions(self, value):
        if not value:
            raise serializers.ValidationError('La sesión necesita al menos una pregunta.')
        return value


class QuizSessionSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)

    class Meta:
        model = QuizSession
        fields = ['id', 'code', 'topic', 'status', 'created_at']


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
