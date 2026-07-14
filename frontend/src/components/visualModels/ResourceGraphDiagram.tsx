import type { ResourceGraphData } from './types';

const WIDTH = 640;
const NODE_R = 30;
const RES_SIZE = 46;
const COL_PROCESS_X = 130;
const COL_RESOURCE_X = 510;
const TOP = 60;
const ROW_H = 100;

export function ResourceGraphDiagram({ data }: { data: ResourceGraphData }) {
  const processes = data.nodes.filter((n) => n.type === 'process');
  const resources = data.nodes.filter((n) => n.type === 'resource');
  const height = TOP + Math.max(processes.length, resources.length) * ROW_H + 20;

  const positions = new Map<string, { x: number; y: number }>();
  processes.forEach((n, i) => positions.set(n.id, { x: COL_PROCESS_X, y: TOP + i * ROW_H }));
  resources.forEach((n, i) => positions.set(n.id, { x: COL_RESOURCE_X, y: TOP + i * ROW_H }));

  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const groups = new Map<string, number>();
  data.edges.forEach((e) => {
    const key = pairKey(e.from, e.to);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  const seenInGroup = new Map<string, number>();

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" style={{ maxHeight: 460 }}>
      <defs>
        <marker id="rgd-assignment" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ok)" />
        </marker>
        <marker id="rgd-request" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
      </defs>

      <text x={COL_PROCESS_X} y={26} textAnchor="middle" className="mono" fontSize={11} fill="var(--text-dim)">
        procesos
      </text>
      <text x={COL_RESOURCE_X} y={26} textAnchor="middle" className="mono" fontSize={11} fill="var(--text-dim)">
        recursos
      </text>

      {data.edges.map((e, i) => {
        const from = positions.get(e.from);
        const to = positions.get(e.to);
        if (!from || !to) return null;

        const key = pairKey(e.from, e.to);
        const groupSize = groups.get(key) ?? 1;
        const idx = seenInGroup.get(key) ?? 0;
        seenInGroup.set(key, idx + 1);

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const fromR = processes.some((p) => p.id === e.from) ? NODE_R : RES_SIZE / 2;
        const toR = processes.some((p) => p.id === e.to) ? NODE_R : RES_SIZE / 2;
        const startX = from.x + ux * fromR;
        const startY = from.y + uy * fromR;
        const endX = to.x - ux * toR;
        const endY = to.y - uy * toR;

        const offset = (idx - (groupSize - 1) / 2) * 18;
        const midX = (startX + endX) / 2 - uy * offset;
        const midY = (startY + endY) / 2 + ux * offset;
        const path = offset === 0 ? `M ${startX} ${startY} L ${endX} ${endY}` : `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
        const isAssignment = e.kind === 'assignment';

        return (
          <g key={i}>
            <path
              d={path}
              fill="none"
              stroke={isAssignment ? 'var(--ok)' : 'var(--accent)'}
              strokeWidth={1.75}
              strokeDasharray={isAssignment ? undefined : '5 4'}
              markerEnd={isAssignment ? 'url(#rgd-assignment)' : 'url(#rgd-request)'}
            />
          </g>
        );
      })}

      {processes.map((n) => {
        const p = positions.get(n.id)!;
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={NODE_R} fill="var(--bg-inset)" stroke="var(--border-strong)" strokeWidth={1.5} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="mono" fontSize={12} fill="var(--text)">
              {n.label ?? n.id}
            </text>
          </g>
        );
      })}

      {resources.map((n) => {
        const p = positions.get(n.id)!;
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
      })}
    </svg>
  );
}
