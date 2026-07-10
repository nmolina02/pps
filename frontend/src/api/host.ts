import { apiFetch } from './client';
import type {
  CreateSessionQuestionInput,
  QuizSession,
  SessionHostState,
  SessionQuestionProgress,
} from './types';

export function createSession(
  token: string,
  payload: { topic_id: number; questions: CreateSessionQuestionInput[] },
): Promise<QuizSession> {
  return apiFetch<QuizSession>('/sessions/', { method: 'POST', body: payload, token });
}

export function getSessionQuestions(token: string, code: string): Promise<SessionQuestionProgress[]> {
  return apiFetch<SessionQuestionProgress[]>(`/sessions/${encodeURIComponent(code)}/questions/`, { token });
}

export function getHostState(token: string, code: string): Promise<SessionHostState> {
  return apiFetch<SessionHostState>(`/sessions/${encodeURIComponent(code)}/host-state/`, { token });
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
