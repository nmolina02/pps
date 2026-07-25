import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './client';

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: response.json ?? (async () => ({})),
    } as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('returns the parsed JSON body on success', async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ hello: 'world' }) });
    const result = await apiFetch<{ hello: string }>('/foo/');
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns undefined for a 204 No Content response', async () => {
    mockFetchOnce({ ok: true, status: 204 });
    const result = await apiFetch('/foo/');
    expect(result).toBeUndefined();
  });

  it('sends the Authorization header when a token is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/foo/', { token: 'abc123' });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Token abc123');
  });

  it('serializes the body as JSON and sets the method', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/foo/', { method: 'POST', body: { a: 1 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('throws an ApiError built from the structured error payload', async () => {
    mockFetchOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'legajo_not_found', message: 'No existe', details: { x: 1 } } }),
    });

    await expect(apiFetch('/foo/')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'legajo_not_found',
      message: 'No existe',
      details: { x: 1 },
    });
  });

  it('falls back to sensible defaults when the error body is not JSON', async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    let caught: unknown;
    try {
      await apiFetch('/foo/');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('unknown_error');
    expect((caught as ApiError).message).toBe('Error 500');
  });
});
