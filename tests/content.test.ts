import { describe, it, expect } from 'vitest';
import raw from '../content/questions.json';
import cases from '../content/evaluation-cases.json';
import { questionSchema } from '../src/lib/content-schema';
import type { Question } from '../src/lib/types';
const questions = questionSchema.array().parse(raw) as Question[];
describe('original content bank', () => {
  it('has 50 training questions and two disjoint 15-question assessments', () => {
    expect(questions).toHaveLength(80);
    expect(new Set(questions.map((q) => q.id)).size).toBe(80);
    expect(questions.filter((q) => q.split === 'practice')).toHaveLength(50);
    expect(questions.filter((q) => q.split === 'pre')).toHaveLength(15);
    expect(questions.filter((q) => q.split === 'post')).toHaveLength(15);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(80);
    const count = (split: string) =>
      Object.fromEntries(
        [...new Set(questions.map((q) => q.skillId))].map((id) => [
          id,
          questions.filter((q) => q.split === split && q.skillId === id).length,
        ]),
      );
    expect(count('pre')).toEqual(count('post'));
  });
  it.each(questions)('$id has the mathematically correct answer and no duplicate choices', (q) => {
    const d = q.diagram;
    let expected = 0;
    switch (d.type) {
      case 'triangle':
        expected = 180 - Number(d.a) - Number(d.b);
        break;
      case 'isosceles':
        expected = (180 - Number(d.apex)) / 2;
        break;
      case 'parallel':
        expected = Number(d.a);
        break;
      case 'exterior':
        expected = 180 - Number(d.b);
        break;
      case 'rectangle':
        expected = Number(d.length) * Number(d.width);
        break;
      case 'right':
        expected = Math.hypot(Number(d.a), Number(d.b));
        break;
      case 'circle':
        expected = Number(d.central) / 2;
        break;
      case 'polygon':
        expected = ((Number(d.n) - 2) * 180) / Number(d.n);
        break;
    }
    expect(q.choices[q.answerIndex]).toBeCloseTo(expected, 8);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.source.reviewStatus).toBe('draft');
    expect(q.source.kind).toBe('original');
  });
  it('has exactly 150 distinct, incorrect response cases awaiting human review', () => {
    expect(cases).toHaveLength(150);
    expect(new Set(cases.map((c) => c.questionId + ':' + c.wrongChoice)).size).toBe(150);
    for (const c of cases) {
      const q = questions.find((q) => q.id === c.questionId)!;
      expect(q.split).toBe('practice');
      expect(c.wrongChoice).not.toBe(q.answerIndex);
      expect(c.status).toBe('needs-human-review');
    }
  });
  it('rejects a malformed triangle rather than drawing impossible geometry', () => {
    expect(
      questionSchema.safeParse({ ...questions[0], diagram: { type: 'triangle', a: 100, b: 100 } })
        .success,
    ).toBe(false);
  });
});
