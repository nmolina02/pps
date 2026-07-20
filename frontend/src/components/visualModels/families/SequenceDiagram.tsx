import type { SequenceFamilyData } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';

const LEFT = 30;
const TOP = 20;
const STEP_H = 58;
const ACTOR_X = 70;
const LABEL_X = 110;

const STATE_COLOR: Record<string, string> = {
  ok: 'var(--ok)',
  warn: 'var(--accent)',
  fail: 'var(--danger)',
  neutral: 'var(--text-muted)',
};

/** Lista vertical de pasos/eventos ordenados en el tiempo, cada uno con actor y
 * estado opcional (ok/warn/fail); soporta marcar un paso puntual como punto de
 * falla (`failIndex`) y dibujar una flecha de "se repite" para secuencias
 * cíclicas sin progreso (`loop`, ej. livelock). Cubre la gran mayoría de los
 * modelos visuales del banco de casos: cualquier `eventos`/`pasos`/`secuencia`.
 * Con "reproducir paso a paso" activo, revela los pasos uno por uno en vez de
 * mostrarlos todos juntos — es la familia donde más importa el orden causal. */
export function SequenceDiagram({ data }: { data: SequenceFamilyData }) {
  const { steps, loop, failIndex, notes } = data;
  const playback = usePlayback(steps.length);
  const visibleCount = playback.active ? playback.index + 1 : steps.length;
  const visibleSteps = steps.slice(0, visibleCount);

  const hasActors = steps.some((s) => s.actor);
  const hasTime = steps.some((s) => s.time !== undefined);
  const width = 640;
  const height = TOP + steps.length * STEP_H + (loop ? 46 : 16);
  const textX = LABEL_X + (hasActors ? 90 : 0) + (hasTime ? 50 : 0);
  const showLoop = loop && visibleCount >= steps.length && steps.length > 0;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 560 }}>
        <defs>
          <marker id="seq-loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" />
          </marker>
        </defs>

        {visibleSteps.length > 1 && (
          <line
            x1={ACTOR_X}
            y1={TOP + STEP_H / 2}
            x2={ACTOR_X}
            y2={TOP + (visibleSteps.length - 1) * STEP_H + STEP_H / 2}
            stroke="var(--border)"
            strokeWidth={1.5}
          />
        )}

        {visibleSteps.map((s, i) => {
          const y = TOP + i * STEP_H + STEP_H / 2;
          const isFail = i === failIndex;
          const isCurrent = playback.active && i === playback.index;
          const color = isFail ? 'var(--danger)' : STATE_COLOR[s.state ?? 'neutral'] ?? 'var(--accent)';
          return (
            <g key={i}>
              {isCurrent && <circle cx={ACTOR_X} cy={y} r={13} fill="none" stroke="var(--accent-strong)" strokeWidth={1.5} opacity={0.6} />}
              <circle cx={ACTOR_X} cy={y} r={isFail ? 9 : 7} fill={color} stroke="var(--bg-panel)" strokeWidth={2} />
              {hasTime && (
                <text x={LEFT} y={y} dominantBaseline="middle" className="mono" fontSize={10} fill="var(--text-dim)">
                  {s.time !== undefined ? `t=${s.time}` : ''}
                </text>
              )}
              {hasActors && s.actor && (
                <text x={ACTOR_X + 16} y={y} dominantBaseline="middle" className="mono" fontSize={11} fontWeight={700} fill="var(--text-dim)">
                  {s.actor}
                </text>
              )}
              <text x={textX} y={y} dominantBaseline="middle" fontSize={13} fill={isFail ? 'var(--danger)' : 'var(--text)'}>
                {s.label}
              </text>
            </g>
          );
        })}

        {showLoop && (
          <g>
            {/* Bracket rectangular por el margen derecho: sale/entra en vertical
                justo debajo/encima del círculo (a la izquierda del texto), así
                nunca cruza las etiquetas de los pasos. */}
            <path
              d={`M ${ACTOR_X} ${TOP + (steps.length - 1) * STEP_H + STEP_H / 2} L ${ACTOR_X} ${TOP + (steps.length - 1) * STEP_H + STEP_H / 2 + 22} L ${width - 40} ${TOP + (steps.length - 1) * STEP_H + STEP_H / 2 + 22} L ${width - 40} ${TOP + STEP_H / 2 - 22} L ${ACTOR_X} ${TOP + STEP_H / 2 - 22} L ${ACTOR_X} ${TOP + STEP_H / 2}`}
              fill="none"
              stroke="var(--danger)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              markerEnd="url(#seq-loop-arrow)"
            />
            <text x={width - 44} y={TOP + ((steps.length - 1) * STEP_H) / 2 + STEP_H / 2} textAnchor="end" className="mono" fontSize={10} fill="var(--danger)">
              se repite, sin progreso
            </text>
          </g>
        )}
      </svg>
      <PlaybackControls playback={playback} />
      <DiagramNotes notes={notes} />
    </div>
  );
}
