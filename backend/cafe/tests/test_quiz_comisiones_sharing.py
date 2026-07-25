"""Tests de integración del compartido de cuestionarios con comisiones de
alumnos para repaso: alta/baja en bloque, normalización de mayúsculas, y el
permiso extendido (dueño Y cualquier docente al que se le compartió el quiz,
no solo el dueño — a diferencia de editar título/preguntas)."""
from cafe.models import Quiz
from cafe.tests.base import ApiTestCase

SHARE_URL = '/api/v1/docente/quizzes/compartir-alumnos/'
UNSHARE_URL = '/api/v1/docente/quizzes/dejar-de-compartir-alumnos/'


class ShareQuizzesWithComisionesViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, *_ = self.make_quiz_with_question(self.host)

    def test_requires_authentication(self):
        response = self.client.post(SHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_owner_can_share_to_a_comision(self):
        self.auth(self.host)
        response = self.client.post(SHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054'])

    def test_lowercase_comision_is_normalized_to_uppercase(self):
        self.auth(self.host)
        response = self.client.post(SHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['k3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054'])

    def test_sharing_adds_to_existing_comisiones_instead_of_replacing(self):
        self.quiz.shared_with_comisiones = ['K3054']
        self.quiz.save(update_fields=['shared_with_comisiones'])

        self.auth(self.host)
        response = self.client.post(SHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3154']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054', 'K3154'])

    def test_sharing_multiple_quizzes_at_once(self):
        quiz2 = Quiz.objects.create(host=self.host, title='Otro quiz')
        self.auth(self.host)
        response = self.client.post(
            SHARE_URL, {'quiz_ids': [self.quiz.id, quiz2.id], 'comisiones': ['K3054']}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated'], 2)
        self.quiz.refresh_from_db()
        quiz2.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054'])
        self.assertEqual(quiz2.shared_with_comisiones, ['K3054'])

    def test_teacher_the_quiz_was_shared_with_can_also_share_to_comisiones(self):
        docente_b = self.make_teacher('docente_b')
        self.quiz.shared_with.add(docente_b)

        self.auth(docente_b)
        response = self.client.post(SHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054'])

    def test_unrelated_teacher_cannot_share_someone_elses_quiz(self):
        unrelated = self.make_teacher('docente_c')
        self.auth(unrelated)
        response = self.client.post(SHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 400)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, [])

    def test_nonexistent_quiz_id_is_rejected(self):
        self.auth(self.host)
        response = self.client.post(SHARE_URL, {'quiz_ids': [999999], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 400)


class UnshareQuizzesFromComisionesViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, *_ = self.make_quiz_with_question(self.host)
        self.quiz.shared_with_comisiones = ['K3054', 'K3154']
        self.quiz.save(update_fields=['shared_with_comisiones'])

    def test_owner_can_unshare_a_comision(self):
        self.auth(self.host)
        response = self.client.post(UNSHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3154'])

    def test_unshare_is_case_insensitive(self):
        self.auth(self.host)
        response = self.client.post(UNSHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['k3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3154'])

    def test_unsharing_a_comision_not_present_is_a_no_op(self):
        self.auth(self.host)
        response = self.client.post(UNSHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K9999']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054', 'K3154'])

    def test_shared_teacher_can_also_unshare(self):
        docente_b = self.make_teacher('docente_b')
        self.quiz.shared_with.add(docente_b)
        self.auth(docente_b)
        response = self.client.post(UNSHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3154'])

    def test_unrelated_teacher_cannot_unshare(self):
        unrelated = self.make_teacher('docente_c')
        self.auth(unrelated)
        response = self.client.post(UNSHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 400)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.shared_with_comisiones, ['K3054', 'K3154'])

    def test_unsharing_does_not_delete_existing_quiz_attempts(self):
        from cafe.models import QuizAttempt

        student = self.make_student(comision='K3054')
        QuizAttempt.objects.create(student=student, quiz=self.quiz, total_score=100, answers=[])

        self.auth(self.host)
        response = self.client.post(UNSHARE_URL, {'quiz_ids': [self.quiz.id], 'comisiones': ['K3054']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(QuizAttempt.objects.filter(student=student, quiz=self.quiz).exists())
