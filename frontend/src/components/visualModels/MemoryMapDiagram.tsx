import type { MemoryMapData } from './types';

const BAR_X = 120;
const BAR_W = 140;
const TOP = 16;
const CHART_H = 380;
const WIDTH = 420;

const KIND_COLOR: Record<string, string> = {
  system: 'var(--danger)',
  process: 'var(--accent)',
  free: 'var(--border-strong)',
};

export function MemoryMapDiagram({ data }: { data: MemoryMapData }) {
  const { totalSize, unit = 'KB', regions } = data;
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  const height = TOP + CHART_H + 16;
  const yFor = (addr: number) => TOP + (addr / totalSize) * CHART_H;

  const boundaries = new Set<number>([0, totalSize]);
  sorted.forEach((r) => {
    boundaries.add(r.start);
    boundaries.add(r.start + r.size);
  });

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" style={{ maxHeight: 440 }}>
      <rect x={BAR_X} y={TOP} width={BAR_W} height={CHART_H} fill="none" stroke="var(--border-strong)" strokeWidth={1.5} />

      {sorted.map((r, i) => {
        const y = yFor(r.start);
        const h = (r.size / totalSize) * CHART_H;
        const color = KIND_COLOR[r.kind ?? 'process'] ?? KIND_COLOR.process;
        return (
          <g key={i}>
            <rect x={BAR_X} y={y} width={BAR_W} height={h} fill={color} opacity={0.7} stroke="var(--bg-panel)" strokeWidth={1} />
            <text x={BAR_X + BAR_W / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={12} fill="var(--bg)">
              {r.label}
            </text>
            <text x={BAR_X + BAR_W + 14} y={y + h / 2} dominantBaseline="middle" className="mono" fontSize={10} fill="var(--text-dim)">
              {r.size} {unit}
            </text>
          </g>
        );
      })}

      {Array.from(boundaries)
        .sort((a, b) => a - b)
        .map((addr) => (
          <g key={addr}>
            <line x1={BAR_X - 6} y1={yFor(addr)} x2={BAR_X} y2={yFor(addr)} stroke="var(--text-dim)" strokeWidth={1} />
            <text x={BAR_X - 10} y={yFor(addr)} textAnchor="end" dominantBaseline="middle" className="mono" fontSize={9} fill="var(--text-dim)">
              {addr}
            </text>
          </g>
        ))}
    </svg>
  );
}
