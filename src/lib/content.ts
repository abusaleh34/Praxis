import 'server-only';
import { createHash } from 'node:crypto';
import raw from '../../content/questions.json';
import type { Question, PublicQuestion } from './types';
import { questionSchema } from './content-schema';
export const questions: Question[] = questionSchema.array().parse(raw);
export const questionMap = new Map(questions.map((q) => [q.id, q]));
export function publicQuestion(q: Question): PublicQuestion {
  const { id, skillId, skill, title, prompt, unit, choices, diagram, difficulty } = q;
  return { id, skillId, skill, title, prompt, unit, choices, diagram, difficulty };
}
export function contentHash(q: Question) {
  return createHash('sha256').update(JSON.stringify(q)).digest('hex');
}
