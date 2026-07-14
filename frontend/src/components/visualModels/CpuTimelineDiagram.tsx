import type { CpuTimelineData } from './types';

const LEFT = 96;
const TOP = 28;
const ROW_H = 42;
const ROW_GAP = 10;
const CHART_W = 520;
const COLORS = ['var(--accent)', 'var(--ok)', 'var(--danger)', 'var(--accent-strong)', 'var(--text-muted)'];

export function CpuTimelineDiagram({ data }: { data: CpuTimelineData }) {
  const { segments } = data;
  const processes: string[] = [];
  segments.forEach((s) => {
    if (!processes.includes(s.process)) processes.push(s.process);
  });

  const maxEnd = Math.max(...segments.map((s) => s.end));
  const minStart = Math.min(0, ...segments.map((s) => s.start));
  const span = Math.max(1, maxEnd - minStart);
  const scale = CHART_W / span;
  const height = TOP + processes.length * (ROW_H + ROW_GAP) + 30;
  const width = LEFT + CHART_W + 20;

  const tickStep = Math.max(1, Math.ceil(span / 12));
  const ticks: number[] = [];
  for (let t = Math.ceil(minStart / tickStep) * tickStep; t <= maxEnd; t += tickStep) ticks.push(t);

  const rowY = (process: string) => TOP + processes.indexOf(process) * (ROW_H + ROW_GAP);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 340 }}>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={LEFT + (t - minStart) * scale}
            y1={TOP - 6}
            x2={LEFT + (t - minStart) * scale}
            y2={height - 24}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <text x={LEFT + (t - minStart) * scale} y={height - 8} textAnchor="middle" className="mono" fontSize={10} fill="var(--text-dim)">
            {t}
          </text>
        </g>
      ))}

      {processes.map((process) => (
        <text
          key={process}
          x={LEFT - 12}
          y={rowY(process) + ROW_H / 2}
          textAnchor="end"
          dominantBaseline="middle"
          className="mono"
          fontSize={12}
          fill="var(--text)"
        >
          {process}
        </text>
      ))}

      {segments.map((s, i) => {
        const x = LEFT + (s.start - minStart) * scale;
        const w = Math.max(2, (s.end - s.start) * scale);
        const y = rowY(s.process);
        const color = COLORS[processes.indexOf(s.process) % COLORS.length];
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={ROW_H} rx={4} fill={color} opacity={0.85} />
            <text x={x + w / 2} y={y + ROW_H / 2} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={11} fill="var(--bg)">
              {s.label ?? `${s.start}–${s.end}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
