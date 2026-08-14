"""Prueba de estrés del flujo join -> poll -> reveal de una sesión en vivo.

Replica el escenario que hizo caer el backend el 2026-08-12: N alumnos
haciendo join a una sesión y sondeando /state/ en loop (cada 2s, igual que
PlayPage.tsx) mientras un único docente arranca y revela preguntas de un
cuestionario ya existente, sondeando /host-state/ cada 1s (igual que
HostDashboardPage.tsx).

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
    LOCUST_LEGAJO_PREFIX=LOAD LOCUST_LEGAJO_COUNT=60 \
    locust -f loadtest/locustfile.py --host https://tu-backend-de-staging.onrender.com

Después abrís http://localhost:8089, elegís cantidad de usuarios (alumnos)
y spawn rate, y arrancás.

IMPORTANTE: corré esto siempre contra un ambiente de staging con su propia
base de datos -- nunca contra el backend que usan alumnos de verdad. Un solo
DocenteUser conduce toda la sesión (fixed_count=1) sin importar cuántos
--users pidas; el resto son todos AlumnoUser.
"""

import itertools
import os
import random

import gevent
from locust import HttpUser, between, task

DOCENTE_USERNAME = os.environ["DOCENTE_USERNAME"]
DOCENTE_PASSWORD = os.environ["DOCENTE_PASSWORD"]
QUIZ_ID = int(os.environ["QUIZ_ID"])

LEGAJO_PREFIX = os.environ.get("LOCUST_LEGAJO_PREFIX", "LOAD")
LEGAJO_COUNT = int(os.environ.get("LOCUST_LEGAJO_COUNT", "60"))
LEGAJOS = [f"{LEGAJO_PREFIX}{i:04d}" for i in range(1, LEGAJO_COUNT + 1)]

# Cuánto deja abierta cada pregunta el "docente" antes de revelarla, y la
# pausa entre revelar y arrancar la siguiente. Ajustalos para que se
# parezcan a los tiempos reales de una clase.
QUESTION_OPEN_SECONDS = float(os.environ.get("LOCUST_QUESTION_SECONDS", "20"))
BETWEEN_QUESTIONS_SECONDS = float(os.environ.get("LOCUST_BETWEEN_QUESTIONS_SECONDS", "5"))

# Estado compartido entre el docente y los alumnos simulados: la sesión no
# existe hasta que DocenteUser.on_start la crea, así que los alumnos esperan
# a que aparezca el código acá antes de hacer join.
session_state = {"code": None}
_legajo_pool = itertools.cycle(LEGAJOS)


class DocenteUser(HttpUser):
    """Una sola instancia (fixed_count=1) conduciendo la sesión: crea el
    quiz en vivo, sondea host-state cada 1s y va arrancando/revelando
    preguntas en un greenlet aparte, igual que HostDashboardPage.tsx."""

    fixed_count = 1
    wait_time = between(1, 1)  # HOST_POLL_INTERVAL_MS del frontend

    def on_start(self):
        resp = self.client.post(
            "/api/v1/auth/token/",
            json={"username": DOCENTE_USERNAME, "password": DOCENTE_PASSWORD},
            name="/auth/token/",
        )
        resp.raise_for_status()
        token = resp.json()["token"]
        self.client.headers.update({"Authorization": f"Token {token}"})

        resp = self.client.get(f"/api/v1/docente/quizzes/{QUIZ_ID}/", name="/docente/quizzes/[id]/")
        resp.raise_for_status()
        self.questions = sorted(resp.json()["questions"], key=lambda q: q["order"])
        if not self.questions:
            raise RuntimeError(f"El quiz {QUIZ_ID} no tiene preguntas cargadas.")

        resp = self.client.post(f"/api/v1/docente/quizzes/{QUIZ_ID}/start/", name="/docente/quizzes/[id]/start/")
        resp.raise_for_status()
        self.code = resp.json()["code"]
        session_state["code"] = self.code

        # Corre aparte del loop normal de @task para no competir por turno
        # con el sondeo de host-state.
        gevent.spawn(self._drive_questions)

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

    @task
    def poll_host_state(self):
        if self.code:
            self.client.get(f"/api/v1/sessions/{self.code}/host-state/", name="/sessions/[code]/host-state/")


class AlumnoUser(HttpUser):
    """Un alumno: join una sola vez, después sondea /state/ cada 2s (mismo
    intervalo que PlayPage.tsx) y contesta la pregunta activa una vez."""

    wait_time = between(2, 2)  # POLL_INTERVAL_MS del frontend

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

    @task
    def poll_and_answer(self):
        resp = self.client.get(
            f"/api/v1/sessions/{self.code}/state/",
            params={"participant_id": self.participant_id},
            name="/sessions/[code]/state/",
        )
        if resp.status_code != 200:
            return

        current = resp.json().get("current_question")
        if not current or current["order"] in self.answered_orders:
            return
        if not current["accepts_answers"] or current.get("has_answered"):
            return

        options = current["question"].get("options") or []
        option_ids = [random.choice(options)["id"]] if options else []
        free_text = "" if options else "respuesta de prueba"

        self.client.post(
            f"/api/v1/sessions/{self.code}/questions/{current['order']}/answer/",
            json={"participant_id": self.participant_id, "option_ids": option_ids, "free_text": free_text},
            name="/sessions/[code]/questions/[order]/answer/",
        )
        self.answered_orders.add(current["order"])
