import unicodedata

from django.conf import settings
from django.db import models
from django.utils import timezone


def normalize_answer_text(value):
    """Minúsculas y sin tildes/diacríticos, para que 'Proceso Zombie' == 'proceso zombie'
    en preguntas de completar — no le importa al alumno tipear con o sin acento."""
    value = unicodedata.normalize('NFKD', value or '')
    value = ''.join(c for c in value if not unicodedata.combining(c))
    return value.strip().lower()


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
    """Un caso de falla del banco (metodología CAFE: Caso + Análisis guiado + Formalización).
    Cualquier docente puede leer/listar todos los casos, pero solo el autor
    puede editarlo o borrarlo (ver IsCaseAuthor en permissions.py)."""

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='cases')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cases')
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    scenario = models.TextField(help_text='Caso de falla: la situación problemática inicial (C).')
    guiding_questions = models.TextField(help_text='Preguntas de análisis guiado (A).')
    theory = models.TextField(help_text='Formalización conceptual (F).')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['topic', 'title']

    def __str__(self):
        return self.title


class CaseGraphic(models.Model):
    """El gráfico visual de un caso de falla: vive en su propia tabla (no
    embebido en Case) para tener identidad propia — id + topic — y se borra
    en cascada junto con el Case (uno a uno). El tipo de diagrama
    (process_states, cpu_timeline, etc.) no se elige a mano en un dropdown:
    el frontend lo matchea estructuralmente contra la forma del JSON en
    `data`, así que acá solo se persiste el dato crudo."""

    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name='graphic')
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='graphics')
    data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'gráfico de {self.case.title}'


class Quiz(models.Model):
    """Cuestionario persistido y reutilizable: se arma una vez y se puede
    arrancar en sesiones en vivo distintas cuatrimestre a cuatrimestre. Sin
    Topic propio a propósito — a diferencia de los Case, un cuestionario
    suele armarse por unidad de clase, no por tema del programa."""

    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=200)
    shared_with = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='shared_quizzes',
        blank=True,
        help_text='Docentes puntuales que además del dueño pueden verlo y arrancar sesiones — solo el dueño puede editarlo o eliminarlo.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Question(models.Model):
    """Ítem de pregunta: o bien la evaluación conceptual de un Case, o bien
    una pregunta de un Quiz — nunca las dos cosas a la vez."""

    class Type(models.TextChoices):
        SINGLE_CHOICE = 'single_choice', 'Opción única'
        MULTIPLE_CHOICE = 'multiple_choice', 'Opción múltiple'
        FILL_BLANK = 'fill_blank', 'Completar'
        SURVEY = 'survey', 'Encuesta'

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='questions', blank=True, null=True)
    case = models.ForeignKey(
        Case, on_delete=models.SET_NULL, related_name='questions', blank=True, null=True
    )
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='questions', blank=True, null=True
    )
    order = models.PositiveSmallIntegerField(default=1, help_text='Orden dentro de su Quiz.')
    points = models.PositiveIntegerField(default=100)
    duration_seconds = models.PositiveSmallIntegerField(default=20)
    grace_seconds = models.PositiveSmallIntegerField(default=2)
    text = models.TextField()
    question_type = models.CharField(max_length=20, choices=Type.choices)
    justification = models.TextField(help_text='Explicación mostrada tras responder.')
    conceptual_error = models.CharField(
        max_length=255, blank=True, help_text='Error conceptual que la pregunta busca detectar.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.text[:60]

    def score_ratio(self, *, option_ids=None, free_text=None):
        """Fracción de acierto en [0, 1]. Nunca negativa: una pregunta mal respondida
        aporta 0 puntos, pero jamás resta del puntaje total acumulado del alumno.
        Encuesta nunca puntúa: no hay opción 'correcta', es solo un pulso de opinión."""
        if self.question_type == self.Type.SURVEY:
            return 0.0
        if self.question_type == self.Type.FILL_BLANK:
            accepted = {normalize_answer_text(o.text) for o in self.options.filter(is_correct=True)}
            return 1.0 if normalize_answer_text(free_text) in accepted else 0.0

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
    """Opción de respuesta. Para preguntas 'fill_blank' representa un valor aceptado (is_correct=True).
    `image` es un data URI opcional (solo tiene sentido en preguntas tipo 'survey'),
    para no depender de infraestructura de almacenamiento de archivos."""

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255, blank=True)
    image = models.TextField(blank=True)
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
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='sessions', blank=True, null=True
    )
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name='sessions', blank=True, null=True)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='quiz_sessions'
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.WAITING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.code} ({self.get_status_display()})'


class SessionQuestion(models.Model):
    """Pregunta puntual dentro de una sesión, con el deadline autoritativo del
    servidor. order/points/duration_seconds/grace_seconds viven en Question
    (el Quiz es la fuente de verdad reutilizable); acá solo queda el estado
    de esta corrida en particular."""

    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='session_questions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    started_at = models.DateTimeField(blank=True, null=True)
    revealed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['session', 'question__order']
        unique_together = [('session', 'question')]

    def __str__(self):
        return f'{self.session.code} #{self.order}'

    @property
    def order(self):
        return self.question.order

    @property
    def points(self):
        return self.question.points

    @property
    def duration_seconds(self):
        return self.question.duration_seconds

    @property
    def grace_seconds(self):
        return self.question.grace_seconds

    @property
    def accepts_answers(self):
        if self.started_at is None:
            return False
        deadline = self.started_at + timezone.timedelta(
            seconds=self.question.duration_seconds + self.question.grace_seconds
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
    """Presencia de un Student en una QuizSession puntual. total_score se
    incrementa en vivo en cada respuesta (SubmitAnswerView) y es la fuente
    de verdad del leaderboard/historial — no se recalcula sumando Answer,
    porque esas filas se purgan al finalizar la sesión (ver FinishSessionView)."""

    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='participants')
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='participations')
    total_score = models.PositiveIntegerField(default=0)
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
