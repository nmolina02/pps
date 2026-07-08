import { apiFetch } from './client';
import type { CaseDetail, CaseListItem, Paginated, Topic } from './types';

export function listTopics(): Promise<Topic[]> {
  return apiFetch<Topic[]>('/topics/');
}

export function listCases(topicSlug?: string): Promise<Paginated<CaseListItem>> {
  const query = topicSlug ? `?topic=${encodeURIComponent(topicSlug)}` : '';
  return apiFetch<Paginated<CaseListItem>>(`/cases/${query}`);
}

export function getCase(slug: string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/cases/${encodeURIComponent(slug)}/`);
}
