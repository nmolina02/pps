"""Tests de integración del perfil público de alumno (por legajo, sin login),
su historial, el leaderboard global y la pantalla de repaso de cuestionarios
compartidos con su comisión."""
from cafe.models import Participant, QuizAttempt, QuizSession
from cafe.tests.base import ApiTestCase


class StudentProfileViewTests(ApiTestCase):
    def test_get_profile_by_legajo(self):
        self.make_student(legajo='111', full_name='Ada Lovelace')
        response = self.client.get('/api/v1/students/111/profile/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Ada Lovelace')

    def test_unknown_legajo_returns_404(self):
        response = self.client.get('/api/v1/students/999/profile/')
        self.assertEqual(response.status_code, 404)

    def test_patch_can_update_avatar_and_theme(self):
        self.make_student(legajo='111', full_name='Ada')
        response = self.client.patch(
            '/api/v1/students/111/profile/', {'avatar': 3, 'theme': 'light'}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['avatar'], 3)
        self.assertEqual(response.data['theme'], 'light')

    def test_patch_cannot_change_legajo_or_full_name(self):
        self.make_student(legajo='111', full_name='Ada')
        response = self.client.patch(
            '/api/v1/students/111/profile/', {'legajo': '222', 'full_name': 'Otro Nombre'}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['legajo'], '111')
        self.assertEqual(response.data['full_name'], 'Ada')

    def test_patch_rejects_avatar_out_of_range(self):
        self.make_student(legajo='111', full_name='Ada')
        response = self.client.patch('/api/v1/students/111/profile/', {'avatar': 99}, format='json')
        self.assertEqual(response.status_code, 400)


class StudentHistoryViewTests(ApiTestCase):
    def test_requires_authentication(self):
        self.make_student(legajo='111', full_name='Ada')
        response = self.client.get('/api/v1/students/111/history/')
        self.assertEqual(response.status_code, 401)

    def test_lists_sessions_with_scores(self):
        teacher = self.make_teacher()
        student = self.make_student(legajo='111', full_name='Ada')
        session = QuizSession.objects.create(code='ABC123', host=teacher, status=QuizSession.Status.FINISHED)
        Participant.objects.create(session=session, student=student, total_score=250)

        self.auth(teacher)
        response = self.client.get('/api/v1/students/111/history/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_score'], 250)
        self.assertEqual(len(response.data['sessions']), 1)
        self.assertEqual(response.data['sessions'][0]['session_code'], 'ABC123')


class StudentLeaderboardViewTests(ApiTestCase):
    def test_requires_authentication(self):
        response = self.client.get('/api/v1/students/leaderboard/')
        self.assertEqual(response.status_code, 401)

    def test_ranks_students_by_accumulated_score(self):
        teacher = self.make_teacher()
        top = self.make_student(legajo='1', full_name='Top')
        bottom = self.make_student(legajo='2', full_name='Bottom')
        session = QuizSession.objects.create(code='ABC123', host=teacher)
        Participant.objects.create(session=session, student=top, total_score=500)
        Participant.objects.create(session=session, student=bottom, total_score=50)

        self.auth(teacher)
        response = self.client.get('/api/v1/students/leaderboard/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['legajo'], '1')
        self.assertEqual(response.data[0]['total_score'], 500)

    def test_students_with_no_participation_score_zero(self):
        teacher = self.make_teacher()
        self.make_student(legajo='1', full_name='Sin jugar')
        self.auth(teacher)
        response = self.client.get('/api/v1/students/leaderboard/')
        self.assertEqual(response.data[0]['total_score'], 0)


class StudentSharedQuizzesViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)

    def test_student_without_comision_sees_nothing(self):
        self.make_student(legajo='111', comision='')
        self.quiz.shared_with_comisiones = ['K3054']
        self.quiz.save(update_fields=['shared_with_comisiones'])

        response = self.client.get('/api/v1/students/111/quizzes-compartidos/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_student_in_shared_comision_sees_the_quiz_unplayed(self):
        self.make_student(legajo='111', comision='K3054')
        self.quiz.shared_with_comisiones = ['K3054']
        self.quiz.save(update_fields=['shared_with_comisiones'])

        response = self.client.get('/api/v1/students/111/quizzes-compartidos/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertFalse(response.data[0]['played'])
        self.assertIsNone(response.data[0]['total_score'])

    def test_student_in_a_different_comision_sees_nothing(self):
        self.make_student(legajo='111', comision='K9999')
        self.quiz.shared_with_comisiones = ['K3054']
        self.quiz.save(update_fields=['shared_with_comisiones'])

        response = self.client.get('/api/v1/students/111/quizzes-compartidos/')
        self.assertEqual(response.data, [])

    def test_played_quiz_shows_score_and_played_flag(self):
        student = self.make_student(legajo='111', comision='K3054')
        self.quiz.shared_with_comisiones = ['K3054']
        self.quiz.save(update_fields=['shared_with_comisiones'])
        QuizAttempt.objects.create(student=student, quiz=self.quiz, total_score=300, answers=[])

        response = self.client.get('/api/v1/students/111/quizzes-compartidos/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data[0]['played'])
        self.assertEqual(response.data[0]['total_score'], 300)

    def test_unknown_legajo_returns_404(self):
        response = self.client.get('/api/v1/students/999/quizzes-compartidos/')
        self.assertEqual(response.status_code, 404)


class StudentSharedQuizDetailViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.quiz.shared_with_comisiones = ['K3054']
        self.quiz.save(update_fields=['shared_with_comisiones'])
        self.student = self.make_student(legajo='111', comision='K3054')

    def test_not_shared_and_never_played_returns_404(self):
        other_student = self.make_student(legajo='222', comision='K9999')
        response = self.client.get(f'/api/v1/students/222/quizzes-compartidos/{self.quiz.id}/')
        self.assertEqual(response.status_code, 404)

    def test_shared_but_unplayed_shows_only_correct_options_marked(self):
        response = self.client.get(f'/api/v1/students/111/quizzes-compartidos/{self.quiz.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['played'])
        question = response.data['questions'][0]
        self.assertEqual(question['selected_option_ids'], [])
        correct_flags = {o['id']: o['is_correct'] for o in question['options']}
        self.assertTrue(correct_flags[self.correct.id])
        self.assertFalse(correct_flags[self.wrong.id])

    def test_played_shows_the_snapshot_from_quiz_attempt(self):
        QuizAttempt.objects.create(
            student=self.student, quiz=self.quiz, total_score=100,
            answers=[{
                'question_id': self.question.id, 'order': 1, 'text': self.question.text, 'image': '',
                'question_type': 'single_choice', 'justification': self.question.justification,
                'options': [
                    {'id': self.correct.id, 'text': 'Correcta', 'image': '', 'is_correct': True},
                    {'id': self.wrong.id, 'text': 'Incorrecta', 'image': '', 'is_correct': False},
                ],
                'selected_option_ids': [self.correct.id], 'free_text': '', 'is_correct': True, 'score': 100,
            }],
        )
        response = self.client.get(f'/api/v1/students/111/quizzes-compartidos/{self.quiz.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['played'])
        self.assertEqual(response.data['total_score'], 100)
        self.assertEqual(response.data['questions'][0]['selected_option_ids'], [self.correct.id])

    def test_a_student_who_already_played_can_still_review_after_unsharing(self):
        QuizAttempt.objects.create(student=self.student, quiz=self.quiz, total_score=100, answers=[
            {
                'question_id': self.question.id, 'order': 1, 'text': self.question.text, 'image': '',
                'question_type': 'single_choice', 'justification': self.question.justification,
                'options': [], 'selected_option_ids': [], 'free_text': '', 'is_correct': True, 'score': 100,
            }
        ])
        self.quiz.shared_with_comisiones = []
        self.quiz.save(update_fields=['shared_with_comisiones'])

        response = self.client.get(f'/api/v1/students/111/quizzes-compartidos/{self.quiz.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['played'])
