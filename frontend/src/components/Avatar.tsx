interface Glyph {
  label: string;
  color: string;
  path: string;
}

// Iconos geométricos simples, temáticos con SO (proceso, disco, memoria, red,
// incidente, seguridad, planificador, kernel), cada uno con su propio acento.
export const AVATARS: Glyph[] = [
  { label: 'terminal', color: '#ffb020', path: 'M6 9 L11 16 L6 23 M15 23 H26' },
  { label: 'proceso', color: '#37e2a4', path: 'M16 6 V14 M16 14 L8 24 M16 14 L24 24' },
  { label: 'disco', color: '#5aa9ff', path: 'M6 10 H26 M6 16 H26 M6 22 H26' },
  { label: 'memoria', color: '#c993ff', path: 'M7 7 H15 V15 H7 Z M17 7 H25 V15 H17 Z M7 17 H15 V25 H7 Z M17 17 H25 V25 H17 Z' },
  { label: 'red', color: '#5aa9ff', path: 'M8 24 L16 8 L24 24 M8 24 H24 M12 24 V17 M20 24 V17' },
  { label: 'incidente', color: '#ff6b6b', path: 'M16 6 L27 25 H5 Z M16 13 V19 M16 22 V22.5' },
  { label: 'escudo', color: '#37e2a4', path: 'M16 5 L26 9 V16 C26 22 21 26 16 27 C11 26 6 22 6 16 V9 Z' },
  { label: 'ciclo', color: '#ffb020', path: 'M9 12 A8 8 0 1 1 8 18 M9 12 V6 M9 12 H15' },
];

export function Avatar({
  id,
  size = 40,
  selected = false,
}: {
  id: number;
  size?: number;
  selected?: boolean;
}) {
  const glyph = AVATARS[id] ?? AVATARS[0];
  return (
    <div
      title={glyph.label}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-inset)',
        border: `1.5px solid ${selected ? glyph.color : 'var(--border)'}`,
        boxShadow: selected ? `0 0 0 3px ${glyph.color}22` : 'none',
        flexShrink: 0,
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 32 32" fill="none">
        <path d={glyph.path} stroke={glyph.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 10 }}>
      {AVATARS.map((glyph, id) => (
        <button
          key={glyph.label}
          type="button"
          onClick={() => onChange(id)}
          aria-label={glyph.label}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Avatar id={id} size={56} selected={value === id} />
        </button>
      ))}
    </div>
  );
}
