import { apiFetch } from './client';
import type { Paginated, Question } from './types';

export function listQuestions(topicSlug?: string): Promise<Paginated<Question>> {
  const query = topicSlug ? `?topic=${encodeURIComponent(topicSlug)}` : '';
  return apiFetch<Paginated<Question>>(`/questions/${query}`);
}
