export interface Topic {
  id: number;
  name: string;
  slug: string;
}

export type VisualModel =
  | 'process_states'
  | 'cpu_timeline'
  | 'resource_graph'
  | 'memory_map'
  | 'fs_sequence';

export const VISUAL_MODEL_LABELS: Record<VisualModel, string> = {
  process_states: 'Diagrama de estados de procesos',
  cpu_timeline: 'Línea de tiempo de planificación',
  resource_graph: 'Grafo de asignación de recursos',
  memory_map: 'Mapa de memoria virtual',
  fs_sequence: 'Secuencia de escritura en filesystem',
};

export interface CaseListItem {
  id: number;
  slug: string;
  title: string;
  topic: Topic;
  visual_model: VisualModel;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'fill_blank';

export interface QuestionOption {
  id: number;
  text: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  text: string;
  question_type: QuestionType;
  options: QuestionOption[];
  justification: string;
  conceptual_error: string;
}

export interface CaseDetail extends CaseListItem {
  scenario: string;
  guiding_questions: string;
  theory: string;
  visual_model_data: unknown;
  questions: Question[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
