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
