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

export type Theme = 'dark' | 'light';

export interface StudentProfile {
  id: number;
  legajo: string;
  full_name: string;
  avatar: number;
  theme: Theme;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ---- live quiz session ----

export type SessionStatus = 'waiting' | 'active' | 'finished';

export interface QuizSession {
  id: number;
  code: string;
  topic: Topic;
  status: SessionStatus;
  created_at: string;
}

export interface Participant {
  id: number;
  student: StudentProfile;
  joined_at: string;
}

export interface PublicQuestionOption {
  id: number;
  text: string;
}

export interface PublicQuestion {
  id: number;
  text: string;
  question_type: QuestionType;
  options: PublicQuestionOption[];
}

export interface TallyRow {
  id?: number;
  text: string;
  votes: number;
}

export interface StudentQuestionState {
  order: number;
  points: number;
  duration_seconds: number;
  time_remaining_seconds: number | null;
  accepts_answers: boolean;
  has_answered: boolean;
  revealed: boolean;
  question: PublicQuestion;
  tally?: TallyRow[];
  correct_option_ids?: number[];
  justification?: string;
}

export interface SessionStudentState {
  session: QuizSession;
  current_question: StudentQuestionState | null;
}

export interface AnswerResult {
  is_correct: boolean;
  score: number;
}

// ---- docente / host ----

export interface LeaderboardRow {
  legajo: string;
  full_name: string;
  total_score: number;
}

export interface HostQuestionState {
  order: number;
  points: number;
  duration_seconds: number;
  time_remaining_seconds: number | null;
  accepts_answers: boolean;
  revealed: boolean;
  answers_received: number;
  question: Question;
  tally: TallyRow[];
}

export interface SessionHostState {
  session: QuizSession;
  participant_count: number;
  leaderboard: LeaderboardRow[];
  current_question: HostQuestionState | null;
}

export interface SessionQuestionProgress {
  order: number;
  points: number;
  duration_seconds: number;
  grace_seconds: number;
  started_at: string | null;
  revealed_at: string | null;
  question: Question;
}

export interface CreateSessionQuestionInput {
  question_id: number;
  points: number;
  duration_seconds: number;
  grace_seconds: number;
}
