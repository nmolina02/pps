import type { StateFamilyData } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';

const WIDTH = 640;
const HEIGHT = 380;
const CX = WIDTH / 2;
const CY = HEIGHT / 2 - 6;
const NODE_R = 38;

/** Estados en círculo con transiciones dirigidas; una transición con `invalid`
 * se dibuja punteada en rojo (ej. "Ready->Blocked no es válida"). Generaliza el
 * viejo ProcessStatesDiagram. Con reproducción paso a paso, las transiciones se
 * revelan en el orden dado y la actual queda resaltada, mostrando el recorrido. */
export function StateDiagram({ data }: { data: StateFamilyData }) {
  const { states, transitions, highlight = [], notes } = data;
  const playback = usePlayback(transitions.length);
  const visibleCount = playback.active ? playback.index + 1 : transitions.length;
  const visibleTransitions = transitions.slice(0, visibleCount);
  const current = playback.active ? transitions[playback.index] : undefined;
  const ringR = Math.min(CX, CY) - NODE_R - 20;

  const positions = new Map<string, { x: number; y: number }>();
  states.forEach((s, i) => {
    const angle = (i / states.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(s.id, { x: CX + ringR * Math.cos(angle), y: CY + ringR * Math.sin(angle) });
  });

  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const groups = new Map<string, number>();
  transitions.forEach((t) => groups.set(pairKey(t.from, t.to), (groups.get(pairKey(t.from, t.to)) ?? 0) + 1));
  const seenInGroup = new Map<string, number>();

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ maxHeight: 420 }}>
        <defs>
          <marker id="sd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
          </marker>
          <marker id="sd-arrow-invalid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" />
          </marker>
        </defs>

        {visibleTransitions.map((t, i) => {
          const from = positions.get(t.from);
          const to = positions.get(t.to);
          if (!from || !to) return null;

          const key = pairKey(t.from, t.to);
          const groupSize = groups.get(key) ?? 1;
          const idx = seenInGroup.get(key) ?? 0;
          seenInGroup.set(key, idx + 1);
          const isSelfLoop = t.from === t.to;
          const isCurrent = t === current;
          const color = t.invalid ? 'var(--danger)' : isCurrent ? 'var(--accent-strong)' : 'var(--text-muted)';
          const marker = t.invalid ? 'url(#sd-arrow-invalid)' : 'url(#sd-arrow)';
          const strokeW = t.invalid ? 2 : isCurrent ? 2.5 : 1.5;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.hypot(dx, dy) || 1;
          const ux = dx / dist;
          const uy = dy / dist;
          const startX = from.x + ux * NODE_R;
          const startY = from.y + uy * NODE_R;
          const endX = to.x - ux * NODE_R;
          const endY = to.y - uy * NODE_R;

          if (isSelfLoop) {
            const loopY = from.y - NODE_R - 26;
            const path = `M ${from.x - 14} ${from.y - NODE_R + 6} C ${from.x - 40} ${loopY}, ${from.x + 40} ${loopY}, ${from.x + 14} ${from.y - NODE_R + 6}`;
            return (
              <g key={i}>
                <path d={path} fill="none" stroke={color} strokeWidth={strokeW} markerEnd={marker} />
                {t.label && (
                  <text x={from.x} y={loopY - 6} textAnchor="middle" className="mono" fontSize={11} fill="var(--text-dim)">
                    {t.label}
                  </text>
                )}
              </g>
            );
          }

          const offset = (idx - (groupSize - 1) / 2) * 26;
          const midX = (startX + endX) / 2 - uy * offset;
          const midY = (startY + endY) / 2 + ux * offset;
          const path = offset === 0 ? `M ${startX} ${startY} L ${endX} ${endY}` : `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;

          return (
            <g key={i}>
              <path d={path} fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray={t.invalid ? '5 4' : undefined} markerEnd={marker} />
              {t.label && (
                <text
                  x={midX}
                  y={midY - 6}
                  textAnchor="middle"
                  className="mono"
                  fontSize={11}
                  fill={t.invalid ? 'var(--danger)' : 'var(--text-dim)'}
                  style={{ paintOrder: 'stroke', stroke: 'var(--bg-panel)', strokeWidth: 4 }}
                >
                  {t.label}
                </text>
              )}
            </g>
          );
        })}

        {states.map((s) => {
          const p = positions.get(s.id)!;
          const isHighlighted = highlight.includes(s.id);
          const isCurrentEndpoint = current && (s.id === current.from || s.id === current.to);
          return (
            <g key={s.id}>
              {isCurrentEndpoint && <circle cx={p.x} cy={p.y} r={NODE_R + 6} fill="none" stroke="var(--accent-strong)" strokeWidth={1.5} opacity={0.6} />}
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                fill={isHighlighted ? 'var(--accent-soft)' : 'var(--bg-inset)'}
                stroke={isHighlighted ? 'var(--accent-strong)' : 'var(--border-strong)'}
                strokeWidth={isHighlighted ? 2 : 1.5}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="mono"
                fontSize={12}
                fill={isHighlighted ? 'var(--accent-strong)' : 'var(--text)'}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      <PlaybackControls playback={playback} />
      <DiagramNotes notes={notes} />
    </div>
  );
}
