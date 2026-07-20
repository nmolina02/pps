import type { GraphFamilyData } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';

const NODE_R = 30;
const RES_SIZE = 46;
const COL_GAP = 190;
const COL_START_X = 120;
const TOP = 60;
const ROW_H = 100;

const EDGE_COLOR: Record<string, string> = {
  assignment: 'var(--ok)',
  request: 'var(--accent)',
};

/** Grafo de nodos agrupados por categoría en columnas (proceso/recurso, filósofo/
 * tenedor, etc.) con aristas dirigidas; si `cyclePath` viene seteado, resalta esas
 * aristas para marcar un ciclo (deadlock). Generaliza el viejo ResourceGraphDiagram
 * a cualquier cantidad de categorías, no solo process/resource. Con reproducción
 * paso a paso, las aristas aparecen en el orden del JSON (asignaciones y después
 * solicitudes) y el ciclo se resalta recién en el último paso. */
export function GraphDiagram({ data }: { data: GraphFamilyData }) {
  const { nodes, edges, cyclePath, notes } = data;
  const hasCycleStep = Boolean(cyclePath && cyclePath.length > 1);
  const playback = usePlayback(edges.length + (hasCycleStep ? 1 : 0));
  const edgesShown = playback.active ? Math.min(playback.index + 1, edges.length) : edges.length;
  const cycleRevealed = !playback.active || playback.index >= edges.length;
  const visibleEdges = edges.slice(0, edgesShown);

  const categories: string[] = [];
  nodes.forEach((n) => {
    if (!categories.includes(n.category)) categories.push(n.category);
  });
  const byCategory = new Map<string, typeof nodes>();
  categories.forEach((c) => byCategory.set(c, nodes.filter((n) => n.category === c)));

  const width = COL_START_X * 2 + COL_GAP * Math.max(0, categories.length - 1) + 60;
  const maxRows = Math.max(1, ...categories.map((c) => byCategory.get(c)!.length));
  const height = TOP + maxRows * ROW_H + 20;

  const positions = new Map<string, { x: number; y: number }>();
  categories.forEach((c, ci) => {
    const colX = COL_START_X + ci * COL_GAP;
    byCategory.get(c)!.forEach((n, ri) => positions.set(n.id, { x: colX, y: TOP + ri * ROW_H }));
  });

  const isBoxNode = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return n ? categories.indexOf(n.category) % 2 === 1 : false;
  };

  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const groups = new Map<string, number>();
  edges.forEach((e) => groups.set(pairKey(e.from, e.to), (groups.get(pairKey(e.from, e.to)) ?? 0) + 1));
  const seenInGroup = new Map<string, number>();

  const cycleEdges = new Set<string>();
  if (cycleRevealed && cyclePath && cyclePath.length > 1) {
    for (let i = 0; i < cyclePath.length - 1; i++) cycleEdges.add(`${cyclePath[i]}>${cyclePath[i + 1]}`);
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 460 }}>
        <defs>
          <marker id="gd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
          <marker id="gd-arrow-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" />
          </marker>
        </defs>

        {categories.map((c, ci) => (
          <text key={c} x={COL_START_X + ci * COL_GAP} y={26} textAnchor="middle" className="mono" fontSize={11} fill="var(--text-dim)">
            {c}
          </text>
        ))}

        {visibleEdges.map((e, i) => {
          const from = positions.get(e.from);
          const to = positions.get(e.to);
          if (!from || !to) return null;

          const key = pairKey(e.from, e.to);
          const groupSize = groups.get(key) ?? 1;
          const idx = seenInGroup.get(key) ?? 0;
          seenInGroup.set(key, idx + 1);
          const isCycle = cycleEdges.has(`${e.from}>${e.to}`);

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.hypot(dx, dy) || 1;
          const ux = dx / dist;
          const uy = dy / dist;
          const fromR = isBoxNode(e.from) ? RES_SIZE / 2 : NODE_R;
          const toR = isBoxNode(e.to) ? RES_SIZE / 2 : NODE_R;
          const startX = from.x + ux * fromR;
          const startY = from.y + uy * fromR;
          const endX = to.x - ux * toR;
          const endY = to.y - uy * toR;

          const offset = (idx - (groupSize - 1) / 2) * 18;
          const midX = (startX + endX) / 2 - uy * offset;
          const midY = (startY + endY) / 2 + ux * offset;
          const path = offset === 0 ? `M ${startX} ${startY} L ${endX} ${endY}` : `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
          const color = isCycle ? 'var(--danger)' : (EDGE_COLOR[e.kind ?? ''] ?? 'var(--accent)');

          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={isCycle ? 2.5 : 1.75}
                strokeDasharray={e.kind === 'request' ? '5 4' : undefined}
                markerEnd={isCycle ? 'url(#gd-arrow-cycle)' : 'url(#gd-arrow)'}
              />
              {e.label && (
                <text x={midX} y={midY - 6} textAnchor="middle" className="mono" fontSize={10} fill="var(--text-dim)">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((n) => {
          const p = positions.get(n.id)!;
          if (isBoxNode(n.id)) {
            const dots = Math.max(1, n.instances ?? 1);
            return (
              <g key={n.id}>
                <rect
                  x={p.x - RES_SIZE / 2}
                  y={p.y - RES_SIZE / 2}
                  width={RES_SIZE}
                  height={RES_SIZE}
                  rx={6}
                  fill="var(--bg-inset)"
                  stroke="var(--border-strong)"
                  strokeWidth={1.5}
                />
                {Array.from({ length: dots }).map((_, i) => (
                  <circle key={i} cx={p.x - (dots - 1) * 5 + i * 10} cy={p.y + RES_SIZE / 2 - 10} r={2.5} fill="var(--text-dim)" />
                ))}
                <text x={p.x} y={p.y - 6} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={11} fill="var(--text)">
                  {n.label ?? n.id}
                </text>
              </g>
            );
          }
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={NODE_R} fill="var(--bg-inset)" stroke="var(--border-strong)" strokeWidth={1.5} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={12} fill="var(--text)">
                {n.label ?? n.id}
              </text>
            </g>
          );
        })}
      </svg>
      {cycleRevealed && cyclePath && cyclePath.length > 1 && (
        <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 4 }}>
          ciclo: {cyclePath.join(' → ')}
        </p>
      )}
      <PlaybackControls playback={playback} />
      <DiagramNotes notes={notes} />
    </div>
  );
}
