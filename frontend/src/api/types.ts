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
  | 'fs_sequence'
  | 'priority_queue_timeline';

export const VISUAL_MODEL_LABELS: Record<VisualModel, string> = {
  process_states: 'Diagrama de estados de procesos',
  cpu_timeline: 'Línea de tiempo de planificación',
  resource_graph: 'Grafo de asignación de recursos',
  memory_map: 'Mapa de memoria virtual',
  fs_sequence: 'Secuencia de escritura en filesystem',
  priority_queue_timeline: 'Cola de prioridad con línea de tiempo',
};

export interface CaseListItem {
  id: number;
  slug: string;
  title: string;
  topic: Topic;
}

export interface CaseGraphic {
  id: number;
  topic: Topic;
  data: unknown;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'fill_blank' | 'survey';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'opción única',
  multiple_choice: 'opción múltiple',
  fill_blank: 'completar',
  survey: 'encuesta',
};

export interface QuestionOption {
  id: number;
  text: string;
  image: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  text: string;
  image: string;
  question_type: QuestionType;
  options: QuestionOption[];
  justification: string;
  conceptual_error: string;
}

export interface CaseDetail extends CaseListItem {
  author: string;
  scenario: string;
  guiding_questions: string;
  theory: string;
  graphic: CaseGraphic | null;
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

export interface TeacherProfile {
  username: string;
  avatar: number;
  theme: Theme;
}

export interface CaseWriteInput {
  topic: number;
  title: string;
  scenario: string;
  guiding_questions: string;
  theory: string;
  graphic_data: unknown;
}

// ---- live quiz session ----

export type SessionStatus = 'waiting' | 'active' | 'finished';

export interface QuizSession {
  id: number;
  code: string;
  quiz_title: string | null;
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
  image: string;
}

export interface PublicQuestion {
  id: number;
  text: string;
  image: string;
  question_type: QuestionType;
  options: PublicQuestionOption[];
}

export interface TallyRow {
  id?: number;
  text: string;
  image?: string;
  votes: number;
}

export interface AnswerResult {
  is_correct: boolean;
  score: number;
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
  /** Solo viene una vez revelada la pregunta — antes el alumno no se entera
   * si acertó, ni siquiera mirando la respuesta cruda de /answer/. */
  your_result?: AnswerResult;
}

export interface SessionStudentState {
  session: QuizSession;
  current_question: StudentQuestionState | null;
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

export interface CreateSessionQuestionOptionInput {
  text: string;
  image: string;
  is_correct: boolean;
}

export interface CreateSessionQuestionInput {
  text: string;
  image: string;
  question_type: QuestionType;
  justification: string;
  options: CreateSessionQuestionOptionInput[];
  points: number;
  duration_seconds: number;
  grace_seconds: number;
}

// ---- cuestionarios persistidos ----

export interface Quiz {
  id: number;
  title: string;
  host: string;
  shared_with: string[];
  question_count: number;
  created_at: string;
}

export interface QuizWriteInput {
  title: string;
  shared_with_usernames: string[];
  questions: CreateSessionQuestionInput[];
}

export interface QuizQuestionDetail {
  id: number;
  order: number;
  text: string;
  image: string;
  question_type: QuestionType;
  justification: string;
  options: QuestionOption[];
  points: number;
  duration_seconds: number;
  grace_seconds: number;
}

export interface QuizDetail {
  id: number;
  title: string;
  host: string;
  shared_with: string[];
  questions: QuizQuestionDetail[];
  created_at: string;
}

export interface QuizLeaderboardRow {
  legajo: string;
  full_name: string;
  total_score: number;
  sessions_played: number;
}
