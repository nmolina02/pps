import { API_BASE_URL, apiFetch, ApiError } from './client';
import type { Participant, SessionStudentState } from './types';

export function joinSession(code: string, legajo: string): Promise<Participant> {
  return apiFetch<Participant>(`/sessions/${encodeURIComponent(code)}/join/`, {
    method: 'POST',
    body: { legajo },
  });
}

export function getStudentSessionState(
  code: string,
  participantId: number,
  knownQuestionId?: number | null,
): Promise<SessionStudentState> {
  const params = new URLSearchParams({ participant_id: String(participantId) });
  if (knownQuestionId) params.set('known_question_id', String(knownQuestionId));
  return apiFetch<SessionStudentState>(`/sessions/${encodeURIComponent(code)}/state/?${params.toString()}`);
}

/** Empuje del servidor en vez de sondeo -- reemplaza el loop de polling de
 * getStudentSessionState. Sin auth (como el polling que reemplaza), así que
 * un EventSource nativo alcanza: reconexión automática gratis del browser,
 * sin código propio. */
export function streamStudentSessionState(code: string, participantId: number): EventSource {
  const params = new URLSearchParams({ participant_id: String(participantId) });
  return new EventSource(
    `${API_BASE_URL}/sessions/${encodeURIComponent(code)}/state/stream/?${params.toString()}`,
  );
}

const MAX_ANSWER_ATTEMPTS = 5;
// Muchos alumnos tienden a contestar justo cuando se acaba el tiempo --
// este jitter desparrama esos envíos en una ventana chica en vez de que
// lleguen todos en el mismo instante. Cabe cómodo dentro del margen de
// grace_seconds de la pregunta, así que no le come tiempo real al alumno.
const INITIAL_SUBMIT_JITTER_MAX_MS = 2500;

/** Cuánto esperar antes del próximo intento: si el servidor mandó
 * Retry-After (429) lo respeta (+ jitter para no resincronizar a todo el
 * curso otra vez); si no, backoff exponencial con jitter. */
function nextAttemptDelayMs(retryAfterSeconds: number | null, attempt: number): number {
  if (retryAfterSeconds !== null && !Number.isNaN(retryAfterSeconds)) {
    return retryAfterSeconds * 1000 + Math.random() * 500;
  }
  return Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
}

/** Reintenta en silencio ante 429 (throttled) o 503 (servidor saturado) --
 * el alumno no ve el error, solo tarda un poco más en confirmarse. Otros
 * errores (deadline_passed, already_answered, etc.) se propagan al toque,
 * no tiene sentido reintentarlos. */
export async function submitAnswer(
  code: string,
  order: number,
  payload: { participant_id: number; option_ids?: number[]; free_text?: string },
): Promise<{ submitted: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, Math.random() * INITIAL_SUBMIT_JITTER_MAX_MS));

  for (let attempt = 0; ; attempt++) {
    try {
      return await apiFetch<{ submitted: boolean }>(
        `/sessions/${encodeURIComponent(code)}/questions/${order}/answer/`,
        { method: 'POST', body: payload },
      );
    } catch (err) {
      const retryable = err instanceof ApiError && (err.status === 429 || err.status === 503);
      if (!retryable || attempt >= MAX_ANSWER_ATTEMPTS - 1) throw err;
      const delay = nextAttemptDelayMs((err as ApiError).retryAfterSeconds, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
