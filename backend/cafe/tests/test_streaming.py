"""Tests de las vistas de streaming (SSE) -- cafe/streaming.py.

El armado del payload en sí (_student_state_payload/_host_state_payload) ya
está cubierto en profundidad por test_sessions_api.py, porque
SessionStudentStateView/SessionHostStateView (el polling viejo, que sigue
activo como red de rescate) llaman a las mismas funciones que usan estos
streams. Acá se prueba lo que es nuevo: los wrappers _build_*_payload, el
generador _event_stream en sí (dedup, fin de sesión, cancelación) en total
aislamiento con un `fetch` de prueba -- sin DB ni HTTP -- y el rechazo de
auth del stream del docente a través del stack real."""
import asyncio
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from django.contrib.auth import get_user_model
from django.test import AsyncClient, TransactionTestCase
from rest_framework.authtoken.models import Token

from cafe.models import Question, QuestionOption, Quiz, QuizSession
from cafe.streaming import SESSION_ENDED_EVENT, _event_stream
from cafe.tests.base import ApiTestCase
from cafe.views import _build_host_payload, _build_student_payload

User = get_user_model()


class BuildPayloadWrapperTests(ApiTestCase):
    """_build_student_payload/_build_host_payload: la parte propia de estos
    wrappers (el sentinel de "sesión inexistente" y el flag is_finished),
    no el armado del payload en sí (ya cubierto en test_sessions_api.py)."""

    def setUp(self):
        self.host = self.make_teacher('host')
        self.quiz, self.question, self.correct, self.wrong = self.make_quiz_with_question(self.host)
        self.make_student(legajo='111', full_name='Ada')
        self.auth(self.host)
        start_response = self.client.post(f'/api/v1/docente/quizzes/{self.quiz.id}/start/')
        self.session_code = start_response.data['code']
        self.client.post(f'/api/v1/sessions/{self.session_code}/questions/1/start/')

    def test_build_student_payload_returns_none_sentinel_for_unknown_code(self):
        payload, question_id, is_finished = _build_student_payload('NOEXISTE', None, None)
        self.assertIsNone(payload)
        self.assertIsNone(question_id)
        self.assertFalse(is_finished)

    def test_build_student_payload_extracts_the_current_question_id(self):
        payload, question_id, is_finished = _build_student_payload(self.session_code, None, None)
        self.assertIsNotNone(payload)
        self.assertEqual(question_id, self.question.id)
        self.assertFalse(is_finished)

    def test_build_student_payload_reports_finished(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/finish/')
        _, _, is_finished = _build_student_payload(self.session_code, None, None)
        self.assertTrue(is_finished)

    def test_build_host_payload_returns_none_sentinel_for_unknown_code(self):
        payload, question_id, is_finished = _build_host_payload('NOEXISTE', None)
        self.assertIsNone(payload)
        self.assertIsNone(question_id)
        self.assertFalse(is_finished)

    def test_build_host_payload_extracts_the_current_question_id(self):
        payload, question_id, is_finished = _build_host_payload(self.session_code, None)
        self.assertIsNotNone(payload)
        self.assertEqual(question_id, self.question.id)
        self.assertFalse(is_finished)

    def test_build_host_payload_reports_finished(self):
        self.client.post(f'/api/v1/sessions/{self.session_code}/finish/')
        _, _, is_finished = _build_host_payload(self.session_code, None)
        self.assertTrue(is_finished)


class EventStreamGeneratorTests(IsolatedAsyncioTestCase):
    """_event_stream en total aislamiento -- un `fetch` de prueba en vez de
    la base de datos real, así se prueba el control de flujo (dedup, corte
    en session_ended, propagación de CancelledError) sin depender de nada
    async-y-Django. asyncio.sleep se mockea para que estos tests no tarden
    TICK_SECONDS de verdad por iteración."""

    def setUp(self):
        self._sleep_patch = patch('cafe.streaming.asyncio.sleep', new=AsyncMock(return_value=None))
        self._sleep_patch.start()
        self.addCleanup(self._sleep_patch.stop)

    async def test_does_not_yield_a_duplicate_payload(self):
        responses = iter([({'x': 1}, 99, False), ({'x': 2}, 99, False)])

        async def fetch(known_question_id):
            return next(responses)

        gen = _event_stream(fetch, {'x': 1}, 99, False)
        first = await gen.__anext__()
        second = await gen.__anext__()

        self.assertIn('"x": 1', first)
        # el primer fetch repite el mismo payload -- no debería generar un
        # segundo `data:` duplicado, el próximo yield real es el que cambió.
        self.assertIn('"x": 2', second)

    async def test_yields_session_ended_when_the_session_finishes(self):
        async def fetch(known_question_id):
            return {'x': 1}, 99, True  # mismo payload, pero ya terminado

        gen = _event_stream(fetch, {'x': 1}, 99, False)
        await gen.__anext__()  # payload inicial
        second = await gen.__anext__()
        self.assertEqual(second, SESSION_ENDED_EVENT)
        with self.assertRaises(StopAsyncIteration):
            await gen.__anext__()

    async def test_yields_session_ended_when_the_session_disappears(self):
        async def fetch(known_question_id):
            return None, None, False

        gen = _event_stream(fetch, {'x': 1}, 99, False)
        await gen.__anext__()  # payload inicial
        second = await gen.__anext__()
        self.assertEqual(second, SESSION_ENDED_EVENT)
        with self.assertRaises(StopAsyncIteration):
            await gen.__anext__()

    async def test_cancelled_error_propagates_instead_of_being_swallowed(self):
        async def fetch(known_question_id):
            raise asyncio.CancelledError()

        gen = _event_stream(fetch, {'x': 1}, 99, False)
        await gen.__anext__()  # payload inicial
        with self.assertRaises(asyncio.CancelledError):
            await gen.__anext__()


class HostStreamAuthTests(TransactionTestCase):
    """Solo los caminos de rechazo (devuelven antes de entrar al generador,
    así que son seguros/rápidos de probar por el stack real) -- usa
    TransactionTestCase porque la vista cruza a otro thread vía
    sync_to_async(thread_sensitive=False), y el aislamiento por savepoint de
    TestCase/ApiTestCase no es visible desde ahí (ver plan de esta feature)."""

    def setUp(self):
        self.host = User.objects.create_user(username='host-stream', password='x')
        self.other = User.objects.create_user(username='other-stream', password='x')
        self.host_token = Token.objects.create(user=self.host)
        self.other_token = Token.objects.create(user=self.other)
        quiz = Quiz.objects.create(host=self.host, title='Quiz stream')
        question = Question.objects.create(
            quiz=quiz, order=1, text='¿?', question_type=Question.Type.SINGLE_CHOICE,
            justification='porque sí', duration_seconds=20, grace_seconds=2,
        )
        QuestionOption.objects.create(question=question, text='A', is_correct=True)
        self.session = QuizSession.objects.create(code='STREAM1', host=self.host)

    async def test_rejects_missing_token(self):
        response = await AsyncClient().get(f'/api/v1/sessions/{self.session.code}/host-state/stream/')
        self.assertEqual(response.status_code, 403)

    async def test_rejects_an_invalid_token(self):
        response = await AsyncClient().get(
            f'/api/v1/sessions/{self.session.code}/host-state/stream/',
            headers={'Authorization': 'Token esto-no-existe'},
        )
        self.assertEqual(response.status_code, 403)

    async def test_rejects_a_different_docentes_token(self):
        response = await AsyncClient().get(
            f'/api/v1/sessions/{self.session.code}/host-state/stream/',
            headers={'Authorization': f'Token {self.other_token.key}'},
        )
        self.assertEqual(response.status_code, 403)

    async def test_unknown_session_code_returns_404(self):
        response = await AsyncClient().get(
            '/api/v1/sessions/NOEXISTE/host-state/stream/',
            headers={'Authorization': f'Token {self.host_token.key}'},
        )
        self.assertEqual(response.status_code, 404)
