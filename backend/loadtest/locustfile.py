"""Prueba de estrés del flujo join -> estado en vivo -> reveal de una sesión.

Replica el escenario que hizo caer el backend el 2026-08-12: N alumnos
uniéndose a una sesión y recibiendo el estado en vivo (pregunta activa,
countdown, revelado) mientras un único docente arranca y revela preguntas de
un cuestionario ya existente.

Soporta dos modos, elegidos con LOCUST_MODE:
  - "poll" (default): el mecanismo viejo -- /state/ cada 2s por alumno,
    /host-state/ cada 1s por el docente (igual que el frontend antes de la
    migración a SSE).
  - "sse": el mecanismo nuevo -- una sola conexión persistente por usuario a
    /state/stream/ (alumno) o /host-state/stream/ (docente), con el servidor
    empujando el estado. Reconecta con backoff si se corta, igual que el
    cliente real (EventSource nativo del lado alumno, host.ts a mano del
    lado docente).

Correr los dos modos contra el mismo ambiente (mismo QUIZ_ID, misma cantidad
de --users) da un antes/después real de la migración.

Setup previo:
  1. El cuestionario (QUIZ_ID) tiene que existir de antes y pertenecer al
     docente que loguea (QuizDetailView solo deja ver el detalle a
     host=request.user, no alcanza con que esté compartido).
  2. Los legajos que se van a usar tienen que existir de antes como Student
     en el ambiente de destino (mismo mecanismo que la importación de CSV
     del admin) -- este script no los crea, solo hace join con ellos.
     Sembrá al menos tantos legajos distintos como --users vayas a simular.

Uso:
    pip install -r loadtest/requirements.txt

    DOCENTE_USERNAME=tu_usuario DOCENTE_PASSWORD=tu_clave QUIZ_ID=10 \
    LOCUST_LEGAJO_PREFIX=LOAD LOCUST_LEGAJO_COUNT=60 LOCUST_MODE=sse \
    locust -f loadtest/locustfile.py --host https://tu-backend-de-staging.onrender.com

Después abrís http://localhost:8089, elegís cantidad de usuarios (alumnos)
y spawn rate, y arrancás.

IMPORTANTE: corré esto siempre contra un ambiente de staging con su propia
base de datos -- nunca contra el backend que usan alumnos de verdad. Un solo
DocenteUser conduce toda la sesión (fixed_count=1) sin importar cuántos
--users pidas; el resto son todos AlumnoUser.
"""

import itertools
import json
import os
import random
import time

import gevent
from locust import HttpUser, between, events, task

DOCENTE_USERNAME = os.environ["DOCENTE_USERNAME"]
DOCENTE_PASSWORD = os.environ["DOCENTE_PASSWORD"]
QUIZ_ID = int(os.environ["QUIZ_ID"])

LOCUST_MODE = os.environ.get("LOCUST_MODE", "poll")  # "poll" (viejo) o "sse" (streams nuevos)
if LOCUST_MODE not in ("poll", "sse"):
    raise RuntimeError(f"LOCUST_MODE inválido: {LOCUST_MODE!r} -- usar 'poll' o 'sse'")

# Resumen de qué pasó con los intentos de responder -- separado de las
# estadísticas normales de Locust porque acá interesa distinguir
# "rechazada por deadline" (posiblemente legítimo) de otros errores
# (throttling, 5xx) en vez de un solo número de fallos.
answer_diagnostics = {"accepted": 0, "rejected_deadline_passed": 0, "other_errors": 0}

# Cuántas veces se tuvo que reconectar cada tipo de stream SSE -- alto acá es
# señal de conexiones cortándose bajo carga (timeout de gunicorn, recycle de
# worker por --max-requests, etc.), algo que en modo "poll" no existe como
# concepto porque cada poll es una request nueva de por sí.
stream_diagnostics = {"student_reconnects": 0, "host_reconnects": 0}

LEGAJO_COUNT = int(os.environ.get("LOCUST_LEGAJO_COUNT", "60"))
if os.environ.get("LOCUST_LEGAJO_START"):
    # Legajos ya existentes en el ambiente de destino como un rango numérico
    # secuencial (ej. legajos reales de prueba precargados vía CSV import).
    _legajo_start = int(os.environ["LOCUST_LEGAJO_START"])
    LEGAJOS = [str(_legajo_start + i) for i in range(LEGAJO_COUNT)]
else:
    LEGAJO_PREFIX = os.environ.get("LOCUST_LEGAJO_PREFIX", "LOAD")
    LEGAJOS = [f"{LEGAJO_PREFIX}{i:04d}" for i in range(1, LEGAJO_COUNT + 1)]

# Cuánto deja abierta cada pregunta el "docente" antes de revelarla, y la
# pausa entre revelar y arrancar la siguiente. Ajustalos para que se
# parezcan a los tiempos reales de una clase.
QUESTION_OPEN_SECONDS = float(os.environ.get("LOCUST_QUESTION_SECONDS", "20"))
# La explicación del docente tras revelar dura ~20-30s como mínimo en una
# clase real -- nunca menos que eso.
BETWEEN_QUESTIONS_SECONDS = float(os.environ.get("LOCUST_BETWEEN_QUESTIONS_SECONDS", "25"))

# Estado compartido entre el docente y los alumnos simulados: la sesión no
# existe hasta que DocenteUser.on_start la crea, así que los alumnos esperan
# a que aparezca el código acá antes de hacer join.
session_state = {"code": None}
_legajo_pool = itertools.cycle(LEGAJOS)


def _iter_sse_events(response):
    """Parte el body de una respuesta streaming en eventos SSE completos
    (separados por línea en blanco), mismo criterio de buffering que
    frontend/src/api/host.ts."""
    buffer = ""
    for chunk in response.iter_content(chunk_size=1024):
        if not chunk:
            continue
        buffer += chunk.decode("utf-8")
        while "\n\n" in buffer:
            raw_event, buffer = buffer.split("\n\n", 1)
            if raw_event:
                yield raw_event


def _parse_sse_event(raw_event):
    event_type = "message"
    data = ""
    for line in raw_event.split("\n"):
        if line.startswith("event:"):
            event_type = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data += line[len("data:"):].strip()
    return event_type, data


def _consume_stream(user, path, params, name, diagnostics_key):
    """Genérico para alumno y docente: abre el stream, lo mantiene leído
    (descartando o guardando el payload según on_event) hasta que
    user.stop_streaming se ponga en True, reconectando con backoff si el
    servidor corta la conexión de forma inesperada (session_ended no cuenta
    como corte inesperado -- ahí no se reconecta, mismo criterio que
    host.ts/EventSource nativo)."""
    attempt = 0
    while not user.stop_streaming:
        try:
            with user.client.get(
                path,
                params=params,
                name=name,
                stream=True,
                catch_response=True,
                timeout=(10, None),
            ) as resp:
                if resp.status_code != 200:
                    resp.failure(f"stream status {resp.status_code}")
                    raise RuntimeError(f"stream failed to open: {resp.status_code}")
                resp.success()
                attempt = 0
                for raw_event in _iter_sse_events(resp):
                    if user.stop_streaming:
                        break
                    event_type, data = _parse_sse_event(raw_event)
                    if event_type == "session_ended":
                        user.stop_streaming = True
                        break
                    if data:
                        user.current_state = json.loads(data)
        except Exception:
            pass  # se reintenta abajo, salvo que stop_streaming ya esté en True

        if user.stop_streaming:
            return
        stream_diagnostics[diagnostics_key] += 1
        delay = min(1 * 2 ** attempt, 8) + random.uniform(0, 0.5)
        attempt += 1
        gevent.sleep(delay)


class DocenteUser(HttpUser):
    """Una sola instancia (fixed_count=1) conduciendo la sesión: crea el
    quiz en vivo y va arrancando/revelando preguntas en un greenlet aparte.
    En modo "poll" además sondea host-state cada 1s (igual que
    HostDashboardPage.tsx antes de SSE); en modo "sse" mantiene una única
    conexión persistente a host-state/stream/."""

    fixed_count = 1
    wait_time = between(1, 1) if LOCUST_MODE == "poll" else between(5, 5)

    def on_start(self):
        resp = self.client.post(
            "/api/v1/auth/token/",
            json={"username": DOCENTE_USERNAME, "password": DOCENTE_PASSWORD},
            name="/auth/token/",
        )
        resp.raise_for_status()
        token = resp.json()["token"]
        self.client.headers.update({"Authorization": f"Token {token}"})

        resp = self.client.post(f"/api/v1/docente/quizzes/{QUIZ_ID}/start/", name="/docente/quizzes/[id]/start/")
        resp.raise_for_status()
        self.code = resp.json()["code"]
        session_state["code"] = self.code

        # Se piden las preguntas por sesión (permiso: quien la arrancó) en vez
        # de por quiz (permiso: solo el dueño) -- así funciona también cuando
        # el docente que corre la sesión no es el dueño del quiz, sino alguien
        # con quien se lo compartieron (igual que HostDashboardPage.tsx).
        resp = self.client.get(f"/api/v1/sessions/{self.code}/questions/", name="/sessions/[code]/questions/")
        resp.raise_for_status()
        self.questions = sorted(resp.json(), key=lambda q: q["order"])
        if not self.questions:
            raise RuntimeError(f"El quiz {QUIZ_ID} no tiene preguntas cargadas.")

        self.stop_streaming = False
        self.current_state = None
        self._stream_greenlet = None
        if LOCUST_MODE == "sse":
            self._stream_greenlet = gevent.spawn(
                _consume_stream,
                self,
                f"/api/v1/sessions/{self.code}/host-state/stream/",
                None,
                "/sessions/[code]/host-state/stream/",
                "host_reconnects",
            )

        # Corre aparte del loop normal de @task para no competir por turno
        # con el sondeo de host-state.
        gevent.spawn(self._drive_questions)

    def on_stop(self):
        self.stop_streaming = True
        if self._stream_greenlet:
            self._stream_greenlet.kill(block=False)

    def _drive_questions(self):
        for question in self.questions:
            order = question["order"]
            self.client.post(
                f"/api/v1/sessions/{self.code}/questions/{order}/start/",
                name="/sessions/[code]/questions/[order]/start/",
            )
            gevent.sleep(QUESTION_OPEN_SECONDS)
            self.client.post(
                f"/api/v1/sessions/{self.code}/questions/{order}/reveal/",
                name="/sessions/[code]/questions/[order]/reveal/",
            )
            gevent.sleep(BETWEEN_QUESTIONS_SECONDS)

        self.client.post(f"/api/v1/sessions/{self.code}/finish/", name="/sessions/[code]/finish/")
        self.stop_streaming = True

    @task
    def poll_host_state(self):
        if LOCUST_MODE == "sse" or not self.code:
            return
        self.client.get(f"/api/v1/sessions/{self.code}/host-state/", name="/sessions/[code]/host-state/")


class AlumnoUser(HttpUser):
    """Un alumno: join una sola vez, después recibe el estado de la sesión
    (por polling cada 2s o por stream SSE, según LOCUST_MODE) y contesta la
    pregunta activa una vez."""

    wait_time = between(2, 2) if LOCUST_MODE == "poll" else between(0.5, 0.5)

    def on_start(self):
        for _ in range(300):  # espera hasta 5 min a que el docente arranque la sesión
            if session_state["code"]:
                break
            gevent.sleep(1)
        else:
            raise RuntimeError("La sesión nunca arrancó -- ¿falló DocenteUser.on_start?")

        self.code = session_state["code"]
        self.legajo = next(_legajo_pool)
        self.answered_orders = set()
        self._question_first_seen_at = {}
        # cuánto "piensa" este alumno antes de contestar -- no instantáneo
        # (no realista) pero tampoco al filo del deadline (eso mide otra
        # cosa: decisión tardía del alumno, no si el servidor pierde
        # respuestas que llegaron bien a tiempo, que es lo que queremos
        # medir acá). Todos quedan cómodamente dentro del límite visible.
        self.answer_delay_seconds = random.uniform(2, 8)

        resp = self.client.post(
            f"/api/v1/sessions/{self.code}/join/",
            json={"legajo": self.legajo},
            name="/sessions/[code]/join/",
        )
        if resp.status_code == 404:
            raise RuntimeError(
                f"Legajo {self.legajo} no existe en este ambiente -- "
                "sembralo antes de correr la prueba (mismo mecanismo que el CSV del admin)."
            )
        resp.raise_for_status()
        self.participant_id = resp.json()["id"]

        self.stop_streaming = False
        self.current_state = None
        self._stream_greenlet = None
        if LOCUST_MODE == "sse":
            self._stream_greenlet = gevent.spawn(
                _consume_stream,
                self,
                f"/api/v1/sessions/{self.code}/state/stream/",
                {"participant_id": self.participant_id},
                "/sessions/[code]/state/stream/",
                "student_reconnects",
            )

    def on_stop(self):
        self.stop_streaming = True
        if self._stream_greenlet:
            self._stream_greenlet.kill(block=False)

    def _maybe_answer(self):
        current = (self.current_state or {}).get("current_question")
        if not current or current["order"] in self.answered_orders:
            return
        if not current["accepts_answers"] or current.get("has_answered"):
            return

        order = current["order"]
        first_seen_at = self._question_first_seen_at.setdefault(order, time.monotonic())
        if time.monotonic() - first_seen_at < self.answer_delay_seconds:
            return  # todavía "pensando" -- contesta más adelante, bien dentro del límite

        options = current["question"].get("options") or []
        option_ids = [random.choice(options)["id"]] if options else []
        free_text = "" if options else "respuesta de prueba"

        resp = self.client.post(
            f"/api/v1/sessions/{self.code}/questions/{order}/answer/",
            json={"participant_id": self.participant_id, "option_ids": option_ids, "free_text": free_text},
            name="/sessions/[code]/questions/[order]/answer/",
        )
        self.answered_orders.add(order)

        if resp.status_code == 201:
            answer_diagnostics["accepted"] += 1
        elif resp.status_code == 403:
            answer_diagnostics["rejected_deadline_passed"] += 1
        elif resp.status_code >= 400:
            answer_diagnostics["other_errors"] += 1

    @task
    def poll_and_answer(self):
        if LOCUST_MODE == "sse":
            # el estado ya lo trae al día el greenlet del stream -- acá solo
            # se decide, con cadencia liviana y sin red, si ya es momento de
            # contestar (el servidor no reemite si no cambió nada).
            self._maybe_answer()
            return

        resp = self.client.get(
            f"/api/v1/sessions/{self.code}/state/",
            params={"participant_id": self.participant_id},
            name="/sessions/[code]/state/",
        )
        if resp.status_code != 200:
            return
        self.current_state = resp.json()
        self._maybe_answer()


@events.quitting.add_listener
def _report_answer_diagnostics(environment, **kwargs):
    d = answer_diagnostics
    total = d["accepted"] + d["rejected_deadline_passed"] + d["other_errors"]
    report = (
        "\n=== Resumen de intentos de responder ===\n"
        f"  Modo:                           {LOCUST_MODE}\n"
        f"  Total intentos:                 {total}\n"
        f"  Aceptadas:                      {d['accepted']}\n"
        f"  Rechazadas (deadline_passed):   {d['rejected_deadline_passed']}\n"
        f"  Otros errores (429/500/etc.):   {d['other_errors']}\n"
    )
    if LOCUST_MODE == "sse":
        s = stream_diagnostics
        report += (
            "=== Reconexiones de stream (SSE) ===\n"
            f"  Alumno (state/stream/):         {s['student_reconnects']}\n"
            f"  Docente (host-state/stream/):   {s['host_reconnects']}\n"
        )
    print(report)
