import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamHostState } from './host';
import type { HostStreamHandle } from './host';

/** Arma un Response-like con un body que entrega los chunks dados uno por
 * uno -- simula lo que fetch() devolvería para una respuesta SSE real. */
function fakeStreamResponse(chunks: string[], ok = true): Response {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok,
    status: ok ? 200 : 500,
    body: {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) {
            return { done: false, value: encoder.encode(chunks[i++]) };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  } as unknown as Response;
}

describe('streamHostState', () => {
  // sin esto, un reintento agendado por un test (setTimeout pendiente) puede
  // seguir vivo y disparar de vuelta en medio del siguiente test -- cada
  // test registra acá el handle que crea y se cierra solo en afterEach.
  let openHandles: HostStreamHandle[] = [];

  function open(...args: Parameters<typeof streamHostState>): HostStreamHandle {
    const handle = streamHostState(...args);
    openHandles.push(handle);
    return handle;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    openHandles = [];
  });

  afterEach(() => {
    openHandles.forEach((h) => h.close());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('parses a data event and calls onMessage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeStreamResponse(['data: {"participant_count": 3}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const onMessage = vi.fn();
    open('tok', 'ABC123', onMessage, vi.fn());
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));

    expect(onMessage).toHaveBeenCalledWith({ participant_count: 3 });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Token tok');
  });

  it('parses a session_ended event and calls onSessionEnded, not onMessage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeStreamResponse(['event: session_ended\ndata: {}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const onMessage = vi.fn();
    const onSessionEnded = vi.fn();
    open('tok', 'ABC123', onMessage, onSessionEnded);
    await vi.waitFor(() => expect(onSessionEnded).toHaveBeenCalledTimes(1));

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('does not reconnect after session_ended (the server closed it on purpose)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeStreamResponse(['event: session_ended\ndata: {}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const onSessionEnded = vi.fn();
    open('tok', 'ABC123', vi.fn(), onSessionEnded);
    await vi.waitFor(() => expect(onSessionEnded).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(10000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reassembles an event split across multiple chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeStreamResponse(['data: {"partici', 'pant_count": 7}', '\n\n']),
    );
    vi.stubGlobal('fetch', fetchMock);

    const onMessage = vi.fn();
    open('tok', 'ABC123', onMessage, vi.fn());
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));

    expect(onMessage).toHaveBeenCalledWith({ participant_count: 7 });
  });

  it('reports connection state and reconnects with backoff after a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeStreamResponse(['data: {"a": 1}\n\n']))
      .mockResolvedValueOnce(fakeStreamResponse(['data: {"a": 2}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const onConnectionChange = vi.fn();
    const onMessage = vi.fn();
    open('tok', 'ABC123', onMessage, vi.fn(), onConnectionChange);

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    // el reader se agota (done: true) sin más chunks -- el stream se cierra
    // solo, streamHostState debería reintentar con backoff. Se avanza el
    // timer ya, sin esperar un vi.waitFor intermedio por el estado de
    // conexión -- mezclar fake timers con el polling en tiempo real de
    // vi.waitFor ahí es una carrera innecesaria (el fin del stream ya pasó,
    // es solo cuestión de que se agende el reintento).
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(2));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onConnectionChange).toHaveBeenCalledWith(false);
  });

  it('close() stops further reconnect attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeStreamResponse(['data: {"a": 1}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const handle = open('tok', 'ABC123', vi.fn(), vi.fn());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    handle.close();
    await vi.advanceTimersByTimeAsync(10000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
