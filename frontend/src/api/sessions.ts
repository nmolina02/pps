import { apiFetch } from './client';
import type { AnswerResult, Participant, SessionStudentState } from './types';

export function joinSession(code: string, legajo: string): Promise<Participant> {
  return apiFetch<Participant>(`/sessions/${encodeURIComponent(code)}/join/`, {
    method: 'POST',
    body: { legajo },
  });
}

export function getStudentSessionState(code: string, participantId: number): Promise<SessionStudentState> {
  return apiFetch<SessionStudentState>(
    `/sessions/${encodeURIComponent(code)}/state/?participant_id=${participantId}`,
  );
}

export function submitAnswer(
  code: string,
  order: number,
  payload: { participant_id: number; option_ids?: number[]; free_text?: string },
): Promise<AnswerResult> {
  return apiFetch<AnswerResult>(`/sessions/${encodeURIComponent(code)}/questions/${order}/answer/`, {
    method: 'POST',
    body: payload,
  });
}
