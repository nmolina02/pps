"""Tests unitarios de la lógica de negocio en models.py — sin pasar por la API."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from cafe.models import Question, QuestionOption, Quiz, QuizAttempt, QuizSession, SessionQuestion, Student

User = get_user_model()


class QuestionScoreRatioSingleChoiceTests(TestCase):
    def setUp(self):
        self.question = Question.objects.create(
            order=1, text='¿Cuál es correcta?', question_type=Question.Type.SINGLE_CHOICE,
            justification='porque sí',
        )
        self.correct = QuestionOption.objects.create(question=self.question, text='A', is_correct=True)
        self.wrong = QuestionOption.objects.create(question=self.question, text='B', is_correct=False)

    def test_selecting_the_correct_option_scores_full(self):
        self.assertEqual(self.question.score_ratio(option_ids=[self.correct.id]), 1.0)

    def test_selecting_the_wrong_option_scores_zero(self):
        self.assertEqual(self.question.score_ratio(option_ids=[self.wrong.id]), 0.0)

    def test_selecting_nothing_scores_zero(self):
        self.assertEqual(self.question.score_ratio(option_ids=[]), 0.0)

    def test_selecting_both_options_does_not_match_a_single_correct_set(self):
        self.assertEqual(self.question.score_ratio(option_ids=[self.correct.id, self.wrong.id]), 0.0)


class QuestionScoreRatioMultipleChoiceTests(TestCase):
    def setUp(self):
        self.question = Question.objects.create(
            order=1, text='Marcá las correctas', question_type=Question.Type.MULTIPLE_CHOICE,
            justification='porque sí',
        )
        self.c1 = QuestionOption.objects.create(question=self.question, text='C1', is_correct=True)
        self.c2 = QuestionOption.objects.create(question=self.question, text='C2', is_correct=True)
        self.wrong = QuestionOption.objects.create(question=self.question, text='W', is_correct=False)

    def test_all_correct_options_scores_full(self):
        self.assertEqual(self.question.score_ratio(option_ids=[self.c1.id, self.c2.id]), 1.0)

    def test_partial_credit_for_one_of_two_correct(self):
        self.assertEqual(self.question.score_ratio(option_ids=[self.c1.id]), 0.5)

    def test_false_positive_offsets_true_positive(self):
        # 1 acierto - 1 error, sobre 2 correctas = 0.0, no negativo.
        self.assertEqual(self.question.score_ratio(option_ids=[self.c1.id, self.wrong.id]), 0.0)

    def test_selecting_everything_nets_out_true_and_false_positives(self):
        # 2 aciertos - 1 error, sobre 2 correctas = 0.5 — el error compensa
        # parte del acierto, pero nunca deja el ratio negativo.
        ratio = self.question.score_ratio(option_ids=[self.c1.id, self.c2.id, self.wrong.id])
        self.assertEqual(ratio, 0.5)

    def test_only_wrong_options_floors_at_zero(self):
        self.assertEqual(self.question.score_ratio(option_ids=[self.wrong.id]), 0.0)

    def test_no_correct_options_configured_scores_zero(self):
        question = Question.objects.create(
            order=2, text='Sin correctas', question_type=Question.Type.MULTIPLE_CHOICE, justification='x',
        )
        QuestionOption.objects.create(question=question, text='A', is_correct=False)
        self.assertEqual(question.score_ratio(option_ids=[]), 0.0)


class QuestionScoreRatioFillBlankTests(TestCase):
    def setUp(self):
        self.question = Question.objects.create(
            order=1, text='Completar', question_type=Question.Type.FILL_BLANK, justification='x',
        )
        QuestionOption.objects.create(question=self.question, text='Proceso Zombie', is_correct=True)

    def test_exact_match_scores_full(self):
        self.assertEqual(self.question.score_ratio(free_text='Proceso Zombie'), 1.0)

    def test_match_is_case_insensitive(self):
        self.assertEqual(self.question.score_ratio(free_text='proceso zombie'), 1.0)

    def test_match_ignores_accents(self):
        self.assertEqual(self.question.score_ratio(free_text='procéso zómbie'), 1.0)

    def test_match_trims_surrounding_whitespace(self):
        self.assertEqual(self.question.score_ratio(free_text='  Proceso Zombie  '), 1.0)

    def test_unrelated_answer_scores_zero(self):
        self.assertEqual(self.question.score_ratio(free_text='deadlock'), 0.0)

    def test_empty_answer_scores_zero(self):
        self.assertEqual(self.question.score_ratio(free_text=''), 0.0)
        self.assertEqual(self.question.score_ratio(free_text=None), 0.0)


class QuestionScoreRatioSurveyTests(TestCase):
    def test_survey_never_scores_regardless_of_selection(self):
        question = Question.objects.create(
            order=1, text='¿Qué te pareció la clase?', question_type=Question.Type.SURVEY, justification='',
        )
        option = QuestionOption.objects.create(question=question, text='Muy buena', is_correct=False)
        self.assertEqual(question.score_ratio(option_ids=[option.id]), 0.0)
        self.assertEqual(question.score_ratio(option_ids=[]), 0.0)


class StudentComisionNormalizationTests(TestCase):
    def test_comision_is_uppercased_on_save(self):
        student = Student.objects.create(legajo='1', full_name='Alumno Uno', comision='k3054')
        self.assertEqual(student.comision, 'K3054')

    def test_comision_is_stripped_and_uppercased_on_save(self):
        student = Student.objects.create(legajo='2', full_name='Alumno Dos', comision='  k3154  ')
        self.assertEqual(student.comision, 'K3154')

    def test_blank_comision_stays_blank(self):
        student = Student.objects.create(legajo='3', full_name='Alumno Tres', comision='')
        self.assertEqual(student.comision, '')

    def test_normalization_also_applies_on_update(self):
        student = Student.objects.create(legajo='4', full_name='Alumno Cuatro', comision='K3054')
        student.comision = 'k9999'
        student.save()
        student.refresh_from_db()
        self.assertEqual(student.comision, 'K9999')


class QuizAttemptUniquenessTests(TestCase):
    def test_only_one_attempt_per_student_per_quiz(self):
        from cafe.models import Quiz

        host = User.objects.create_user(username='docente', password='x')
        quiz = Quiz.objects.create(host=host, title='Quiz')
        student = Student.objects.create(legajo='1', full_name='Alumno')
        QuizAttempt.objects.create(student=student, quiz=quiz, total_score=100, answers=[])

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                QuizAttempt.objects.create(student=student, quiz=quiz, total_score=50, answers=[])

    def test_update_or_create_overwrites_previous_attempt_instead_of_duplicating(self):
        from cafe.models import Quiz

        host = User.objects.create_user(username='docente2', password='x')
        quiz = Quiz.objects.create(host=host, title='Quiz')
        student = Student.objects.create(legajo='2', full_name='Alumno')
        QuizAttempt.objects.create(student=student, quiz=quiz, total_score=100, answers=[])

        QuizAttempt.objects.update_or_create(
            student=student, quiz=quiz, defaults={'total_score': 250, 'answers': [{'x': 1}]}
        )

        self.assertEqual(QuizAttempt.objects.filter(student=student, quiz=quiz).count(), 1)
        attempt = QuizAttempt.objects.get(student=student, quiz=quiz)
        self.assertEqual(attempt.total_score, 250)


class SessionQuestionAcceptsAnswersAtTests(TestCase):
    """accepts_answers_at recibe explícitamente el momento a evaluar (en la
    vista real, request.arrived_at) en vez de mirar timezone.now() -- así una
    respuesta que llegó a tiempo pero se procesó tarde por congestión del
    servidor no se rechaza injustamente."""

    def setUp(self):
        host = User.objects.create_user(username='host', password='x')
        quiz = Quiz.objects.create(host=host, title='Quiz')
        self.question = Question.objects.create(
            quiz=quiz, order=1, text='¿?', question_type=Question.Type.SINGLE_CHOICE,
            justification='porque sí', duration_seconds=20, grace_seconds=2,
        )
        self.session = QuizSession.objects.create(code='ABC123', host=host)
        self.session_question = SessionQuestion.objects.create(session=self.session, question=self.question)

    def test_not_started_never_accepts(self):
        self.assertFalse(self.session_question.accepts_answers_at(timezone.now()))

    def test_accepts_within_duration_plus_grace(self):
        self.session_question.started_at = timezone.now() - timedelta(seconds=21)
        self.assertTrue(self.session_question.accepts_answers_at(self.session_question.started_at + timedelta(seconds=21)))

    def test_rejects_past_duration_plus_grace(self):
        self.session_question.started_at = timezone.now() - timedelta(seconds=30)
        self.assertFalse(self.session_question.accepts_answers_at(self.session_question.started_at + timedelta(seconds=23)))

    def test_a_late_arriving_moment_that_was_actually_on_time_is_still_accepted(self):
        """Simula el caso real: el alumno mandó la respuesta a los 19s (a
        tiempo), pero el servidor recién la procesa a los 25s por congestión
        -- lo que importa es el momento de llegada (19s), no el de proceso."""
        self.session_question.started_at = timezone.now() - timedelta(seconds=25)
        arrived_at = self.session_question.started_at + timedelta(seconds=19)
        self.assertTrue(self.session_question.accepts_answers_at(arrived_at))

    def test_revealing_closes_the_window_immediately_regardless_of_time_left(self):
        self.session_question.started_at = timezone.now()
        self.session_question.revealed_at = timezone.now()
        self.assertFalse(self.session_question.accepts_answers_at(timezone.now()))
