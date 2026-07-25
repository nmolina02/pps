"""Tests unitarios de validación de serializers.py — sin pasar por las vistas."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from cafe.models import Case, Question, Topic
from cafe.serializers import CaseWriteSerializer, QuizWriteSerializer, ShareQuizzesWithComisionesSerializer

User = get_user_model()


class ShareQuizzesWithComisionesSerializerTests(TestCase):
    def test_comisiones_are_uppercased(self):
        serializer = ShareQuizzesWithComisionesSerializer(data={'quiz_ids': [1], 'comisiones': ['k3054']})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['comisiones'], ['K3054'])

    def test_comisiones_are_deduplicated_case_insensitively(self):
        serializer = ShareQuizzesWithComisionesSerializer(
            data={'quiz_ids': [1], 'comisiones': ['k3054', 'K3054', ' k3054 ']}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['comisiones'], ['K3054'])

    def test_comisiones_are_sorted(self):
        serializer = ShareQuizzesWithComisionesSerializer(data={'quiz_ids': [1], 'comisiones': ['k3154', 'k3054']})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['comisiones'], ['K3054', 'K3154'])

    def test_blank_only_comisiones_are_rejected(self):
        serializer = ShareQuizzesWithComisionesSerializer(data={'quiz_ids': [1], 'comisiones': ['   ']})
        self.assertFalse(serializer.is_valid())
        self.assertIn('comisiones', serializer.errors)

    def test_empty_quiz_ids_are_rejected(self):
        serializer = ShareQuizzesWithComisionesSerializer(data={'quiz_ids': [], 'comisiones': ['K3054']})
        self.assertFalse(serializer.is_valid())
        self.assertIn('quiz_ids', serializer.errors)


class QuizWriteSerializerTests(TestCase):
    def _question(self, **overrides):
        base = {
            'text': '¿Qué es un deadlock?',
            'question_type': Question.Type.SINGLE_CHOICE,
            'justification': 'porque sí',
            'options': [
                {'text': 'Correcta', 'is_correct': True},
                {'text': 'Incorrecta', 'is_correct': False},
            ],
        }
        base.update(overrides)
        return base

    def test_valid_quiz_passes(self):
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [self._question()]})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_quiz_without_questions_is_rejected(self):
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': []})
        self.assertFalse(serializer.is_valid())
        self.assertIn('questions', serializer.errors)

    def test_single_choice_needs_exactly_one_correct_option(self):
        question = self._question(options=[
            {'text': 'A', 'is_correct': True},
            {'text': 'B', 'is_correct': True},
        ])
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [question]})
        self.assertFalse(serializer.is_valid())

    def test_multiple_choice_needs_at_least_one_correct_option(self):
        question = self._question(
            question_type=Question.Type.MULTIPLE_CHOICE,
            options=[{'text': 'A', 'is_correct': False}, {'text': 'B', 'is_correct': False}],
        )
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [question]})
        self.assertFalse(serializer.is_valid())

    def test_fill_blank_needs_at_least_one_option_and_no_justification_required_check(self):
        question = self._question(
            question_type=Question.Type.FILL_BLANK,
            options=[{'text': 'zombie'}],
        )
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [question]})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_survey_does_not_require_justification(self):
        question = self._question(
            question_type=Question.Type.SURVEY,
            justification='',
            options=[{'text': 'Sí'}, {'text': 'No'}],
        )
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [question]})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_non_survey_requires_justification(self):
        question = self._question(justification='')
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [question]})
        self.assertFalse(serializer.is_valid())

    def test_shared_with_usernames_must_exist(self):
        User.objects.create_user(username='otro_docente', password='x')
        serializer = QuizWriteSerializer(
            data={
                'title': 'Quiz',
                'shared_with_usernames': ['otro_docente', 'no_existe'],
                'questions': [self._question()],
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('shared_with_usernames', serializer.errors)

    def test_shared_with_existing_usernames_passes(self):
        User.objects.create_user(username='otro_docente', password='x')
        serializer = QuizWriteSerializer(
            data={
                'title': 'Quiz',
                'shared_with_usernames': ['otro_docente'],
                'questions': [self._question()],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_option_missing_text_is_rejected_for_non_survey(self):
        question = self._question(options=[
            {'text': '', 'is_correct': True},
            {'text': 'B', 'is_correct': False},
        ])
        serializer = QuizWriteSerializer(data={'title': 'Quiz', 'questions': [question]})
        self.assertFalse(serializer.is_valid())


class CaseWriteSerializerTests(TestCase):
    def setUp(self):
        self.topic = Topic.objects.create(name='Procesos', slug='procesos')
        self.author = User.objects.create_user(username='docente', password='x')

    def test_slug_is_generated_from_title(self):
        serializer = CaseWriteSerializer(data={
            'topic': self.topic.id,
            'title': 'Proceso Zombie',
            'scenario': 'x', 'guiding_questions': 'x', 'theory': 'x',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        case = serializer.save(author=self.author)
        self.assertEqual(case.slug, 'proceso-zombie')

    def test_duplicate_titles_get_a_unique_slug_suffix(self):
        Case.objects.create(
            topic=self.topic, author=self.author, title='Proceso Zombie', slug='proceso-zombie',
            scenario='x', guiding_questions='x', theory='x',
        )
        serializer = CaseWriteSerializer(data={
            'topic': self.topic.id,
            'title': 'Proceso Zombie',
            'scenario': 'x', 'guiding_questions': 'x', 'theory': 'x',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        case = serializer.save(author=self.author)
        self.assertEqual(case.slug, 'proceso-zombie-2')

    def test_update_does_not_change_existing_slug(self):
        case = Case.objects.create(
            topic=self.topic, author=self.author, title='Proceso Zombie', slug='proceso-zombie',
            scenario='x', guiding_questions='x', theory='x',
        )
        serializer = CaseWriteSerializer(case, data={'title': 'Proceso Zombie Renombrado'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertEqual(updated.slug, 'proceso-zombie')
        self.assertEqual(updated.title, 'Proceso Zombie Renombrado')

    def test_graphic_data_is_persisted_alongside_case(self):
        serializer = CaseWriteSerializer(data={
            'topic': self.topic.id,
            'title': 'Con gráfico',
            'scenario': 'x', 'guiding_questions': 'x', 'theory': 'x',
            'graphic_data': {'tipo': 'process_states', 'foo': 'bar'},
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        case = serializer.save(author=self.author)
        self.assertEqual(case.graphic.data, {'tipo': 'process_states', 'foo': 'bar'})
