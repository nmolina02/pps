import type { GanttFamilyData, GanttSegment } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';

const LEFT = 96;
const TOP = 28;
const ROW_H = 42;
const ROW_GAP = 10;
const CHART_W = 520;
const SERIES_GAP = 30;
const COLORS = ['var(--accent)', 'var(--ok)', 'var(--danger)', 'var(--accent-strong)', 'var(--text-muted)'];

/** Una o varias series de barras de proceso en un eje temporal compartido (para
 * comparar, ej., FCFS vs. una alternativa). Generaliza el viejo CpuTimelineDiagram.
 * Con reproducción paso a paso, un cabezal de tiempo avanza por cada instante en
 * que algo cambia (arranca o termina un segmento) y las barras se completan hasta
 * ese punto — simula al scheduler corriendo. */
export function GanttDiagram({ data }: { data: GanttFamilyData }) {
  const { series, notes } = data;
  const allSegments = series.flatMap((s) => s.segments);
  const maxEnd = Math.max(1, ...allSegments.map((s) => s.end));
  const minStart = Math.min(0, ...allSegments.map((s) => s.start));
  const span = Math.max(1, maxEnd - minStart);
  const scale = CHART_W / span;
  const width = LEFT + CHART_W + 20;

  const distinctTimes = Array.from(new Set(allSegments.flatMap((s) => [s.start, s.end]))).sort((a, b) => a - b);
  const playback = usePlayback(distinctTimes.length);
  const playheadTime = playback.active ? distinctTimes[playback.index] : undefined;

  const tickStep = Math.max(1, Math.ceil(span / 12));
  const ticks: number[] = [];
  for (let t = Math.ceil(minStart / tickStep) * tickStep; t <= maxEnd; t += tickStep) ticks.push(t);

  let cursorY = TOP;
  const seriesLayout = series.map((s) => {
    const processes: string[] = [];
    s.segments.forEach((seg) => {
      if (!processes.includes(seg.process)) processes.push(seg.process);
    });
    const labelY = s.name ? cursorY + 12 : cursorY;
    if (s.name) cursorY += 20;
    const top = cursorY;
    cursorY += processes.length * (ROW_H + ROW_GAP);
    cursorY += SERIES_GAP;
    return { series: s, processes, top, labelY };
  });
  const height = cursorY - SERIES_GAP + 30;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 460 }}>
        {ticks.map((t) => (
          <line
            key={t}
            x1={LEFT + (t - minStart) * scale}
            y1={TOP - 6}
            x2={LEFT + (t - minStart) * scale}
            y2={height - 24}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
        ))}
        {ticks.map((t) => (
          <text key={`l-${t}`} x={LEFT + (t - minStart) * scale} y={height - 8} textAnchor="middle" className="mono" fontSize={10} fill="var(--text-dim)">
            {t}
          </text>
        ))}

        {seriesLayout.map(({ series: s, processes, top, labelY }, si) => {
          const rowY = (process: string) => top + processes.indexOf(process) * (ROW_H + ROW_GAP);
          return (
            <g key={si}>
              {s.name && (
                <text x={0} y={labelY} className="mono" fontSize={11} fontWeight={700} fill="var(--text-dim)">
                  {s.name}
                </text>
              )}
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
              {s.segments.map((seg: GanttSegment, i: number) => {
                const visibleEnd = playheadTime === undefined ? seg.end : Math.max(seg.start, Math.min(seg.end, playheadTime));
                if (playheadTime !== undefined && visibleEnd <= seg.start) return null;
                const x = LEFT + (seg.start - minStart) * scale;
                const w = Math.max(2, (visibleEnd - seg.start) * scale);
                const fullW = Math.max(2, (seg.end - seg.start) * scale);
                const y = rowY(seg.process);
                const color = COLORS[processes.indexOf(seg.process) % COLORS.length];
                const showLabel = playheadTime === undefined || visibleEnd >= seg.end;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={w} height={ROW_H} rx={4} fill={color} opacity={0.85} />
                    {showLabel && (
                      <text x={x + fullW / 2} y={y + ROW_H / 2} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={11} fill="var(--bg)">
                        {seg.label ?? `${seg.start}–${seg.end}`}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {playheadTime !== undefined && (
          <line
            x1={LEFT + (playheadTime - minStart) * scale}
            y1={TOP - 10}
            x2={LEFT + (playheadTime - minStart) * scale}
            y2={height - 20}
            stroke="var(--accent-strong)"
            strokeWidth={2}
          />
        )}
      </svg>
      <PlaybackControls playback={playback} />
      <DiagramNotes notes={notes} />
    </div>
  );
}
