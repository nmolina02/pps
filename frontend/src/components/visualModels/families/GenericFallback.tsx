import type { NoteEntry } from '../registry/types';

/** Footer compartido por todas las familias: muestra los campos del JSON que el
 * adaptador no dibujó "a medida" (correccion, alternativas, riesgo, concepto, ...)
 * así el docente ve que sus datos no se perdieron aunque el dibujo no los use. */
export function DiagramNotes({ notes }: { notes?: NoteEntry[] }) {
  if (!notes || notes.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
      {notes.map((n) => (
        <div
          key={n.label}
          style={{
            flex: '1 1 200px',
            padding: '8px 12px',
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: 'var(--bg-inset)',
          }}
        >
          <p className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 3 }}>
            {n.label}
          </p>
          <NoteValue value={n.value} />
        </div>
      ))}
    </div>
  );
}

function NoteValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
        {value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')}
      </p>
    );
  }
  if (value !== null && typeof value === 'object') {
    return (
      <p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
        {Object.entries(value as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
          .join(' · ')}
      </p>
    );
  }
  return <p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{String(value)}</p>;
}

/** Último recurso: si nada matchea ni se puede inferir una forma, se muestra el
 * JSON como un árbol clave/valor legible en vez de dejar la previsualización en
 * blanco. */
export function GenericFallback({ data }: { data: unknown }) {
  return (
    <div>
      <div style={{ fontSize: '0.86rem' }}>
        <JsonNode value={data} depth={0} />
      </div>
    </div>
  );
}

function JsonNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: 'var(--text-dim)' }}>[]</span>;
    return (
      <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
        {value.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              [{i}]
            </span>
            <JsonNode value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: 'var(--text-dim)' }}>{'{}'}</span>;
    return (
      <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ padding: '2px 0' }}>
            <span className="mono" style={{ color: 'var(--accent-strong)', fontSize: '0.8rem' }}>
              {k}:
            </span>{' '}
            <JsonNode value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  return <span style={{ color: 'var(--text)' }}>{String(value)}</span>;
}
