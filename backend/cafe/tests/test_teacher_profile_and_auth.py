"""Tests de integración de autenticación por token, perfil de docente, cambio
de contraseña, limpieza de historial propio y leaderboard por cuestionario."""
from cafe.models import Participant, QuizSession
from cafe.tests.base import ApiTestCase


class TokenAuthTests(ApiTestCase):
    def test_valid_credentials_return_a_token(self):
        self.make_teacher('docente', 'clave-segura-123')
        response = self.client.post(
            '/api/v1/auth/token/', {'username': 'docente', 'password': 'clave-segura-123'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('token', response.data)

    def test_invalid_credentials_are_rejected(self):
        self.make_teacher('docente', 'clave-segura-123')
        response = self.client.post(
            '/api/v1/auth/token/', {'username': 'docente', 'password': 'incorrecta'}
        )
        self.assertEqual(response.status_code, 400)


class TeacherProfileViewTests(ApiTestCase):
    def test_requires_authentication(self):
        response = self.client.get('/api/v1/docente/perfil/')
        self.assertEqual(response.status_code, 401)

    def test_get_creates_a_profile_with_defaults_on_first_access(self):
        teacher = self.make_teacher()
        self.auth(teacher)
        response = self.client.get('/api/v1/docente/perfil/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], teacher.username)

    def test_patch_updates_avatar_and_theme(self):
        teacher = self.make_teacher()
        self.auth(teacher)
        response = self.client.patch('/api/v1/docente/perfil/', {'avatar': 5, 'theme': 'light'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['avatar'], 5)
        self.assertEqual(response.data['theme'], 'light')


class ChangePasswordViewTests(ApiTestCase):
    def test_requires_authentication(self):
        response = self.client.post('/api/v1/docente/cambiar-password/', {})
        self.assertEqual(response.status_code, 401)

    def test_correct_current_password_allows_change(self):
        teacher = self.make_teacher('docente', 'clave-vieja-123')
        self.auth(teacher)
        response = self.client.post(
            '/api/v1/docente/cambiar-password/',
            {'current_password': 'clave-vieja-123', 'new_password': 'clave-nueva-456'},
        )
        self.assertEqual(response.status_code, 200, response.data)
        teacher.refresh_from_db()
        self.assertTrue(teacher.check_password('clave-nueva-456'))

    def test_wrong_current_password_is_rejected(self):
        teacher = self.make_teacher('docente', 'clave-vieja-123')
        self.auth(teacher)
        response = self.client.post(
            '/api/v1/docente/cambiar-password/',
            {'current_password': 'no-es-esta', 'new_password': 'clave-nueva-456'},
        )
        self.assertEqual(response.status_code, 400)
        teacher.refresh_from_db()
        self.assertTrue(teacher.check_password('clave-vieja-123'))

    def test_new_password_must_pass_strength_validation(self):
        teacher = self.make_teacher('docente', 'clave-vieja-123')
        self.auth(teacher)
        response = self.client.post(
            '/api/v1/docente/cambiar-password/',
            {'current_password': 'clave-vieja-123', 'new_password': '123'},
        )
        self.assertEqual(response.status_code, 400)


class ClearMyHistoryViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.other = self.make_teacher('otro')
        self.quiz, *_ = self.make_quiz_with_question(self.host)
        self.student = self.make_student(legajo='111')

    def test_requires_at_least_one_quiz_id(self):
        self.auth(self.host)
        response = self.client.post('/api/v1/docente/mi-historial/', {'quiz_ids': []}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_clears_only_the_requesting_teachers_sessions(self):
        own_session = QuizSession.objects.create(code='OWN0001', host=self.host, quiz=self.quiz)
        Participant.objects.create(session=own_session, student=self.student, total_score=100)

        other_session = QuizSession.objects.create(code='OTH0001', host=self.other, quiz=self.quiz)
        other_student = self.make_student(legajo='222')
        Participant.objects.create(session=other_session, student=other_student, total_score=200)

        self.auth(self.host)
        response = self.client.post(
            '/api/v1/docente/mi-historial/', {'quiz_ids': [self.quiz.id]}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['deleted_participants'], 1)
        self.assertFalse(Participant.objects.filter(session=own_session).exists())
        self.assertTrue(Participant.objects.filter(session=other_session).exists())


class QuizLeaderboardViewTests(ApiTestCase):
    def test_sums_scores_across_every_session_of_the_quiz(self):
        host = self.make_teacher('host')
        quiz, *_ = self.make_quiz_with_question(host)
        student = self.make_student(legajo='111', full_name='Ada')

        session1 = QuizSession.objects.create(code='S00001', host=host, quiz=quiz)
        session2 = QuizSession.objects.create(code='S00002', host=host, quiz=quiz)
        Participant.objects.create(session=session1, student=student, total_score=100)
        Participant.objects.create(session=session2, student=student, total_score=50)

        self.auth(host)
        response = self.client.get(f'/api/v1/docente/quizzes/{quiz.id}/leaderboard/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['total_score'], 150)
        self.assertEqual(response.data[0]['sessions_played'], 2)

    def test_unrelated_teacher_cannot_view_leaderboard(self):
        host = self.make_teacher('host')
        quiz, *_ = self.make_quiz_with_question(host)
        unrelated = self.make_teacher('unrelated')
        self.auth(unrelated)
        response = self.client.get(f'/api/v1/docente/quizzes/{quiz.id}/leaderboard/')
        self.assertEqual(response.status_code, 404)
