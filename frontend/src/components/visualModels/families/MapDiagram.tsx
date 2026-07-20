import type { MapFamilyData } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';

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

/** Modo "range": barra vertical con rangos/segmentos etiquetados (mapas de
 * memoria, particiones, tablas de segmentos). Generaliza el viejo MemoryMapDiagram.
 * Con reproducción paso a paso, las regiones se revelan en el orden del JSON —
 * muestra cómo se fue ocupando/fragmentando la memoria. */
function RangeMap({ totalSize, unit = 'KB', regions = [] }: { totalSize: number; unit?: string; regions: NonNullable<MapFamilyData['regions']> }) {
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  const playback = usePlayback(regions.length);
  const visibleCount = playback.active ? playback.index + 1 : sorted.length;
  const visible = sorted.slice(0, visibleCount);
  const height = TOP + CHART_H + 16;
  const yFor = (addr: number) => TOP + (addr / totalSize) * CHART_H;

  const boundaries = new Set<number>([0, totalSize]);
  sorted.forEach((r) => {
    boundaries.add(r.start);
    boundaries.add(r.end);
  });

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" style={{ maxHeight: 440 }}>
        <rect x={BAR_X} y={TOP} width={BAR_W} height={CHART_H} fill="none" stroke="var(--border-strong)" strokeWidth={1.5} />
        {visible.map((r, i) => {
          const y = yFor(r.start);
          const h = ((r.end - r.start) / totalSize) * CHART_H;
          const color = KIND_COLOR[r.kind ?? 'process'] ?? KIND_COLOR.process;
          const isCurrent = playback.active && i === visible.length - 1;
          return (
            <g key={i}>
              <rect
                x={BAR_X}
                y={y}
                width={BAR_W}
                height={h}
                fill={color}
                opacity={0.7}
                stroke={isCurrent ? 'var(--accent-strong)' : 'var(--bg-panel)'}
                strokeWidth={isCurrent ? 2.5 : 1}
              />
              <text x={BAR_X + BAR_W / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={12} fill="var(--bg)">
                {r.label}
              </text>
              <text x={BAR_X + BAR_W + 14} y={y + h / 2} dominantBaseline="middle" className="mono" fontSize={10} fill="var(--text-dim)">
                {r.end - r.start} {unit}
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
      <PlaybackControls playback={playback} />
    </div>
  );
}

/** Modo "line": posiciones puntuales en una recta numérica, en el orden en que
 * se visitan (brazo de disco, referencias). Con reproducción paso a paso, el
 * cabezal se mueve punto a punto en el orden de atención — la simulación física
 * real del caso. */
function LineMap({ points, initial }: { points: NonNullable<MapFamilyData['points']>; initial?: number }) {
  const width = 640;
  const height = 200;
  const marginX = 50;
  const values = points.map((p) => p.value).concat(initial !== undefined ? [initial] : []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const xFor = (v: number) => marginX + ((v - min) / span) * (width - marginX * 2);
  const y = height / 2;

  const ordered = points.filter((p) => p.order !== undefined).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const fullPath = initial !== undefined ? [{ value: initial, label: 'inicio' } as (typeof points)[number], ...ordered] : ordered;

  const playback = usePlayback(fullPath.length);
  const path = playback.active ? fullPath.slice(0, playback.index + 1) : fullPath;
  const currentValue = playback.active ? fullPath[playback.index]?.value : undefined;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 260 }}>
      <defs>
        <marker id="ld-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-strong)" />
        </marker>
      </defs>
      <line x1={marginX} y1={y} x2={width - marginX} y2={y} stroke="var(--border-strong)" strokeWidth={1.5} />

      {path.length > 1 &&
        path.slice(0, -1).map((p, i) => {
          const next = path[i + 1];
          const curveUp = i % 2 === 0;
          const midY = y + (curveUp ? -46 : 46);
          return (
            <path
              key={i}
              d={`M ${xFor(p.value)} ${y} Q ${(xFor(p.value) + xFor(next.value)) / 2} ${midY} ${xFor(next.value)} ${y}`}
              fill="none"
              stroke="var(--accent-strong)"
              strokeWidth={1.5}
              markerEnd="url(#ld-arrow)"
            />
          );
        })}

      {(() => {
        // Cuando dos puntos quedan muy cerca en píxeles (valores numéricos
        // próximos), se escalona la etiqueta hacia arriba para que no se
        // superpongan los números.
        let lastX = -Infinity;
        let stagger = 0;
        const byValue = [...points].sort((a, b) => a.value - b.value);
        const labelOffset = new Map<number, number>();
        byValue.forEach((p) => {
          const x = xFor(p.value);
          stagger = x - lastX < 26 ? stagger + 1 : 0;
          labelOffset.set(p.value, stagger);
          lastX = x;
        });
        return points.map((p, i) => (
          <g key={i}>
            <circle cx={xFor(p.value)} cy={y} r={6} fill={p.kind === 'postergada' ? 'var(--danger)' : 'var(--accent)'} stroke="var(--bg-panel)" strokeWidth={2} />
            <text x={xFor(p.value)} y={y - 16 - (labelOffset.get(p.value) ?? 0) * 13} textAnchor="middle" className="mono" fontSize={11} fill="var(--text)">
              {p.value}
            </text>
            {p.order !== undefined && (
              <text x={xFor(p.value)} y={y + 24} textAnchor="middle" className="mono" fontSize={9} fill="var(--text-dim)">
                #{p.order}
              </text>
            )}
          </g>
        ));
      })()}

      {initial !== undefined && (
        <g>
          <circle cx={xFor(initial)} cy={y} r={7} fill="none" stroke="var(--ok)" strokeWidth={2} />
          <text x={xFor(initial)} y={y + 40} textAnchor="middle" className="mono" fontSize={9} fill="var(--ok)">
            cabezal inicial
          </text>
        </g>
      )}

      {currentValue !== undefined && (
        <circle cx={xFor(currentValue)} cy={y} r={11} fill="none" stroke="var(--accent-strong)" strokeWidth={2} opacity={0.7} />
      )}
      </svg>
      <PlaybackControls playback={playback} />
    </div>
  );
}

export function MapDiagram({ data }: { data: MapFamilyData }) {
  return (
    <div>
      {data.mode === 'line' ? (
        <LineMap points={data.points ?? []} initial={data.initial} />
      ) : (
        <RangeMap totalSize={data.totalSize ?? 100} unit={data.unit} regions={data.regions ?? []} />
      )}
      <DiagramNotes notes={data.notes} />
    </div>
  );
}
