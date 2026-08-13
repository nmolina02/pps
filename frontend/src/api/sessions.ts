import { apiFetch } from './client';
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

export function submitAnswer(
  code: string,
  order: number,
  payload: { participant_id: number; option_ids?: number[]; free_text?: string },
): Promise<{ submitted: boolean }> {
  return apiFetch<{ submitted: boolean }>(`/sessions/${encodeURIComponent(code)}/questions/${order}/answer/`, {
    method: 'POST',
    body: payload,
  });
}
