import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const questions = JSON.parse(await readFile(new URL('content/questions.json', root), 'utf8'));
const cases = JSON.parse(await readFile(new URL('content/evaluation-cases.json', root), 'utf8'));
const outputs = cases.map((c) => {
  const q = questions.find((q) => q.id === c.questionId);
  return {
    ...c,
    hints: q.hints.map((h, i) => ({
      ...h,
      text: i === 0 ? `${q.feedback[c.wrongChoice]} ${h.text}` : h.text,
    })),
    referenceSteps: q.steps,
    grade: null,
    reviewer: null,
  };
});
const report = {
  createdAt: new Date().toISOString(),
  kind: 'authored-hints-review-pack',
  bankHash: createHash('sha256').update(JSON.stringify(questions)).digest('hex'),
  cases: outputs.length,
  graded: 0,
  accuracy: null,
  notice: 'Prepared review material only. No human grading or model evaluation has been performed.',
  outputs,
};
await mkdir(new URL('quality-results/', root), { recursive: true });
await writeFile(
  new URL('quality-results/authored-review.json', root),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(`Prepared ${outputs.length} review cases. Graded: 0. Accuracy: unmeasured.`);
