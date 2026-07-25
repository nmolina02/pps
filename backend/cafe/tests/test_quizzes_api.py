"""Tests de integración de alta/edición/borrado/listado de cuestionarios y del
compartido entre docentes (username a username, distinto del compartido con
comisiones de alumnos — ver test_quiz_comisiones_sharing.py)."""
from cafe.models import Question, Quiz
from cafe.tests.base import ApiTestCase


class QuizListCreateViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.other = self.make_teacher('otro')

    def _payload(self, **overrides):
        base = {
            'title': 'Quiz de deadlocks',
            'questions': [
                {
                    'text': '¿Qué es un deadlock?',
                    'question_type': Question.Type.SINGLE_CHOICE,
                    'justification': 'porque sí',
                    'options': [
                        {'text': 'Correcta', 'is_correct': True},
                        {'text': 'Incorrecta', 'is_correct': False},
                    ],
                }
            ],
        }
        base.update(overrides)
        return base

    def test_requires_authentication_to_list(self):
        response = self.client.get('/api/v1/docente/quizzes/')
        self.assertEqual(response.status_code, 401)

    def test_list_only_includes_own_and_shared_quizzes(self):
        Quiz.objects.create(host=self.host, title='Mío')
        Quiz.objects.create(host=self.other, title='Ajeno, no compartido')
        shared = Quiz.objects.create(host=self.other, title='Ajeno, compartido')
        shared.shared_with.add(self.host)

        self.auth(self.host)
        response = self.client.get('/api/v1/docente/quizzes/')
        self.assertEqual(response.status_code, 200)
        titles = {q['title'] for q in response.data}
        self.assertEqual(titles, {'Mío', 'Ajeno, compartido'})

    def test_create_quiz_persists_questions_and_options(self):
        self.auth(self.host)
        response = self.client.post('/api/v1/docente/quizzes/', self._payload(), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        quiz = Quiz.objects.get(id=response.data['id'])
        self.assertEqual(quiz.host, self.host)
        self.assertEqual(quiz.questions.count(), 1)
        self.assertEqual(quiz.questions.first().options.count(), 2)

    def test_create_quiz_shares_with_named_teachers(self):
        self.auth(self.host)
        payload = self._payload(shared_with_usernames=['otro'])
        response = self.client.post('/api/v1/docente/quizzes/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['shared_with'], ['otro'])

    def test_create_quiz_rejects_unknown_shared_username(self):
        self.auth(self.host)
        payload = self._payload(shared_with_usernames=['fantasma'])
        response = self.client.post('/api/v1/docente/quizzes/', payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_create_survey_question_forces_points_to_zero(self):
        self.auth(self.host)
        payload = self._payload(questions=[
            {
                'text': '¿Cómo estuvo la clase?',
                'question_type': Question.Type.SURVEY,
                'points': 500,
                'options': [{'text': 'Bien'}, {'text': 'Mal'}],
            }
        ])
        response = self.client.post('/api/v1/docente/quizzes/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        quiz = Quiz.objects.get(id=response.data['id'])
        self.assertEqual(quiz.questions.first().points, 0)


class QuizDetailViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.other = self.make_teacher('otro')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)

    def test_only_host_can_view_detail(self):
        self.auth(self.other)
        response = self.client.get(f'/api/v1/docente/quizzes/{self.quiz.id}/')
        self.assertEqual(response.status_code, 404)

    def test_shared_teacher_cannot_view_detail_either(self):
        # QuizDetailView es explícitamente para el dueño (edición); un docente
        # con el que se comparte usa QuizListCreateView/QuizStartView, no esto.
        self.quiz.shared_with.add(self.other)
        self.auth(self.other)
        response = self.client.get(f'/api/v1/docente/quizzes/{self.quiz.id}/')
        self.assertEqual(response.status_code, 404)

    def test_host_can_view_detail_with_full_questions(self):
        self.auth(self.host)
        response = self.client.get(f'/api/v1/docente/quizzes/{self.quiz.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['questions']), 1)

    def test_host_can_edit_replacing_all_questions(self):
        self.auth(self.host)
        payload = {
            'title': 'Título editado',
            'questions': [
                {
                    'text': 'Nueva pregunta',
                    'question_type': Question.Type.SINGLE_CHOICE,
                    'justification': 'x',
                    'options': [{'text': 'A', 'is_correct': True}, {'text': 'B', 'is_correct': False}],
                }
            ],
        }
        response = self.client.patch(f'/api/v1/docente/quizzes/{self.quiz.id}/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.title, 'Título editado')
        self.assertEqual(self.quiz.questions.count(), 1)
        self.assertEqual(self.quiz.questions.first().text, 'Nueva pregunta')

    def test_non_host_cannot_edit(self):
        self.auth(self.other)
        response = self.client.patch(
            f'/api/v1/docente/quizzes/{self.quiz.id}/', {'title': 'x', 'questions': []}, format='json'
        )
        self.assertEqual(response.status_code, 404)

    def test_host_can_delete(self):
        self.auth(self.host)
        response = self.client.delete(f'/api/v1/docente/quizzes/{self.quiz.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Quiz.objects.filter(id=self.quiz.id).exists())

    def test_non_host_cannot_delete(self):
        self.auth(self.other)
        response = self.client.delete(f'/api/v1/docente/quizzes/{self.quiz.id}/')
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Quiz.objects.filter(id=self.quiz.id).exists())


class CheckTeacherUsernameViewTests(ApiTestCase):
    def test_existing_username_reports_true(self):
        self.make_teacher('existe')
        self.auth(self.make_teacher('caller'))
        response = self.client.get('/api/v1/docente/usuarios/existe/existe/')
        self.assertEqual(response.data, {'exists': True})

    def test_missing_username_reports_false(self):
        self.auth(self.make_teacher('caller'))
        response = self.client.get('/api/v1/docente/usuarios/fantasma/existe/')
        self.assertEqual(response.data, {'exists': False})
