import { apiFetch } from './client';
import type { CaseDetail, CaseListItem, Topic } from './types';

export function listTopics(): Promise<Topic[]> {
  return apiFetch<Topic[]>('/topics/');
}

export function listCases(topicSlug?: string): Promise<CaseListItem[]> {
  const query = topicSlug ? `?topic=${encodeURIComponent(topicSlug)}` : '';
  return apiFetch<CaseListItem[]>(`/cases/${query}`);
}

/** Solo los casos de los que `token` es autor — usados en la página de
 * gestión del docente, donde editar/borrar solo tiene sentido en lo propio. */
export function listMyCases(token: string): Promise<CaseListItem[]> {
  return apiFetch<CaseListItem[]>('/cases/?mine=true', { token });
}

export function getCase(slug: string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/cases/${encodeURIComponent(slug)}/`);
}
