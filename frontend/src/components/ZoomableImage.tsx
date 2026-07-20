import { useState } from 'react';
import type { CSSProperties } from 'react';

/** Miniatura clickeable que abre la imagen en grande sobre un overlay fijo,
 * cerrable tocando afuera. Mismo patrón que ya existía (sin extraer) en
 * TallyBars de HostDashboardPage — centralizado acá para reusarlo en
 * cualquier lugar que muestre una imagen clickeable (enunciados, opciones). */
export function ZoomableImage({ src, alt = '', thumbStyle }: { src: string; alt?: string; thumbStyle?: CSSProperties }) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setZoomed(true)}
        style={{ cursor: 'zoom-in', ...thumbStyle }}
      />

      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'zoom-out',
            padding: 32,
          }}
        >
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 6,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </>
  );
}
