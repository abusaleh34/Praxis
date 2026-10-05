export type Kind = 'pre' | 'practice' | 'post';
export type Diagram = { type: string; [key: string]: string | number };
export type Hint = { text: string; highlight: string; stage?: number; source?: string };
export interface Question {
  id: string;
  split: Kind;
  skillId: string;
  skill: string;
  title: string;
  prompt: string;
  unit: string;
  choices: number[];
  answerIndex: number;
  feedback: string[];
  steps: string[];
  hints: Hint[];
  diagram: Diagram;
  difficulty: string;
  estimatedSeconds: number;
  source: { kind: string; author: string; reference: string; reviewStatus: string };
}
export type PublicQuestion = Pick<
  Question,
  'id' | 'skillId' | 'skill' | 'title' | 'prompt' | 'unit' | 'choices' | 'diagram' | 'difficulty'
>;
export interface StudyState {
  id: string;
  kind: Kind;
  index: number;
  total: number;
  completed: boolean;
  score: number | null;
  question: PublicQuestion | null;
  hints: Hint[];
}
export interface Overview {
  participant: { id: string; joinedAt: string };
  completedQuestions: number;
  accuracy: number;
  practiceSessions: number;
  completedSessions: number;
  pre: { score: number; total: number } | null;
  post: { score: number; total: number } | null;
  postOpensAt: string;
  postEligible: boolean;
  activeSession: string | null;
  activeSessions: { id: string; kind: Kind; skill: string }[];
  adaptive: ReturnType<typeof import('./adaptive').adaptiveProfile>;
  recent: {
    id: string;
    kind: Kind;
    label: string;
    href: string;
    score: number;
    total: number;
    completedAt: string;
  }[];
  skills: { id: string; name: string; answered: number; correct: number }[];
  offer: { enabled: boolean; description: string; eligible: boolean };
}
