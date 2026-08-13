import { apiFetch } from './client';
import type { QuizSession, SessionHostState, SessionQuestionProgress } from './types';

export function getSessionQuestions(token: string, code: string): Promise<SessionQuestionProgress[]> {
  return apiFetch<SessionQuestionProgress[]>(`/sessions/${encodeURIComponent(code)}/questions/`, { token });
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
