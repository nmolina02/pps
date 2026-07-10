from django.conf import settings
from django.db import models
from django.utils import timezone


class Theme(models.TextChoices):
    DARK = 'dark', 'Oscuro'
    LIGHT = 'light', 'Claro'


class Topic(models.Model):
    """Los 5 temas críticos del alcance de la PPS (Procesos, Planificación, Deadlock, Memoria virtual, Filesystem)."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Case(models.Model):
    """Un caso de falla del banco (metodología CAFE: Caso + Análisis guiado + Formalización)."""

    class VisualModel(models.TextChoices):
        PROCESS_STATES = 'process_states', 'Diagrama de estados de procesos'
        CPU_TIMELINE = 'cpu_timeline', 'Línea de tiempo de planificación'
        RESOURCE_GRAPH = 'resource_graph', 'Grafo de asignación de recursos'
        MEMORY_MAP = 'memory_map', 'Mapa de memoria virtual'
        FS_SEQUENCE = 'fs_sequence', 'Secuencia de escritura en filesystem'

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='cases')
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    scenario = models.TextField(help_text='Caso de falla: la situación problemática inicial (C).')
    guiding_questions = models.TextField(help_text='Preguntas de análisis guiado (A).')
    theory = models.TextField(help_text='Formalización conceptual (F).')
    visual_model = models.CharField(max_length=30, choices=VisualModel.choices)
    visual_model_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['topic', 'title']

    def __str__(self):
        return self.title


class Question(models.Model):
    """Ítem del banco de preguntas conceptuales, reutilizable fuera de una sesión en vivo."""

    class Type(models.TextChoices):
        SINGLE_CHOICE = 'single_choice', 'Opción única'
        MULTIPLE_CHOICE = 'multiple_choice', 'Opción múltiple'
        FILL_BLANK = 'fill_blank', 'Completar'

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='questions')
    case = models.ForeignKey(
        Case, on_delete=models.SET_NULL, related_name='questions', blank=True, null=True
    )
    text = models.TextField()
    question_type = models.CharField(max_length=20, choices=Type.choices)
    justification = models.TextField(help_text='Explicación mostrada tras responder.')
    conceptual_error = models.CharField(
        max_length=255, blank=True, help_text='Error conceptual que la pregunta busca detectar.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['topic', 'id']

    def __str__(self):
        return self.text[:60]

    def score_ratio(self, *, option_ids=None, free_text=None):
        """Fracción de acierto en [0, 1]. Nunca negativa: una pregunta mal respondida
        aporta 0 puntos, pero jamás resta del puntaje total acumulado del alumno."""
        if self.question_type == self.Type.FILL_BLANK:
            accepted = {o.text.strip().lower() for o in self.options.filter(is_correct=True)}
            return 1.0 if (free_text or '').strip().lower() in accepted else 0.0

        correct_ids = set(self.options.filter(is_correct=True).values_list('id', flat=True))
        selected_ids = set(option_ids or [])

        if self.question_type == self.Type.SINGLE_CHOICE:
            return 1.0 if selected_ids == correct_ids else 0.0

        # MULTIPLE_CHOICE: crédito parcial (TP - FP) / correctas, con piso en 0.
        # Marcar todas las opciones para "asegurarse" las correctas da ratio 0,
        # no una forma de bugear el puntaje.
        if not correct_ids:
            return 0.0
        true_positives = len(selected_ids & correct_ids)
        false_positives = len(selected_ids - correct_ids)
        ratio = (true_positives - false_positives) / len(correct_ids)
        return max(0.0, ratio)


class QuestionOption(models.Model):
    """Opción de respuesta. Para preguntas 'fill_blank' representa un valor aceptado (is_correct=True)."""

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text


class QuizSession(models.Model):
    """Sala de quiz en vivo (código que comparten los alumnos para unirse)."""

    class Status(models.TextChoices):
        WAITING = 'waiting', 'Esperando'
        ACTIVE = 'active', 'Activa'
        FINISHED = 'finished', 'Finalizada'

    code = models.CharField(max_length=8, unique=True)
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='sessions')
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='quiz_sessions'
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.WAITING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.code} ({self.get_status_display()})'


class SessionQuestion(models.Model):
    """Pregunta puntual dentro de una sesión, con el deadline autoritativo del servidor."""

    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='session_questions')
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    order = models.PositiveSmallIntegerField()
    points = models.PositiveIntegerField(default=100)
    duration_seconds = models.PositiveSmallIntegerField(default=20)
    grace_seconds = models.PositiveSmallIntegerField(default=2)
    started_at = models.DateTimeField(blank=True, null=True)
    revealed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['session', 'order']
        unique_together = [('session', 'order')]

    def __str__(self):
        return f'{self.session.code} #{self.order}'

    @property
    def accepts_answers(self):
        if self.started_at is None:
            return False
        deadline = self.started_at + timezone.timedelta(
            seconds=self.duration_seconds + self.grace_seconds
        )
        return timezone.now() <= deadline


class Student(models.Model):
    """Perfil de alumno cargado por el docente (admin) a partir del legajo. Persiste
    entre sesiones/cuatrimestres — no hay alta libre desde el frontend."""

    legajo = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=150)
    avatar = models.PositiveSmallIntegerField(default=0, help_text='Índice del glifo elegido (0-7) en el frontend.')
    theme = models.CharField(max_length=5, choices=Theme.choices, default=Theme.DARK)

    class Meta:
        ordering = ['full_name']

    def __str__(self):
        return f'{self.full_name} ({self.legajo})'


class TeacherProfile(models.Model):
    """Preferencias de UI del docente (avatar + tema), persistidas server-side
    igual que las del alumno, para que viajen entre dispositivos."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='teacher_profile')
    avatar = models.PositiveSmallIntegerField(default=0, help_text='Índice del glifo elegido (0-7) en el frontend.')
    theme = models.CharField(max_length=5, choices=Theme.choices, default=Theme.DARK)

    def __str__(self):
        return f'perfil docente de {self.user.username}'


class Participant(models.Model):
    """Presencia de un Student en una QuizSession puntual."""

    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='participants')
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='participations')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('session', 'student')]

    def __str__(self):
        return f'{self.student.legajo} @ {self.session.code}'


class Answer(models.Model):
    session_question = models.ForeignKey(
        SessionQuestion, on_delete=models.CASCADE, related_name='answers'
    )
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='answers')
    selected_options = models.ManyToManyField(QuestionOption, blank=True)
    free_text = models.CharField(max_length=255, blank=True)
    is_correct = models.BooleanField(default=False)
    score = models.PositiveIntegerField(default=0)
    response_seconds = models.FloatField(default=0.0)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('participant', 'session_question')]

    def __str__(self):
        return f'{self.participant.student.legajo} -> {self.session_question}'
