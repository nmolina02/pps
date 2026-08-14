import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitAnswer } from './sessions';

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    json: async () => body,
  } as Response;
}

describe('submitAnswer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends the request (after the initial jitter) when the first attempt succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { submitted: true }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = submitAnswer('ABC123', 1, { participant_id: 1, option_ids: [2] });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toEqual({ submitted: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries silently on 429 (respecting Retry-After) and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: { code: 'throttled', message: 'x', details: {} } }, { 'Retry-After': '1' }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { submitted: true }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = submitAnswer('ABC123', 1, { participant_id: 1, option_ids: [2] });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual({ submitted: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 too (server saturated), not just 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: 'unavailable', message: 'x', details: {} } }))
      .mockResolvedValueOnce(jsonResponse(201, { submitted: true }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = submitAnswer('ABC123', 1, { participant_id: 1 });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual({ submitted: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable error like deadline_passed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(403, { error: { code: 'deadline_passed', message: 'x', details: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = submitAnswer('ABC123', 1, { participant_id: 1 });
    const assertion = expect(promise).rejects.toMatchObject({ status: 403, code: 'deadline_passed' });
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the max attempts and throws the last error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: { code: 'throttled', message: 'x', details: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = submitAnswer('ABC123', 1, { participant_id: 1 });
    const assertion = expect(promise).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
