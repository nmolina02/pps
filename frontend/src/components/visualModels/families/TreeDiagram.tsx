import type { TreeFamilyData, TreeNodeData } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';

const LEAF_GAP = 110;
const ROW_H = 90;
const NODE_R = 28;

const STATE_COLOR: Record<string, string> = {
  zombie: 'var(--danger)',
  running: 'var(--ok)',
  fail: 'var(--danger)',
  free: 'var(--border-strong)',
};

interface Positioned {
  node: TreeNodeData;
  x: number;
  y: number;
  children: Positioned[];
}

function layout(node: TreeNodeData, depth: number, cursor: { x: number }): Positioned {
  const children = node.children ?? [];
  if (children.length === 0) {
    const x = cursor.x;
    cursor.x += LEAF_GAP;
    return { node, x, y: depth * ROW_H, children: [] };
  }
  const laidOut = children.map((c) => layout(c, depth + 1, cursor));
  const x = laidOut.reduce((sum, c) => sum + c.x, 0) / laidOut.length;
  return { node, x, y: depth * ROW_H, children: laidOut };
}

/** Recorre el árbol en el mismo orden (nodo, después hijos) que se usa tanto
 * para contar pasos como para decidir qué está "revelado" en un momento dado. */
function flatten(p: Positioned, out: Positioned[] = []): Positioned[] {
  out.push(p);
  p.children.forEach((c) => flatten(c, out));
  return out;
}

function countNodes(node: TreeNodeData): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}

function TreePanel({ title, root, visibleCount }: { title?: string; root: TreeNodeData; visibleCount?: number }) {
  const cursor = { x: 0 };
  const laidOut = layout(root, 0, cursor);
  const all = flatten(laidOut);
  const shown = visibleCount === undefined ? all : all.slice(0, visibleCount);
  const visibleIds = new Set(shown.map((p) => p.node.id));
  const width = Math.max(160, cursor.x - LEAF_GAP + NODE_R * 2 + 40);
  const height = (Math.max(...all.map((p) => p.y)) || 0) + ROW_H;
  const currentId = visibleCount !== undefined ? shown[shown.length - 1]?.node.id : undefined;

  return (
    <div>
      {title && (
        <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6, textAlign: 'center' }}>
          {title}
        </p>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 320 }}>
        {shown.map((p) =>
          p.children
            .filter((c) => visibleIds.has(c.node.id))
            .map((c, i) => (
              <line
                key={`${p.node.id}-${i}`}
                x1={p.x + NODE_R}
                y1={p.y + NODE_R}
                x2={c.x + NODE_R}
                y2={c.y}
                stroke="var(--border-strong)"
                strokeWidth={1.5}
              />
            )),
        )}
        {shown.map((p) => {
          const color = STATE_COLOR[p.node.state ?? ''];
          const isCurrent = p.node.id === currentId;
          return (
            <g key={p.node.id}>
              {isCurrent && <circle cx={p.x + NODE_R} cy={p.y + NODE_R} r={NODE_R + 6} fill="none" stroke="var(--accent-strong)" strokeWidth={1.5} opacity={0.6} />}
              <circle cx={p.x + NODE_R} cy={p.y + NODE_R} r={NODE_R} fill="var(--bg-inset)" stroke={color ?? 'var(--border-strong)'} strokeWidth={color ? 2 : 1.5} />
              <text
                x={p.x + NODE_R}
                y={p.y + NODE_R}
                textAnchor="middle"
                dominantBaseline="middle"
                className="mono"
                fontSize={11}
                fill={color ?? 'var(--text)'}
              >
                {p.node.label ?? p.node.id}
              </text>
              {p.node.state && (
                <text x={p.x + NODE_R} y={p.y + NODE_R * 2 + 12} textAnchor="middle" className="mono" fontSize={9} fill={color ?? 'var(--text-dim)'}>
                  {p.node.state}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Jerarquía padre/hijo (o cadena lineal, que es un caso degenerado de árbol con
 * un solo hijo por nivel). Soporta mostrar más de un árbol lado a lado para
 * comparaciones antes/después (fork/reparenting/copy-on-write). Con reproducción
 * paso a paso, los nodos se revelan de a uno (raíz primero); si hay más de un
 * árbol, primero se termina de armar el "antes" y recién después el "después",
 * en vez de mostrar ambos de entrada. */
export function TreeDiagram({ data }: { data: TreeFamilyData }) {
  const nodeCounts = data.trees.map((t) => countNodes(t.root));
  const totalSteps = nodeCounts.reduce((a, b) => a + b, 0);
  const playback = usePlayback(totalSteps);

  let consumed = 0;
  const revealedUpTo = playback.active ? playback.index + 1 : Infinity;

  return (
    <div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
        {data.trees.map((t, i) => {
          const start = consumed;
          consumed += nodeCounts[i];
          const visibleCount = playback.active ? Math.max(0, Math.min(nodeCounts[i], revealedUpTo - start)) : undefined;
          if (playback.active && visibleCount === 0) return null;
          return <TreePanel key={i} title={t.title} root={t.root} visibleCount={visibleCount} />;
        })}
      </div>
      <PlaybackControls playback={playback} />
      <DiagramNotes notes={data.notes} />
    </div>
  );
}
