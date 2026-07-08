from rest_framework import serializers

from .models import Case, Participant, Question, QuestionOption, QuizSession, Student, Topic


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
    """Vista completa (modo exploración async de un caso): incluye respuesta y justificación."""

    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'question_type', 'options', 'justification', 'conceptual_error']


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Vista para el alumno durante una sesión en vivo, antes del reveal: sin respuesta correcta."""

    options = QuestionOptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'question_type', 'options']


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


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'legajo', 'full_name']


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


class SubmitAnswerSerializer(serializers.Serializer):
    participant_id = serializers.IntegerField()
    option_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    free_text = serializers.CharField(required=False, allow_blank=True, default='')
