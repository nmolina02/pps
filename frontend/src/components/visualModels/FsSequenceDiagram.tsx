import type { FsSequenceData } from './types';

const TOP = 44;
const STEP_H = 56;
const MARGIN_X = 90;

export function FsSequenceDiagram({ data }: { data: FsSequenceData }) {
  const { actors, steps } = data;
  const width = Math.max(420, MARGIN_X * 2 + (actors.length - 1) * 160);
  const height = TOP + steps.length * STEP_H + 30;
  const colX = (actor: string) => {
    const i = actors.indexOf(actor);
    if (actors.length === 1) return width / 2;
    return MARGIN_X + (i * (width - MARGIN_X * 2)) / (actors.length - 1);
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 460 }}>
      <defs>
        <marker id="fsd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-strong)" />
        </marker>
      </defs>

      {actors.map((actor) => (
        <g key={actor}>
          <line x1={colX(actor)} y1={TOP} x2={colX(actor)} y2={height - 10} stroke="var(--border)" strokeDasharray="3 4" />
          <rect x={colX(actor) - 46} y={8} width={92} height={28} rx={4} fill="var(--bg-panel-raised)" stroke="var(--border-strong)" />
          <text x={colX(actor)} y={22} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={11} fill="var(--text)">
            {actor}
          </text>
        </g>
      ))}

      {steps.map((s, i) => {
        const y = TOP + 30 + i * STEP_H;
        const fromX = colX(s.from);
        const toX = colX(s.to);
        if (s.from === s.to) {
          const loopW = 60;
          return (
            <g key={i}>
              <path
                d={`M ${fromX} ${y} C ${fromX + loopW} ${y}, ${fromX + loopW} ${y + 22}, ${fromX} ${y + 22}`}
                fill="none"
                stroke="var(--accent-strong)"
                strokeWidth={1.5}
                markerEnd="url(#fsd-arrow)"
              />
              {s.label && (
                <text x={fromX + loopW + 6} y={y + 11} className="mono" fontSize={10} fill="var(--text-dim)">
                  {s.label}
                </text>
              )}
            </g>
          );
        }
        return (
          <g key={i}>
            <line x1={fromX} y1={y} x2={toX} y2={y} stroke="var(--accent-strong)" strokeWidth={1.5} markerEnd="url(#fsd-arrow)" />
            {s.label && (
              <text
                x={(fromX + toX) / 2}
                y={y - 8}
                textAnchor="middle"
                className="mono"
                fontSize={11}
                fill="var(--text-dim)"
                style={{ paintOrder: 'stroke', stroke: 'var(--bg-panel)', strokeWidth: 4 }}
              >
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
