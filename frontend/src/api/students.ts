import { apiFetch } from './client';
import type { SharedQuizDetail, SharedQuizListItem, StudentProfile, Theme } from './types';

export function getStudentProfile(legajo: string): Promise<StudentProfile> {
  return apiFetch<StudentProfile>(`/students/${encodeURIComponent(legajo)}/profile/`);
}

export function updateStudentPreferences(
  legajo: string,
  prefs: Partial<{ avatar: number; theme: Theme }>,
): Promise<StudentProfile> {
  return apiFetch<StudentProfile>(`/students/${encodeURIComponent(legajo)}/profile/`, {
    method: 'PATCH',
    body: prefs,
  });
}

export function listSharedQuizzes(legajo: string): Promise<SharedQuizListItem[]> {
  return apiFetch<SharedQuizListItem[]>(`/students/${encodeURIComponent(legajo)}/quizzes-compartidos/`);
}

export function getSharedQuizDetail(legajo: string, quizId: number): Promise<SharedQuizDetail> {
  return apiFetch<SharedQuizDetail>(
    `/students/${encodeURIComponent(legajo)}/quizzes-compartidos/${quizId}/`,
  );
}
