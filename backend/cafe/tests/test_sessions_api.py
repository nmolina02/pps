"""Tests de integración del flujo completo de una sesión en vivo: arrancar,
unirse, contestar, revelar y finalizar — incluyendo el snapshot QuizAttempt
que sobrevive a la purga de Answer al finalizar."""
from datetime import timedelta

from django.utils import timezone

from cafe.models import Answer, Participant, QuizAttempt, QuizSession, SessionQuestion
from cafe.tests.base import ApiTestCase


class QuizStartViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)

    def test_host_can_start_a_session(self):
        self.auth(self.host)
        response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.assertEqual(response.status_code, 201, response.data)
        session = QuizSession.objects.get(code=response.data['code'])
        self.assertEqual(session.quiz, self.quiz)
        self.assertEqual(session.session_questions.count(), 1)

    def test_teacher_the_quiz_was_shared_with_can_also_start_a_session(self):
        docente_b = self.make_teacher('docente_b')
        self.quiz.shared_with.add(docente_b)
        self.auth(docente_b)
        response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.assertEqual(response.status_code, 201, response.data)

    def test_unrelated_teacher_cannot_start_a_session(self):
        unrelated = self.make_teacher('unrelated')
        self.auth(unrelated)
        response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.assertEqual(response.status_code, 404)


class JoinSessionViewTests(ApiTestCase):
    def setUp(self):
        self.host = self.make_teacher('host')
        self.session = QuizSession.objects.create(code='ABC123', host=self.host)
        self.student = self.make_student(legajo='111', full_name='Ada')

    def test_join_with_valid_legajo(self):
        response = self.client.post(f'/api/v1/sessions/{self.session.code}/join/', {'legajo': '111'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['student']['legajo'], '111')

    def test_join_with_unknown_legajo_returns_error_shape(self):
        response = self.client.post(f'/api/v1/sessions/{self.session.code}/join/', {'legajo': '999'})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['error']['code'], 'legajo_not_found')

    def test_joining_twice_reuses_the_same_participant(self):
        first = self.client.post(f'/api/v1/sessions/{self.session.code}/join/', {'legajo': '111'})
        second = self.client.post(f'/api/v1/sessions/{self.session.code}/join/', {'legajo': '111'})
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Participant.objects.filter(session=self.session, student=self.student).count(), 1)

    def test_unknown_session_code_returns_404(self):
        response = self.client.post('/api/v1/sessions/NOEXISTE/join/', {'legajo': '111'})
        self.assertEqual(response.status_code, 404)


class SessionHostPermissionTests(ApiTestCase):
    """IsSessionHost: solo quien arrancó la QuizSession puede administrarla."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.other = self.make_teacher('otro')
        self.session = QuizSession.objects.create(code='XYZ789', host=self.host)

    def test_non_host_cannot_finish(self):
        self.auth(self.other)
        response = self.client.post(f'/api/v1/sessions/{self.session.code}/finish/')
        self.assertEqual(response.status_code, 403)

    def test_non_host_cannot_cancel(self):
        self.auth(self.other)
        response = self.client.post(f'/api/v1/sessions/{self.session.code}/cancel/')
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_cannot_finish(self):
        response = self.client.post(f'/api/v1/sessions/{self.session.code}/finish/')
        self.assertEqual(response.status_code, 401)

    def test_host_can_cancel_and_it_deletes_the_session(self):
        self.auth(self.host)
        response = self.client.post(f'/api/v1/sessions/{self.session.code}/cancel/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(QuizSession.objects.filter(id=self.session.id).exists())


class FullSessionFlowTests(ApiTestCase):
    """Arranca una sesión real, un alumno se une, contesta, el docente
    revela y finaliza — verifica que el puntaje, la revelación y el
    snapshot final de QuizAttempt sean consistentes de punta a punta."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.student = self.make_student(legajo='111', full_name='Ada')

        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']

        join_response = self.client.post(f'/api/v1/sessions/{self.session_code}/join/', {'legajo': '111'})
        self.participant_id = join_response.data['id']

    def test_starting_a_question_activates_the_session(self):
        response = self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        self.assertEqual(response.status_code, 200, response.data)
        session = QuizSession.objects.get(code=self.session_code)
        self.assertEqual(session.status, QuizSession.Status.ACTIVE)

    def test_correct_answer_scores_full_points(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        response = self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        participant = Participant.objects.get(id=self.participant_id)
        self.assertGreaterEqual(participant.total_score, 90)

    def test_wrong_answer_scores_zero(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.wrong.id]},
            format='json',
        )
        participant = Participant.objects.get(id=self.participant_id)
        self.assertEqual(participant.total_score, 0)

    def test_cannot_answer_twice(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        response = self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.wrong.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['error']['code'], 'already_answered')

    def test_cannot_answer_with_an_option_from_another_question(self):
        other_question_options = self.make_quiz_with_question(self.host, title='Otro quiz')
        foreign_option = other_question_options[2]
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        response = self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [foreign_option.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error']['code'], 'invalid_option')

    def test_cannot_answer_after_the_deadline(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        session_question = SessionQuestion.objects.get(question=self.question)
        session_question.started_at = timezone.now() - timedelta(seconds=1000)
        session_question.save(update_fields=['started_at'])

        response = self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error']['code'], 'deadline_passed')

    def test_reveal_exposes_correct_options_and_own_result_to_the_student(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        reveal_response = self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/reveal/')
        self.assertEqual(reveal_response.status_code, 200, reveal_response.data)

        state_response = self.client.get(
            f'/api/v1/sessions/{self.session_code}/state/', {'participant_id': self.participant_id}
        )
        self.assertEqual(state_response.status_code, 200)
        current = state_response.data['current_question']
        self.assertEqual(current['correct_option_ids'], [self.correct.id])
        self.assertTrue(current['your_result']['is_correct'])

    def test_finishing_purges_answers_but_creates_a_quiz_attempt_snapshot(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        participant = Participant.objects.get(id=self.participant_id)
        score_before_finish = participant.total_score

        response = self.client.post(f'/api/v1/sessions/{self.session_code}/finish/')
        self.assertEqual(response.status_code, 200, response.data)

        session = QuizSession.objects.get(code=self.session_code)
        self.assertEqual(session.status, QuizSession.Status.FINISHED)
        self.assertFalse(Answer.objects.filter(session_question__session=session).exists())

        attempt = QuizAttempt.objects.get(student=self.student, quiz=self.quiz)
        self.assertEqual(attempt.total_score, score_before_finish)
        self.assertEqual(len(attempt.answers), 1)
        snapshot_question = attempt.answers[0]
        self.assertEqual(snapshot_question['selected_option_ids'], [self.correct.id])
        self.assertTrue(snapshot_question['is_correct'])

        # Participant.total_score (fuente de verdad del leaderboard) sobrevive a la purga.
        participant.refresh_from_db()
        self.assertEqual(participant.total_score, score_before_finish)

    def test_finishing_a_session_without_a_persisted_quiz_does_not_error(self):
        adhoc_session = QuizSession.objects.create(code='NOQUIZ01', host=self.host)
        self.auth(self.host)
        response = self.client.post(f'/api/v1/sessions/{adhoc_session.code}/finish/')
        self.assertEqual(response.status_code, 200, response.data)
