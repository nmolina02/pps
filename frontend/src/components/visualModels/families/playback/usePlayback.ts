import { useEffect, useState } from 'react';

const STEP_MS = 1200;

export interface Playback {
  /** true una vez que el alumno apretó "reproducir" — mientras sea false, la
   * familia debe dibujar exactamente como siempre (nada cambia solo). */
  active: boolean;
  index: number;
  total: number;
  playing: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

/** Motor de reproducción paso a paso, genérico para cualquier familia de
 * diagrama: solo maneja un índice de 0 a `total - 1` y un timer de avance
 * automático — cada familia decide qué dibujar para cada índice. */
export function usePlayback(total: number): Playback {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const lastIndex = Math.max(0, total - 1);

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex]);

  return {
    active,
    index,
    total,
    playing,
    start: () => {
      setActive(true);
      setIndex(0);
      setPlaying(total > 1);
    },
    pause: () => setPlaying(false),
    resume: () => {
      if (index >= lastIndex) setIndex(0);
      setPlaying(true);
    },
    next: () => {
      setPlaying(false);
      setIndex((i) => Math.min(i + 1, lastIndex));
    },
    prev: () => {
      setPlaying(false);
      setIndex((i) => Math.max(i - 1, 0));
    },
    reset: () => {
      setPlaying(false);
      setActive(false);
      setIndex(0);
    },
  };
}
