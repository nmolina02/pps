"""Datos fijos e idempotentes para correr la suite de e2e (Playwright) contra
un backend real — no se usa en producción ni en los tests unitarios/de
integración (esos arman sus propios fixtures por test). Pensado para
ejecutarse contra una base descartable (ver frontend/playwright.config.ts,
que la apunta a un sqlite aparte del de desarrollo)."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from cafe.models import Question, QuestionOption, Quiz, Student, Topic

User = get_user_model()

DOCENTE_USERNAME = 'e2e_docente'
DOCENTE_PASSWORD = 'e2e-clave-segura-123'
STUDENT_LEGAJO = 'E2E001'
STUDENT_COMISION = 'K3054'


class Command(BaseCommand):
    help = 'Crea/actualiza los datos fijos que usa la suite e2e de Playwright.'

    def handle(self, *args, **options):
        teacher, _ = User.objects.get_or_create(username=DOCENTE_USERNAME)
        teacher.set_password(DOCENTE_PASSWORD)
        teacher.save()

        topic, _ = Topic.objects.get_or_create(slug='procesos-e2e', defaults={'name': 'Procesos (e2e)'})

        student, _ = Student.objects.update_or_create(
            legajo=STUDENT_LEGAJO,
            defaults={'full_name': 'Alumno E2E', 'comision': STUDENT_COMISION},
        )

        quiz, created = Quiz.objects.get_or_create(host=teacher, title='Quiz e2e — procesos', defaults={})
        if created:
            question = Question.objects.create(
                quiz=quiz,
                order=1,
                text='¿Qué es un proceso zombie?',
                question_type=Question.Type.SINGLE_CHOICE,
                justification='Terminó pero el padre todavía no llamó a wait().',
                points=100,
                duration_seconds=20,
                grace_seconds=2,
            )
            QuestionOption.objects.create(question=question, text='Terminó y el padre no hizo wait()', is_correct=True)
            QuestionOption.objects.create(question=question, text='Sigue corriendo en background', is_correct=False)

        self.stdout.write(self.style.SUCCESS(
            f'Listo: docente "{teacher.username}", alumno "{student.legajo}" (comisión {student.comision}), '
            f'quiz "{quiz.title}" (#{quiz.id}), topic "{topic.slug}".'
        ))
