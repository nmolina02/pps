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
import { GraphDiagram } from './families/GraphDiagram';
import { StateDiagram } from './families/StateDiagram';
import { GanttDiagram } from './families/GanttDiagram';
import { MapDiagram } from './families/MapDiagram';
import { SequenceDiagram } from './families/SequenceDiagram';
import { TableDiagram } from './families/TableDiagram';
import { TreeDiagram } from './families/TreeDiagram';
import { GenericFallback } from './families/GenericFallback';
import { REGISTRY, sniffShape } from './registry';
import type { FamilyResult } from './registry/types';

/** Matchea el JSON legacy (sin campo `tipo`) contra los 6 esquemas originales,
 * en orden — se mantiene intacto para no romper casos ya guardados en la base
 * de datos antes de que el motor usara un discriminador `tipo` explícito. Se
 * dibuja con los mismos adaptadores+familias que cualquier `tipo` registrado
 * (en vez de componentes legacy aparte) para que la reproducción paso a paso
 * también funcione acá, sin duplicar lógica. */
function matchLegacy(data: unknown): { kind: VisualModel; node: React.ReactNode } | null {
  if (isProcessStatesData(data)) return { kind: 'process_states', node: renderFamily(REGISTRY.process_states.adapt(data)) };
  if (isCpuTimelineData(data)) return { kind: 'cpu_timeline', node: renderFamily(REGISTRY.cpu_timeline.adapt(data)) };
  if (isResourceGraphData(data)) return { kind: 'resource_graph', node: renderFamily(REGISTRY.resource_graph.adapt(data)) };
  if (isMemoryMapData(data)) return { kind: 'memory_map', node: renderFamily(REGISTRY.memory_map.adapt(data)) };
  if (isFsSequenceData(data)) return { kind: 'fs_sequence', node: renderFamily(REGISTRY.fs_sequence.adapt(data)) };
  if (isPriorityQueueTimelineData(data)) {
    return { kind: 'priority_queue_timeline', node: renderFamily(REGISTRY.priority_queue_timeline.adapt(data)) };
  }
  return null;
}

function renderFamily(result: FamilyResult): React.ReactNode {
  switch (result.family) {
    case 'graph':
      return <GraphDiagram data={result.props} />;
    case 'state':
      return <StateDiagram data={result.props} />;
    case 'gantt':
      return <GanttDiagram data={result.props} />;
    case 'map':
      return <MapDiagram data={result.props} />;
    case 'sequence':
      return <SequenceDiagram data={result.props} />;
    case 'table':
      return <TableDiagram data={result.props} />;
    case 'tree':
      return <TreeDiagram data={result.props} />;
    default:
      return null;
  }
}

type Resolution =
  | { path: 'registered'; tipo: string; node: React.ReactNode }
  | { path: 'inferred'; tipo: string; node: React.ReactNode }
  | { path: 'legacy'; kind: VisualModel; node: React.ReactNode }
  | { path: 'fallback'; node: React.ReactNode };

/** Resuelve cualquier JSON de modelo visual, en cascada, sin dejar nunca la
 * previsualización en blanco:
 *  1. `data.tipo` está en el registro → se dibuja con su adaptador curado.
 *  2. `data.tipo` no está registrado → se infiere la familia por la forma del JSON.
 *  3. sin `tipo` → se intenta el matching estructural legacy (6 esquemas viejos).
 *  4. nada matchea → vista de JSON crudo legible. */
function resolve(data: unknown): Resolution {
  if (typeof data === 'object' && data !== null && typeof (data as any).tipo === 'string') {
    const tipo = (data as any).tipo as string;
    const entry = REGISTRY[tipo];
    if (entry) return { path: 'registered', tipo, node: renderFamily(entry.adapt(data)) };

    const inferred = sniffShape(data as Record<string, unknown>);
    if (inferred) return { path: 'inferred', tipo, node: renderFamily(inferred) };
  }

  const legacy = matchLegacy(data);
  if (legacy) return { path: 'legacy', kind: legacy.kind, node: legacy.node };

  return { path: 'fallback', node: <GenericFallback data={data} /> };
}

/** Vista para el alumno: siempre muestra algo si hay datos — incluso el
 * fallback de JSON crudo es preferible a que la sección desaparezca sin
 * explicación. */
export function VisualModelPreview({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;
  const resolution = resolve(data);
  return (
    <div className="panel" style={{ padding: '18px 20px', overflowX: 'auto' }}>
      {resolution.node}
    </div>
  );
}

/** Vista para el docente en el editor: además de dibujar, dice cómo se resolvió
 * el gráfico (tipo reconocido, inferido por forma, formato legacy, o crudo). */
export function VisualModelEditorPreview({ data }: { data: unknown }) {
  const isEmpty = data === null || data === undefined || (typeof data === 'object' && Object.keys(data as object).length === 0);

  return (
    <div className="panel" style={{ padding: '18px 20px', overflowX: 'auto' }}>
      {isEmpty ? (
        <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          Sin datos todavía — completá el JSON de arriba (o usá "cargar ejemplo") para previsualizar el gráfico.
        </p>
      ) : (
        <EditorResolution data={data} />
      )}
    </div>
  );
}

function EditorResolution({ data }: { data: unknown }) {
  const resolution = resolve(data);
  const statusText =
    resolution.path === 'registered'
      ? `se detectó tipo "${resolution.tipo}"`
      : resolution.path === 'inferred'
        ? `tipo "${resolution.tipo}" no está registrado — se infirió el gráfico por la forma de tus datos`
        : resolution.path === 'legacy'
          ? `formato legacy detectado: ${VISUAL_MODEL_LABELS[resolution.kind]}`
          : 'no se reconoció ningún formato de gráfico — mostrando el JSON tal cual';

  return (
    <>
      <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 12 }}>
        {statusText}
      </p>
      {resolution.node}
    </>
  );
}
