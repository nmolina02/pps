import { apiFetch, ApiError } from './client';
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

const MAX_ANSWER_ATTEMPTS = 5;

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
