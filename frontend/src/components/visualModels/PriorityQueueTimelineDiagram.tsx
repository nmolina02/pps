import type { PriorityQueueTimelineData } from './types';

const WIDTH = 640;
const TOP = 110;
const ROW_H = 44;
const BAR_MAX_H = 36;
const BAR_TOP = 40;

const TIPO_COLOR: Record<string, string> = {
  critico: 'var(--danger)',
  mantenimiento: 'var(--text-muted)',
};

export function PriorityQueueTimelineDiagram({ data }: { data: PriorityQueueTimelineData }) {
  const { politica, procesos, eventos, problema, correccion } = data;
  const height = TOP + eventos.length * ROW_H + 16;
  const maxPriority = Math.max(10, ...procesos.map((p) => p.prioridad_inicial));
  const colW = WIDTH / procesos.length;

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" style={{ maxHeight: 520 }}>
        {politica && (
          <text x={0} y={14} className="mono" fontSize={11} fill="var(--text-dim)">
            política: {politica}
          </text>
        )}

        {procesos.map((p, i) => {
          const x = i * colW + 10;
          const barW = colW - 20;
          const color = TIPO_COLOR[p.tipo ?? ''] ?? 'var(--accent)';
          const barH = (p.prioridad_inicial / maxPriority) * BAR_MAX_H;
          return (
            <g key={p.id}>
              <text x={x + barW / 2} y={30} textAnchor="middle" className="mono" fontSize={12} fontWeight={700} fill="var(--text)">
                {p.id}
              </text>
              <rect x={x} y={BAR_TOP} width={barW} height={BAR_MAX_H} fill="none" stroke="var(--border)" strokeWidth={1} rx={3} />
              <rect
                x={x}
                y={BAR_TOP + (BAR_MAX_H - barH)}
                width={barW}
                height={barH}
                rx={3}
                fill={color}
                opacity={0.75}
              />
              <text x={x + barW / 2} y={BAR_TOP + BAR_MAX_H + 15} textAnchor="middle" className="mono" fontSize={10} fill={color}>
                {p.tipo ?? '—'} · prio {p.prioridad_inicial}
              </text>
            </g>
          );
        })}

        <line x1={70} y1={TOP} x2={70} y2={height - 6} stroke="var(--border)" strokeWidth={1.5} />
        {eventos.map((e, i) => {
          const y = TOP + i * ROW_H + ROW_H / 2;
          const flagged = /desplaza|cr[ií]tica/i.test(e.evento);
          return (
            <g key={i}>
              <circle cx={70} cy={y} r={5} fill={flagged ? 'var(--danger)' : 'var(--accent)'} stroke="var(--bg-panel)" strokeWidth={2} />
              <text x={50} y={y} textAnchor="end" dominantBaseline="middle" className="mono" fontSize={11} fill="var(--text-dim)">
                t={e.t}
              </text>
              <text x={90} y={y} dominantBaseline="middle" fontSize={12} fill="var(--text)">
                {e.evento}
              </text>
            </g>
          );
        })}
      </svg>

      {(problema || correccion) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          {problema && (
            <div
              style={{
                flex: '1 1 240px',
                padding: '10px 14px',
                borderRadius: 3,
                border: '1px solid var(--danger)',
                background: 'var(--danger-soft)',
              }}
            >
              <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--danger)', marginBottom: 4 }}>
                problema
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{problema}</p>
            </div>
          )}
          {correccion && (
            <div
              style={{
                flex: '1 1 240px',
                padding: '10px 14px',
                borderRadius: 3,
                border: '1px solid var(--ok)',
                background: 'var(--ok-soft)',
              }}
            >
              <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--ok)', marginBottom: 4 }}>
                corrección · {correccion.tecnica}
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{correccion.regla}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
