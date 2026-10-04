import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { modelHint } from '../src/lib/model.mjs';
if (!process.env.PRAXIS_AI_API_KEY || !process.env.PRAXIS_AI_MODEL) {
  console.error('Model evaluation not run: configure PRAXIS_AI_API_KEY and PRAXIS_AI_MODEL first.');
  process.exit(2);
}
const limit = Number(process.env.PRAXIS_EVAL_CASE_LIMIT ?? 5);
if (!Number.isInteger(limit) || limit < 1 || limit > 150)
  throw new Error('PRAXIS_EVAL_CASE_LIMIT must be between 1 and 150.');
const root = new URL('../', import.meta.url);
const questions = JSON.parse(await readFile(new URL('content/questions.json', root), 'utf8'));
const cases = JSON.parse(
  await readFile(new URL('content/evaluation-cases.json', root), 'utf8'),
).slice(0, limit);
const outputs = [];
for (const c of cases) {
  const question = questions.find((q) => q.id === c.questionId);
  const hints = [];
  for (let stage = 1; stage <= 3; stage++)
    hints.push(await modelHint(question, c.wrongChoice, stage));
  outputs.push({ ...c, hints, referenceSteps: question.steps, grade: null, reviewer: null });
}
await mkdir(new URL('quality-results/', root), { recursive: true });
await writeFile(
  new URL('quality-results/model-review.json', root),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      model: process.env.PRAXIS_AI_MODEL,
      bankHash: createHash('sha256').update(JSON.stringify(questions)).digest('hex'),
      cases: outputs.length,
      graded: 0,
      accuracy: null,
      outputs,
    },
    null,
    2,
  ),
);
console.log(
  `Generated ${outputs.length} model review cases. Human grading is still required; no accuracy claim made.`,
);
