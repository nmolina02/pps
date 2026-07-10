import { apiFetch } from './client';

export function obtainToken(username: string, password: string): Promise<{ token: string }> {
  return apiFetch<{ token: string }>('/auth/token/', {
    method: 'POST',
    body: { username, password },
  });
}
