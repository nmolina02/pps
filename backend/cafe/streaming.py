"""Server-Sent Events para el estado en vivo de una sesión -- reemplaza el
polling de /state/ y /host-state/ (que siguen existiendo tal cual, sin
tocar, como red de rescate) por un push del servidor.

Son django.views.View planas, no rest_framework.views.APIView: DRF no
soporta `async def get` de forma confiable (APIView.dispatch() es sync de
punta a punta), así que acá se replica a mano lo poco de auth/permisos que
hace falta en vez de heredar de APIView.

sync_to_async(..., thread_sensitive=False) es obligatorio, no cosmético --
con el default (thread_sensitive=True) todas las conexiones SSE concurrentes
terminan serializadas en un solo thread de fondo del proceso, sin importar
cuántos workers/threads tenga gunicorn."""
import asyncio
import json

from asgiref.sync import sync_to_async
from django.http import HttpResponseForbidden, HttpResponseNotFound, StreamingHttpResponse
from django.views import View

from .authentication import authenticate_token
from .views import _build_host_payload, _build_student_payload, _session_host_id

TICK_SECONDS = 2
SESSION_ENDED_EVENT = 'event: session_ended\ndata: {}\n\n'


async def _event_stream(fetch, payload, question_id, is_finished):
    """Generador SSE compartido por ambos streams -- `fetch(known_question_id)`
    es un callable async que vuelve a consultar todo fresco y devuelve
    (payload, question_id, is_finished), o (None, None, False) si la sesión
    ya no existe. Expuesto a nivel de módulo (no anidado en la vista) para
    poder testearlo directo con un `fetch` de prueba, sin pasar por HTTP ni
    por la base de datos real."""
    known_question_id = question_id
    last_payload_json = None
    try:
        while True:
            payload_json = json.dumps(payload, sort_keys=True)
            if payload_json != last_payload_json:
                last_payload_json = payload_json
                yield f'data: {payload_json}\n\n'
            if is_finished:
                yield SESSION_ENDED_EVENT
                return
            await asyncio.sleep(TICK_SECONDS)
            payload, question_id, is_finished = await fetch(known_question_id)
            if payload is None:
                yield SESSION_ENDED_EVENT
                return
            known_question_id = question_id
    except asyncio.CancelledError:
        raise


def _sse_response(generator):
    response = StreamingHttpResponse(generator, content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


class SessionStudentStateStreamView(View):
    async def get(self, request, code):
        participant_id = request.GET.get('participant_id')
        build = sync_to_async(_build_student_payload, thread_sensitive=False)

        payload, question_id, is_finished = await build(code, participant_id, None)
        if payload is None:
            return HttpResponseNotFound('No existe ninguna sesión activa con ese código.')

        async def fetch(known_question_id):
            return await build(code, participant_id, known_question_id)

        return _sse_response(_event_stream(fetch, payload, question_id, is_finished))


class SessionHostStateStreamView(View):
    async def get(self, request, code):
        user = await sync_to_async(authenticate_token, thread_sensitive=False)(request)
        if user is None:
            return HttpResponseForbidden('Invalid or missing token.')

        host_id = await sync_to_async(_session_host_id, thread_sensitive=False)(code)
        if host_id is None:
            return HttpResponseNotFound('No existe ninguna sesión activa con ese código.')
        if host_id != user.id:
            return HttpResponseForbidden('Solo el docente que creó la sesión puede administrarla.')

        build = sync_to_async(_build_host_payload, thread_sensitive=False)
        payload, question_id, is_finished = await build(code, None)
        if payload is None:
            return HttpResponseNotFound('No existe ninguna sesión activa con ese código.')

        async def fetch(known_question_id):
            return await build(code, known_question_id)

        return _sse_response(_event_stream(fetch, payload, question_id, is_finished))
