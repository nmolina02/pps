import type { Playback } from './usePlayback';

const btnStyle: React.CSSProperties = {
  padding: '0.35em 0.7em',
  fontSize: '0.78rem',
};

/** Controles de reproducción paso a paso, compartidos por todas las familias
 * de diagrama. Antes de arrancar es un solo botón "reproducir"; una vez
 * activo, aparecen play/pause, paso manual, reiniciar y el contador. No se
 * renderiza nada si el diagrama no tiene más de un paso. */
export function PlaybackControls({ playback }: { playback: Playback }) {
  if (playback.total <= 1) return null;

  if (!playback.active) {
    return (
      <button type="button" className="btn" onClick={playback.start} style={{ ...btnStyle, marginTop: 14 }}>
        ▶ reproducir paso a paso
      </button>
    );
  }

  const isLast = playback.index >= playback.total - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
      <button type="button" className="btn" onClick={playback.prev} disabled={playback.index === 0} style={btnStyle}>
        ◀
      </button>
      {playback.playing ? (
        <button type="button" className="btn" onClick={playback.pause} style={btnStyle}>
          ⏸ pausar
        </button>
      ) : (
        <button type="button" className="btn" onClick={playback.resume} style={btnStyle}>
          ▶ {isLast ? 'repetir' : 'reanudar'}
        </button>
      )}
      <button type="button" className="btn" onClick={playback.next} disabled={isLast} style={btnStyle}>
        ▶|
      </button>
      <button type="button" className="btn" onClick={playback.reset} style={btnStyle}>
        ↺ reiniciar
      </button>
      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        paso {playback.index + 1} / {playback.total}
      </span>
    </div>
  );
}
