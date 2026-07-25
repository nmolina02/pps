"""Utilidades compartidas por toda la suite de tests del backend."""
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from cafe.models import Case, Quiz, Question, QuestionOption, Student, Topic

User = get_user_model()

# El throttling (AnonRateThrottle/UserRateThrottle) usa el cache por defecto
# (LocMemCache, compartido por todo el proceso de test) y varias vistas
# públicas del alumno son AllowAny — con cientos de requests en la misma
# corrida de tests se pisa el límite de 120/min y aparecen 429 espurios que
# no tienen nada que ver con el comportamiento real bajo prueba. Se desactiva
# acá, no es parte de lo que estas suites verifican.
NO_THROTTLE_REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'cafe.exceptions.custom_exception_handler',
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}


@override_settings(REST_FRAMEWORK=NO_THROTTLE_REST_FRAMEWORK)
class ApiTestCase(APITestCase):
    """Base para tests de integración de la API. Trae helpers de alta rápida
    de los objetos que casi todas las suites necesitan (docente, tema,
    alumno) para no repetir el boilerplate en cada archivo."""

    def make_teacher(self, username='docente1', password='clave-segura-123'):
        user = User.objects.create_user(username=username, password=password)
        return user

    def make_topic(self, name='Procesos', slug='procesos'):
        return Topic.objects.create(name=name, slug=slug)

    def make_student(self, legajo='12345', full_name='Ada Lovelace', comision=''):
        return Student.objects.create(legajo=legajo, full_name=full_name, comision=comision)

    def make_case(self, author, topic=None, title='Proceso zombie', slug='proceso-zombie'):
        topic = topic or self.make_topic()
        return Case.objects.create(
            topic=topic,
            author=author,
            title=title,
            slug=slug,
            scenario='Un proceso hijo termina pero el padre no hace wait().',
            guiding_questions='¿Qué pasa con la entrada en la tabla de procesos?',
            theory='El proceso queda en estado zombie hasta que el padre llame a wait().',
        )

    def make_quiz_with_question(self, host, title='Quiz de procesos', question_type=Question.Type.SINGLE_CHOICE):
        quiz = Quiz.objects.create(host=host, title=title)
        question = Question.objects.create(
            quiz=quiz,
            order=1,
            text='¿Qué es un proceso zombie?',
            question_type=question_type,
            justification='Terminó pero nadie hizo wait().',
            points=100,
            duration_seconds=20,
            grace_seconds=2,
        )
        correct = QuestionOption.objects.create(question=question, text='Correcta', is_correct=True)
        wrong = QuestionOption.objects.create(question=question, text='Incorrecta', is_correct=False)
        return quiz, question, correct, wrong

    def auth(self, user):
        self.client.force_authenticate(user=user)
