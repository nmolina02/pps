import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayback } from './usePlayback';

describe('usePlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts inactive, at index 0', () => {
    const { result } = renderHook(() => usePlayback(5));
    expect(result.current.active).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it('start() activates playback and begins auto-advancing', () => {
    const { result } = renderHook(() => usePlayback(3));
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.playing).toBe(true);
    expect(result.current.index).toBe(0);

    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.index).toBe(1);

    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.index).toBe(2);
  });

  it('stops auto-advancing once it reaches the last step', () => {
    const { result } = renderHook(() => usePlayback(2));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.index).toBe(1);
    expect(result.current.playing).toBe(false);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.index).toBe(1);
  });

  it('pause() stops the timer without resetting the index', () => {
    const { result } = renderHook(() => usePlayback(5));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(1200));
    act(() => result.current.pause());
    expect(result.current.playing).toBe(false);
    const indexAfterPause = result.current.index;

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.index).toBe(indexAfterPause);
  });

  it('resume() restarts from 0 when already at the last step', () => {
    const { result } = renderHook(() => usePlayback(2));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.index).toBe(1);

    act(() => result.current.resume());
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it('next()/prev() step manually and pause auto-advance', () => {
    const { result } = renderHook(() => usePlayback(3));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(result.current.playing).toBe(false);

    act(() => result.current.next());
    expect(result.current.index).toBe(2);
    act(() => result.current.next());
    expect(result.current.index).toBe(2); // no pasa del último

    act(() => result.current.prev());
    expect(result.current.index).toBe(1);
  });

  it('prev() never goes below 0', () => {
    const { result } = renderHook(() => usePlayback(3));
    act(() => result.current.start());
    act(() => result.current.prev());
    expect(result.current.index).toBe(0);
  });

  it('reset() deactivates playback entirely', () => {
    const { result } = renderHook(() => usePlayback(3));
    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.reset());
    expect(result.current.active).toBe(false);
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it('does not auto-play when there is only a single step', () => {
    const { result } = renderHook(() => usePlayback(1));
    act(() => result.current.start());
    expect(result.current.playing).toBe(false);
  });
});
