import { apiFetch } from './client';
import type {
  CaseDetail,
  CaseWriteInput,
  Quiz,
  QuizDetail,
  QuizLeaderboardRow,
  QuizSession,
  QuizWriteInput,
  TeacherProfile,
  Theme,
} from './types';

export function shareQuizzesWithComisiones(
  token: string,
  payload: { quiz_ids: number[]; comisiones: string[] },
): Promise<{ updated: number; comisiones: string[] }> {
  return apiFetch<{ updated: number; comisiones: string[] }>('/docente/quizzes/compartir-alumnos/', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function unshareQuizzesFromComisiones(
  token: string,
  payload: { quiz_ids: number[]; comisiones: string[] },
): Promise<{ updated: number; comisiones: string[] }> {
  return apiFetch<{ updated: number; comisiones: string[] }>('/docente/quizzes/dejar-de-compartir-alumnos/', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function getTeacherProfile(token: string): Promise<TeacherProfile> {
  return apiFetch<TeacherProfile>('/docente/perfil/', { token });
}

export function updateTeacherPreferences(
  token: string,
  prefs: Partial<{ avatar: number; theme: Theme }>,
): Promise<TeacherProfile> {
  return apiFetch<TeacherProfile>('/docente/perfil/', { method: 'PATCH', body: prefs, token });
}

export function checkTeacherUsername(token: string, username: string): Promise<boolean> {
  return apiFetch<{ exists: boolean }>(`/docente/usuarios/${encodeURIComponent(username)}/existe/`, {
    token,
  }).then((r) => r.exists);
}

export function changePassword(
  token: string,
  payload: { current_password: string; new_password: string },
): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>('/docente/cambiar-password/', { method: 'POST', body: payload, token });
}

export function createCase(token: string, payload: CaseWriteInput): Promise<CaseDetail> {
  return apiFetch<CaseDetail>('/docente/cases/', { method: 'POST', body: payload, token });
}

export function updateCase(
  token: string,
  slug: string,
  payload: Partial<CaseWriteInput>,
): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/docente/cases/${encodeURIComponent(slug)}/`, {
    method: 'PATCH',
    body: payload,
    token,
  });
}

export function deleteCase(token: string, slug: string): Promise<void> {
  return apiFetch<void>(`/docente/cases/${encodeURIComponent(slug)}/`, { method: 'DELETE', token });
}

export function listQuizzes(token: string): Promise<Quiz[]> {
  return apiFetch<Quiz[]>('/docente/quizzes/', { token });
}

export function createQuiz(token: string, payload: QuizWriteInput): Promise<Quiz> {
  return apiFetch<Quiz>('/docente/quizzes/', { method: 'POST', body: payload, token });
}

export function getQuiz(token: string, id: number): Promise<QuizDetail> {
  return apiFetch<QuizDetail>(`/docente/quizzes/${id}/`, { token });
}

export function updateQuiz(token: string, id: number, payload: QuizWriteInput): Promise<Quiz> {
  return apiFetch<Quiz>(`/docente/quizzes/${id}/`, { method: 'PATCH', body: payload, token });
}

export function deleteQuiz(token: string, id: number): Promise<void> {
  return apiFetch<void>(`/docente/quizzes/${id}/`, { method: 'DELETE', token });
}

export function startQuiz(token: string, id: number): Promise<QuizSession> {
  return apiFetch<QuizSession>(`/docente/quizzes/${id}/start/`, { method: 'POST', token });
}

export function clearMyHistory(token: string, quizIds: number[]): Promise<{ deleted_participants: number }> {
  return apiFetch<{ deleted_participants: number }>('/docente/mi-historial/', {
    method: 'POST',
    body: { quiz_ids: quizIds },
    token,
  });
}

export function getQuizLeaderboard(token: string, id: number): Promise<QuizLeaderboardRow[]> {
  return apiFetch<QuizLeaderboardRow[]>(`/docente/quizzes/${id}/leaderboard/`, { token });
}
