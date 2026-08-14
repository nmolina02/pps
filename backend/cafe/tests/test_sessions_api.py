"""Tests de integración del flujo completo de una sesión en vivo: arrancar,
unirse, contestar, revelar y finalizar — incluyendo el snapshot QuizAttempt
que sobrevive a la purga de Answer al finalizar."""
from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.utils import timezone

from cafe.models import Answer, Participant, QuizAttempt, QuizSession, SessionQuestion
from cafe.tests.base import ApiTestCase
from cafe.throttling import SessionActionThrottle, SessionPollThrottle


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


class KnownQuestionImageStrippingTests(ApiTestCase):
    """?known_question_id= le permite al cliente evitar que se le reenvíen
    las imágenes de una pregunta que ya tiene -- pesan bastante y se pedían
    de nuevo en cada poll (1-2 veces por segundo) sin necesidad."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.question.image = 'data:image/png;base64,QUESTIONIMG'
        self.question.save(update_fields=['image'])
        self.correct.image = 'data:image/png;base64,OPTIONIMG'
        self.correct.save(update_fields=['image'])

        self.make_student(legajo='111', full_name='Ada')

        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')

        join_response = self.client.post(f'/api/v1/sessions/{self.session_code}/join/', {'legajo': '111'})
        self.participant_id = join_response.data['id']

    def test_student_state_includes_images_without_a_known_question_id(self):
        response = self.client.get(
            f'/api/v1/sessions/{self.session_code}/state/', {'participant_id': self.participant_id}
        )
        question = response.data['current_question']['question']
        self.assertEqual(question['image'], self.question.image)
        self.assertTrue(any(o['image'] for o in question['options']))

    def test_student_state_blanks_images_when_the_client_already_has_them(self):
        response = self.client.get(
            f'/api/v1/sessions/{self.session_code}/state/',
            {'participant_id': self.participant_id, 'known_question_id': self.question.id},
        )
        question = response.data['current_question']['question']
        self.assertEqual(question['image'], '')
        self.assertTrue(all(o['image'] == '' for o in question['options']))

    def test_student_state_still_sends_images_for_a_different_known_question_id(self):
        response = self.client.get(
            f'/api/v1/sessions/{self.session_code}/state/',
            {'participant_id': self.participant_id, 'known_question_id': self.question.id + 999},
        )
        question = response.data['current_question']['question']
        self.assertEqual(question['image'], self.question.image)

    def test_host_state_blanks_images_when_the_client_already_has_them(self):
        full_response = self.client.get(f'/api/v1/sessions/{self.session_code}/host-state/')
        self.assertEqual(full_response.data['current_question']['question']['image'], self.question.image)

        stripped_response = self.client.get(
            f'/api/v1/sessions/{self.session_code}/host-state/', {'known_question_id': self.question.id}
        )
        stripped_question = stripped_response.data['current_question']['question']
        self.assertEqual(stripped_question['image'], '')
        self.assertTrue(all(o['image'] == '' for o in stripped_question['options']))

    def test_host_state_tally_images_are_also_stripped(self):
        response = self.client.get(
            f'/api/v1/sessions/{self.session_code}/host-state/', {'known_question_id': self.question.id}
        )
        tally = response.data['current_question']['tally']
        self.assertTrue(all(row['image'] == '' for row in tally))


class SessionQuestionListViewTests(ApiTestCase):
    """GET .../questions/: la lista completa (con el contenido de cada
    pregunta) vs. ?progress_only=1 (solo started_at/revealed_at, para no
    repetir texto/opciones/imágenes que no cambian durante la sesión)."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.question.image = 'data:image/png;base64,QUESTIONIMG'
        self.question.save(update_fields=['image'])

        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')

    def test_full_list_includes_question_content(self):
        response = self.client.get(f'/api/v1/sessions/{self.session_code}/questions/')
        self.assertEqual(response.status_code, 200, response.data)
        row = response.data[0]
        self.assertEqual(row['question']['image'], self.question.image)
        self.assertIsNotNone(row['started_at'])
        self.assertIsNone(row['revealed_at'])

    def test_progress_only_omits_question_content(self):
        response = self.client.get(f'/api/v1/sessions/{self.session_code}/questions/', {'progress_only': '1'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(response.data[0].keys()), {'order', 'started_at', 'revealed_at'})

    def test_progress_only_reflects_reveal(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/reveal/')
        response = self.client.get(f'/api/v1/sessions/{self.session_code}/questions/', {'progress_only': '1'})
        self.assertIsNotNone(response.data[0]['revealed_at'])


class RequestArrivalTimeDeadlineTests(ApiTestCase):
    """SubmitAnswerView usa request.arrived_at (seteado por
    RequestArrivalTimeMiddleware) para decidir el deadline, no el momento en
    que efectivamente se procesa -- así una respuesta que quedó en cola por
    congestión del servidor pero que el alumno mandó a tiempo no se rechaza
    injustamente. Y revelar corta la ventana al instante, sin importar
    cuánto margen nominal quede."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.make_student(legajo='111', full_name='Ada')
        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        join_response = self.client.post(f'/api/v1/sessions/{self.session_code}/join/', {'legajo': '111'})
        self.participant_id = join_response.data['id']
        self.session_question = SessionQuestion.objects.get(session__code=self.session_code, question=self.question)

    def test_an_answer_that_arrived_on_time_is_accepted_even_if_processed_late(self):
        # empujamos started_at al pasado para que "ahora" (el momento real en
        # que corre este assert) ya haya superado el deadline nominal
        # (20+2s) -- pero la request "llegó" bien a tiempo, a los 5s.
        self.session_question.started_at = timezone.now() - timedelta(seconds=30)
        self.session_question.save(update_fields=['started_at'])
        arrived_at = self.session_question.started_at + timedelta(seconds=5)

        with mock.patch('cafe.middleware.timezone.now', return_value=arrived_at):
            response = self.client.post(
                f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
                {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
                format='json',
            )
        self.assertEqual(response.status_code, 201, response.data)

    def test_a_request_that_truly_arrived_late_is_rejected(self):
        self.session_question.started_at = timezone.now() - timedelta(seconds=30)
        self.session_question.save(update_fields=['started_at'])

        response = self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error']['code'], 'deadline_passed')

    def test_revealing_blocks_new_answers_even_with_time_nominally_left(self):
        # started_at recién seteado por el /start/ del setUp -- todavía
        # quedan de sobra de los 20s nominales de duration_seconds.
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/reveal/')
        response = self.client.post(
            f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
            {'participant_id': self.participant_id, 'option_ids': [self.correct.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error']['code'], 'deadline_passed')


class SessionPollThrottleTests(ApiTestCase):
    """/state/ usa su propio scope de throttle (session_poll) en vez del
    'anon' genérico compartido por toda la API -- antes del fix, un aula
    entera sondeando /state/ desde la misma IP (como pasa detrás del proxy
    de Render) agotaba el balde de 120/min compartido con el resto de la
    API. Bajamos la tasa a un número chico acá para no tener que mandar
    miles de requests para probarlo."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.make_student(legajo='111', full_name='Ada')
        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']
        self.client.force_authenticate(user=None)
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_state_polling_is_throttled_once_its_own_scope_is_exhausted(self):
        # DRF congela THROTTLE_RATES como atributo de clase al importar el
        # módulo -- @override_settings no lo vuelve a leer, así que para
        # simular una tasa baja en el test hay que parchear la clase directo.
        with mock.patch.object(SessionPollThrottle, 'THROTTLE_RATES', {'session_poll': '2/minute'}):
            first = self.client.get(f'/api/v1/sessions/{self.session_code}/state/')
            second = self.client.get(f'/api/v1/sessions/{self.session_code}/state/')
            third = self.client.get(f'/api/v1/sessions/{self.session_code}/state/')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 429)

    def test_exhausting_the_session_poll_scope_does_not_throttle_the_rest_of_the_api(self):
        with mock.patch.object(SessionPollThrottle, 'THROTTLE_RATES', {'session_poll': '2/minute'}):
            self.client.get(f'/api/v1/sessions/{self.session_code}/state/')
            self.client.get(f'/api/v1/sessions/{self.session_code}/state/')
            exhausted = self.client.get(f'/api/v1/sessions/{self.session_code}/state/')
            self.assertEqual(exhausted.status_code, 429)

        # /topics/ usa el scope 'anon' genérico (el mock de arriba solo
        # afecta a session_poll) -- antes del fix compartían un solo balde.
        topics_response = self.client.get('/api/v1/topics/')
        self.assertEqual(topics_response.status_code, 200)


class SessionActionThrottleTests(ApiTestCase):
    """/join/ y /answer/ usan su propio scope (session_action) en vez del
    'anon' genérico -- mismo motivo que /state/: en una ráfaga (todo el
    curso uniéndose o contestando cerca del mismo momento) podían agotar
    el balde compartido con el resto de la API."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.make_student(legajo='111', full_name='Ada')
        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')
        self.client.force_authenticate(user=None)
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_join_is_throttled_by_its_own_scope(self):
        with mock.patch.object(SessionActionThrottle, 'THROTTLE_RATES', {'session_action': '1/minute'}):
            first = self.client.post(f'/api/v1/sessions/{self.session_code}/join/', {'legajo': '111'})
            second = self.client.post(f'/api/v1/sessions/{self.session_code}/join/', {'legajo': '111'})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)

    def test_answer_is_throttled_by_its_own_scope_not_shared_with_state_polling(self):
        join_response = self.client.post(f'/api/v1/sessions/{self.session_code}/join/', {'legajo': '111'})
        participant_id = join_response.data['id']
        cache.clear()  # el join ya consumió cupo del scope -- no cuenta para este assert

        with mock.patch.object(SessionActionThrottle, 'THROTTLE_RATES', {'session_action': '1/minute'}):
            first = self.client.post(
                f'/api/v1/sessions/{self.session_code}/questions/1/answer/',
                {'participant_id': participant_id, 'option_ids': [self.correct.id]},
                format='json',
            )
            exhausted = self.client.get(f'/api/v1/sessions/{self.session_code}/state/', {'participant_id': participant_id})
        self.assertEqual(first.status_code, 201, first.data)
        # /state/ usa session_poll, un scope totalmente distinto -- agotar
        # session_action contestando no debería afectarlo.
        self.assertEqual(exhausted.status_code, 200)
