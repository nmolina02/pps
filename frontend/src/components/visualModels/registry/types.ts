// Tipos compartidos por el motor genérico de modelos visuales: cada "familia" de
// diagrama (grafo, estados, gantt, mapa, secuencia, tabla, árbol) define su propia
// forma de props normalizada; los adaptadores por `tipo` (graph.ts, state.ts, ...)
// traducen el JSON crudo del banco de casos a esa forma.

export type NoteEntry = { label: string; value: unknown };

// ---- Graph (grafo de nodos/aristas, con ciclo opcional) ----
export interface GraphNode {
  id: string;
  category: string;
  label?: string;
  instances?: number;
}
export interface GraphEdge {
  from: string;
  to: string;
  kind?: string;
  label?: string;
}
export interface GraphFamilyData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** secuencia de ids que forman un ciclo a resaltar (ej. deadlock) */
  cyclePath?: string[];
  notes?: NoteEntry[];
}

// ---- State (estados + transiciones, válidas o no) ----
export interface StateNodeData {
  id: string;
  label: string;
}
export interface StateTransitionData {
  from: string;
  to: string;
  label?: string;
  invalid?: boolean;
}
export interface StateFamilyData {
  states: StateNodeData[];
  transitions: StateTransitionData[];
  highlight?: string[];
  notes?: NoteEntry[];
}

// ---- Gantt (barras en eje temporal, una o varias series comparables) ----
export interface GanttSegment {
  process: string;
  start: number;
  end: number;
  label?: string;
}
export interface GanttSeries {
  name?: string;
  segments: GanttSegment[];
}
export interface GanttFamilyData {
  series: GanttSeries[];
  notes?: NoteEntry[];
}

// ---- Map (rangos de memoria o posiciones en una recta numérica) ----
export interface MapRegion {
  label: string;
  start: number;
  end: number;
  kind?: string;
}
export interface MapPoint {
  value: number;
  label?: string;
  order?: number;
  kind?: string;
}
export interface MapFamilyData {
  mode: 'range' | 'line';
  totalSize?: number;
  unit?: string;
  regions?: MapRegion[];
  points?: MapPoint[];
  initial?: number;
  notes?: NoteEntry[];
}

// ---- Sequence (pasos/eventos ordenados) ----
export interface SequenceStep {
  time?: string | number;
  actor?: string;
  label: string;
  state?: 'ok' | 'warn' | 'fail' | 'neutral';
}
export interface SequenceFamilyData {
  steps: SequenceStep[];
  /** dibuja una flecha de vuelta del último paso al primero (livelock, ciclos sin progreso) */
  loop?: boolean;
  /** resalta un paso puntual como el punto de falla */
  failIndex?: number;
  notes?: NoteEntry[];
}

// ---- Table (filas, comparación por columnas, o colas nombradas) ----
export type TableCell = string | number | boolean | null | undefined;
export interface TableFamilyData {
  mode: 'rows' | 'columns' | 'queues';
  rows?: Record<string, TableCell>[];
  columns?: { name: string; fields: Record<string, TableCell> }[];
  queues?: { name: string; items: string[] }[];
  highlightRow?: number;
  notes?: NoteEntry[];
}

// ---- Tree (jerarquía o cadena lineal; una o dos —antes/después—) ----
export interface TreeNodeData {
  id: string;
  label?: string;
  state?: string;
  children?: TreeNodeData[];
}
export interface TreeFamilyData {
  trees: { title?: string; root: TreeNodeData }[];
  notes?: NoteEntry[];
}

export type FamilyName = 'graph' | 'state' | 'gantt' | 'map' | 'sequence' | 'table' | 'tree';

export type FamilyResult =
  | { family: 'graph'; props: GraphFamilyData }
  | { family: 'state'; props: StateFamilyData }
  | { family: 'gantt'; props: GanttFamilyData }
  | { family: 'map'; props: MapFamilyData }
  | { family: 'sequence'; props: SequenceFamilyData }
  | { family: 'table'; props: TableFamilyData }
  | { family: 'tree'; props: TreeFamilyData };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Adapter = (raw: any) => FamilyResult;

export interface RegistryEntry {
  label: string;
  tema: string;
  adapt: Adapter;
}

/** Junta todas las claves de `raw` que un adaptador no consumió explícitamente en
 * una lista de notas — así ningún dato del docente queda oculto aunque el
 * adaptador no lo dibuje "a medida". */
export function notesFrom(raw: Record<string, unknown>, used: string[]): NoteEntry[] {
  const usedSet = new Set(used);
  return Object.entries(raw)
    .filter(([k, v]) => !usedSet.has(k) && k !== 'tipo' && v !== undefined && v !== null)
    .map(([label, value]) => ({ label, value }));
}
