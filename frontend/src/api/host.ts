import { API_BASE_URL, apiFetch } from './client';
import type { QuizSession, SessionHostState, SessionQuestionProgress, SessionQuestionProgressUpdate } from './types';

export function getSessionQuestions(token: string, code: string): Promise<SessionQuestionProgress[]> {
  return apiFetch<SessionQuestionProgress[]>(`/sessions/${encodeURIComponent(code)}/questions/`, { token });
}

/** Versión liviana de getSessionQuestions: solo started_at/revealed_at, sin
 * repetir texto/opciones/imágenes que ya no cambian durante la sesión. */
export function getSessionQuestionsProgress(token: string, code: string): Promise<SessionQuestionProgressUpdate[]> {
  return apiFetch<SessionQuestionProgressUpdate[]>(
    `/sessions/${encodeURIComponent(code)}/questions/?progress_only=1`,
    { token },
  );
}

export function getHostState(token: string, code: string, knownQuestionId?: number | null): Promise<SessionHostState> {
  const params = new URLSearchParams();
  if (knownQuestionId) params.set('known_question_id', String(knownQuestionId));
  const qs = params.toString();
  return apiFetch<SessionHostState>(`/sessions/${encodeURIComponent(code)}/host-state/${qs ? `?${qs}` : ''}`, { token });
}

export function startQuestion(token: string, code: string, order: number): Promise<SessionHostState> {
  return apiFetch<SessionHostState>(`/sessions/${encodeURIComponent(code)}/questions/${order}/start/`, {
    method: 'POST',
    token,
  });
}

export function revealQuestion(token: string, code: string, order: number): Promise<SessionHostState> {
  return apiFetch<SessionHostState>(`/sessions/${encodeURIComponent(code)}/questions/${order}/reveal/`, {
    method: 'POST',
    token,
  });
}

export function finishSession(token: string, code: string): Promise<QuizSession> {
  return apiFetch<QuizSession>(`/sessions/${encodeURIComponent(code)}/finish/`, { method: 'POST', token });
}

export function cancelSession(token: string, code: string): Promise<void> {
  return apiFetch<void>(`/sessions/${encodeURIComponent(code)}/cancel/`, { method: 'POST', token });
}

export interface HostStreamHandle {
  close: () => void;
}

/** Empuje del servidor en vez de sondeo -- reemplaza el loop de polling de
 * getHostState. No usa EventSource nativo porque este stream necesita el
 * header Authorization de siempre (EventSource no puede mandar headers
 * custom), así que arma el parseo de SSE a mano sobre fetch + ReadableStream,
 * con reconexión propia (backoff + jitter, mismo patrón que submitAnswer en
 * sessions.ts). onConnectionChange avisa cuando se cae/recupera la conexión,
 * para poder mostrar un indicador de "reconectando" -- acá, a diferencia del
 * polling de antes, una desconexión puede durar bastante y conviene que no
 * sea invisible. */
export function streamHostState(
  token: string,
  code: string,
  onMessage: (data: SessionHostState) => void,
  onSessionEnded: () => void,
  onConnectionChange?: (connected: boolean) => void,
): HostStreamHandle {
  let closed = false;
  let attempt = 0;
  let abortController: AbortController | null = null;

  function parseAndDispatch(rawEvent: string) {
    let eventType = 'message';
    let data = '';
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (eventType === 'session_ended') {
      // el servidor cerró el stream a propósito (terminó o se canceló) --
      // marcar como cerrado acá también, si no se reintenta solo y termina
      // en un loop de reconexión contra una sesión que ya no va a cambiar.
      closed = true;
      abortController?.abort();
      onSessionEnded();
    } else if (data) {
      onMessage(JSON.parse(data) as SessionHostState);
    }
  }

  async function connect() {
    if (closed) return;
    abortController = new AbortController();
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(code)}/host-state/stream/`, {
        headers: { Authorization: `Token ${token}` },
        signal: abortController.signal,
      });
      if (!response.ok || !response.body) throw new Error(`stream failed: ${response.status}`);

      onConnectionChange?.(true);
      attempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const rawEvent of events) {
          if (rawEvent) parseAndDispatch(rawEvent);
        }
      }
    } catch {
      // se reintenta abajo, sea que la conexión nunca abrió o se cortó a mitad
    }

    if (closed) return;
    onConnectionChange?.(false);
    const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
    attempt += 1;
    setTimeout(connect, delay);
  }

  connect();

  return {
    close: () => {
      closed = true;
      abortController?.abort();
    },
  };
}
