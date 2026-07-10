import { apiFetch } from './client';
import type { CaseDetail, CaseWriteInput, TeacherProfile, Theme } from './types';

export function getTeacherProfile(token: string): Promise<TeacherProfile> {
  return apiFetch<TeacherProfile>('/docente/perfil/', { token });
}

export function updateTeacherPreferences(
  token: string,
  prefs: Partial<{ avatar: number; theme: Theme }>,
): Promise<TeacherProfile> {
  return apiFetch<TeacherProfile>('/docente/perfil/', { method: 'PATCH', body: prefs, token });
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
