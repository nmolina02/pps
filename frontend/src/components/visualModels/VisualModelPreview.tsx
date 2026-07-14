import type { VisualModel } from '../../api/types';
import { VISUAL_MODEL_LABELS } from '../../api/types';
import {
  isCpuTimelineData,
  isFsSequenceData,
  isMemoryMapData,
  isPriorityQueueTimelineData,
  isProcessStatesData,
  isResourceGraphData,
} from './types';
import { ProcessStatesDiagram } from './ProcessStatesDiagram';
import { CpuTimelineDiagram } from './CpuTimelineDiagram';
import { ResourceGraphDiagram } from './ResourceGraphDiagram';
import { MemoryMapDiagram } from './MemoryMapDiagram';
import { FsSequenceDiagram } from './FsSequenceDiagram';
import { PriorityQueueTimelineDiagram } from './PriorityQueueTimelineDiagram';

/** Matchea el JSON contra los esquemas conocidos, en orden, y devuelve el
 * primero que calce — no hay un campo "tipo" que elegir a mano: cada
 * esquema tiene nombres de campos lo bastante distintos entre sí (states/
 * transitions vs. segments vs. nodes/edges vs. regions vs. actors/steps vs.
 * procesos/eventos) como para que el match sea inequívoco en la práctica. */
function matchDiagram(data: unknown): { kind: VisualModel; node: React.ReactNode } | null {
  if (isProcessStatesData(data)) return { kind: 'process_states', node: <ProcessStatesDiagram data={data} /> };
  if (isCpuTimelineData(data)) return { kind: 'cpu_timeline', node: <CpuTimelineDiagram data={data} /> };
  if (isResourceGraphData(data)) return { kind: 'resource_graph', node: <ResourceGraphDiagram data={data} /> };
  if (isMemoryMapData(data)) return { kind: 'memory_map', node: <MemoryMapDiagram data={data} /> };
  if (isFsSequenceData(data)) return { kind: 'fs_sequence', node: <FsSequenceDiagram data={data} /> };
  if (isPriorityQueueTimelineData(data)) {
    return { kind: 'priority_queue_timeline', node: <PriorityQueueTimelineDiagram data={data} /> };
  }
  return null;
}

/** Vista para el alumno: si no hay datos o no matchean ningún esquema
 * conocido, no se muestra nada — no tiene sentido exponer un error de JSON acá. */
export function VisualModelPreview({ data }: { data: unknown }) {
  const match = matchDiagram(data);
  if (!match) return null;
  return (
    <div className="panel" style={{ padding: '18px 20px', overflowX: 'auto' }}>
      {match.node}
    </div>
  );
}

/** Vista para el docente en el editor: además de dibujar, dice qué tipo de
 * gráfico matcheó (no lo elige el docente, se detecta solo) y por qué no
 * hay nada dibujado todavía cuando corresponde (vacío vs. sin match). */
export function VisualModelEditorPreview({ data }: { data: unknown }) {
  const isEmpty = data === null || data === undefined || (typeof data === 'object' && Object.keys(data as object).length === 0);
  const match = isEmpty ? null : matchDiagram(data);

  return (
    <div className="panel" style={{ padding: '18px 20px', overflowX: 'auto' }}>
      {match ? (
        <>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 12 }}>
            se detectó: {VISUAL_MODEL_LABELS[match.kind]}
          </p>
          {match.node}
        </>
      ) : (
        <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          {isEmpty
            ? 'Sin datos todavía — completá el JSON de arriba (o usá "cargar ejemplo") para previsualizar el gráfico.'
            : 'El JSON no tiene la forma de ningún modelo visual conocido, así que no se puede dibujar.'}
        </p>
      )}
    </div>
  );
}
