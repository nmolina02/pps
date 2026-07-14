export interface ProcessStatesData {
  states: { id: string; label: string }[];
  transitions: { from: string; to: string; label?: string }[];
  highlight?: string[];
}

export interface CpuTimelineData {
  segments: { process: string; start: number; end: number; label?: string }[];
}

export interface ResourceGraphData {
  nodes: { id: string; type: 'process' | 'resource'; label?: string; instances?: number }[];
  edges: { from: string; to: string; kind: 'assignment' | 'request' }[];
}

export interface MemoryMapData {
  totalSize: number;
  unit?: string;
  regions: { label: string; start: number; size: number; kind?: 'system' | 'process' | 'free' }[];
}

export interface FsSequenceData {
  actors: string[];
  steps: { from: string; to: string; label?: string }[];
}

export interface PriorityQueueTimelineData {
  politica?: string;
  procesos: { id: string; prioridad_inicial: number; tipo?: string }[];
  eventos: { t: number; evento: string }[];
  problema?: string;
  correccion?: { tecnica: string; regla: string };
}

export function isProcessStatesData(d: unknown): d is ProcessStatesData {
  const v = d as ProcessStatesData;
  return !!v && Array.isArray(v.states) && v.states.length > 0 && Array.isArray(v.transitions);
}

export function isCpuTimelineData(d: unknown): d is CpuTimelineData {
  const v = d as CpuTimelineData;
  return !!v && Array.isArray(v.segments) && v.segments.length > 0;
}

export function isResourceGraphData(d: unknown): d is ResourceGraphData {
  const v = d as ResourceGraphData;
  return !!v && Array.isArray(v.nodes) && v.nodes.length > 0 && Array.isArray(v.edges);
}

export function isMemoryMapData(d: unknown): d is MemoryMapData {
  const v = d as MemoryMapData;
  return !!v && typeof v.totalSize === 'number' && v.totalSize > 0 && Array.isArray(v.regions) && v.regions.length > 0;
}

export function isFsSequenceData(d: unknown): d is FsSequenceData {
  const v = d as FsSequenceData;
  return !!v && Array.isArray(v.actors) && v.actors.length > 0 && Array.isArray(v.steps);
}

export function isPriorityQueueTimelineData(d: unknown): d is PriorityQueueTimelineData {
  const v = d as PriorityQueueTimelineData;
  return !!v && Array.isArray(v.procesos) && v.procesos.length > 0 && Array.isArray(v.eventos) && v.eventos.length > 0;
}

export const VISUAL_MODEL_EXAMPLES: Record<string, unknown> = {
  process_states: {
    states: [
      { id: 'new', label: 'Nuevo' },
      { id: 'ready', label: 'Listo' },
      { id: 'running', label: 'Corriendo' },
      { id: 'blocked', label: 'Bloqueado' },
      { id: 'terminated', label: 'Terminado' },
    ],
    transitions: [
      { from: 'new', to: 'ready', label: 'admitido' },
      { from: 'ready', to: 'running', label: 'dispatch' },
      { from: 'running', to: 'ready', label: 'interrupción' },
      { from: 'running', to: 'blocked', label: 'espera I/O' },
      { from: 'blocked', to: 'ready', label: 'I/O listo' },
      { from: 'running', to: 'terminated', label: 'exit' },
    ],
    highlight: ['blocked'],
  },
  cpu_timeline: {
    segments: [
      { process: 'P1', start: 0, end: 4 },
      { process: 'P2', start: 4, end: 7 },
      { process: 'P1', start: 7, end: 9 },
      { process: 'P3', start: 9, end: 13 },
    ],
  },
  resource_graph: {
    nodes: [
      { id: 'P1', type: 'process', label: 'Proceso P1' },
      { id: 'P2', type: 'process', label: 'Proceso P2' },
      { id: 'impresora', type: 'resource', label: 'Impresora', instances: 1 },
      { id: 'escaner', type: 'resource', label: 'Escáner', instances: 1 },
    ],
    edges: [
      { from: 'impresora', to: 'P1', kind: 'assignment' },
      { from: 'P1', to: 'escaner', kind: 'request' },
      { from: 'escaner', to: 'P2', kind: 'assignment' },
      { from: 'P2', to: 'impresora', kind: 'request' },
    ],
  },
  memory_map: {
    totalSize: 64,
    unit: 'KB',
    regions: [
      { label: 'SO', start: 0, size: 8, kind: 'system' },
      { label: 'P1', start: 8, size: 16, kind: 'process' },
      { label: 'libre', start: 24, size: 24, kind: 'free' },
      { label: 'P2', start: 48, size: 16, kind: 'process' },
    ],
  },
  fs_sequence: {
    actors: ['Proceso', 'Cache', 'Disco'],
    steps: [
      { from: 'Proceso', to: 'Cache', label: 'write()' },
      { from: 'Cache', to: 'Disco', label: 'flush (asíncrono)' },
      { from: 'Disco', to: 'Cache', label: 'ack' },
      { from: 'Cache', to: 'Proceso', label: 'return' },
    ],
  },
  priority_queue_timeline: {
    politica: 'prioridad_preemptiva_sin_aging',
    procesos: [
      { id: 'P1', prioridad_inicial: 1, tipo: 'mantenimiento' },
      { id: 'P2', prioridad_inicial: 9, tipo: 'critico' },
      { id: 'P3', prioridad_inicial: 8, tipo: 'critico' },
    ],
    eventos: [
      { t: 0, evento: 'P1 listo' },
      { t: 1, evento: 'P2 listo y ejecuta' },
      { t: 3, evento: 'P3 listo y desplaza a P1' },
      { t: 5, evento: 'llega nueva tarea crítica' },
    ],
    problema: 'P1 permanece ready pero no obtiene CPU',
    correccion: { tecnica: 'aging', regla: 'sumar +1 prioridad cada 5 unidades de espera' },
  },
};
