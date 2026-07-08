import { apiFetch } from './client';
import type { StudentProfile, Theme } from './types';

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
