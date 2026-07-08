import { apiFetch } from './client';
import type { StudentProfile } from './types';

export function getStudentProfile(legajo: string): Promise<StudentProfile> {
  return apiFetch<StudentProfile>(`/students/${encodeURIComponent(legajo)}/profile/`);
}
