import { z } from 'zod';
const angle = z.number().positive().lt(180);
const diagram = z.discriminatedUnion('type', [
  z.object({ type: z.literal('triangle'), a: angle, b: angle }).refine((d) => d.a + d.b < 180),
  z.object({ type: z.literal('isosceles'), apex: angle }),
  z.object({ type: z.literal('parallel'), a: angle }),
  z
    .object({ type: z.literal('exterior'), a: angle, b: angle, c: angle })
    .refine((d) => Math.abs(d.a + d.b + d.c - 180) < 1e-8),
  z.object({
    type: z.literal('rectangle'),
    length: z.number().positive(),
    width: z.number().positive(),
  }),
  z
    .object({
      type: z.literal('right'),
      a: z.number().positive(),
      b: z.number().positive(),
      c: z.number().positive(),
    })
    .refine((d) => Math.abs(d.a * d.a + d.b * d.b - d.c * d.c) < 1e-8),
  z.object({ type: z.literal('circle'), central: angle }),
  z.object({ type: z.literal('polygon'), n: z.number().int().min(3).max(30) }),
]);
export const questionSchema = z.object({
  id: z.string(),
  split: z.enum(['pre', 'practice', 'post']),
  skillId: z.string(),
  skill: z.string(),
  title: z.string(),
  prompt: z.string().min(10),
  unit: z.string(),
  choices: z
    .array(z.number().positive())
    .length(4)
    .refine((a) => new Set(a).size === 4),
  answerIndex: z.number().int().min(0).max(3),
  feedback: z.array(z.string().min(5)).length(4),
  steps: z.array(z.string().min(5)).length(3),
  hints: z.array(z.object({ text: z.string().min(5), highlight: z.string() })).length(3),
  diagram,
  difficulty: z.string(),
  estimatedSeconds: z.number().positive(),
  source: z.object({
    kind: z.literal('original'),
    author: z.string(),
    reference: z.string(),
    reviewStatus: z.literal('draft'),
  }),
});
