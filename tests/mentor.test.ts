import { describe, it, expect } from 'vitest';
import { makeProblem } from '../src/lib/mentor-problems';
import { lessons } from '../src/lib/mentor-catalog';
import { labModel, normalizeNumber } from '../src/lib/lab';
import { choiceOrder } from '../src/lib/choice-order';
import { adaptiveProfile, type Evidence } from '../src/lib/adaptive';
describe('authored mentor content', () => {
  it('generates four distinct choices and a valid reference across supported lesson ranges', () => {
    for (const l of lessons)
      for (let seed = 0; seed < 28; seed++)
        for (let variant = 0; variant < 3; variant++) {
          const p = makeProblem(l.id, seed, variant);
          expect(new Set(p.choices).size, `${l.id}/${seed}/${variant}`).toBe(4);
          expect(p.choices[p.answer]).toBeTruthy();
          expect(p.prompt.length).toBeGreaterThan(15);
          expect(p.steps.length).toBeGreaterThanOrEqual(3);
          if (p.diagram?.type === 'triangle')
            expect(Number(p.diagram.a) + Number(p.diagram.b)).toBeLessThan(180);
          expect(JSON.stringify(p)).not.toMatch(/NaN|undefined|Infinity/);
        }
  });
  it.each([
    ['triangle', 0, 110],
    ['triangle', 1, 70],
    ['triangle', 2, 70],
    ['isosceles', 1, 40],
    ['exterior', 1, 45],
    ['exterior', 2, 100],
    ['rectangle', 0, 24],
    ['rectangle', 1, 22],
    ['rectangle', 2, 3],
    ['right', 0, 5],
    ['right', 1, 4],
    ['right', 2, 25],
    ['circle', 0, 30],
    ['circle', 1, 60],
    ['circle', 2, 30],
    ['polygon', 0, 60],
    ['polygon', 1, 120],
    ['polygon', 2, 3],
    ['ratio', 0, 15],
    ['ratio', 1, 5],
    ['fractions', 0, 8],
    ['fractions', 1, 60],
    ['fractions', 2, 120],
    ['speed', 0, 80],
    ['speed', 1, 2],
    ['speed', 2, 40],
    ['physics', 0, 8],
    ['chemistry', 0, 2],
    ['chemistry', 1, 36],
    ['chemistry', 2, 18],
  ])('%s variant %i matches an independently solved reference', (lesson, variant, answer) => {
    const p = makeProblem(String(lesson), 0, Number(variant));
    expect(Number(p.choices[p.answer])).toBe(answer);
  });
  it('changes the requested operation, not just the numbers', () => {
    const circle = [0, 1, 2].map((v) => makeProblem('circle', 0, v));
    expect(new Set(circle.map((p) => p.prompt)).size).toBe(3);
    expect(circle[1].prompt).toContain('المركزية');
    expect(circle[2].prompt).toContain('أخرى');
  });
  it('preserves a session permutation and leaves older sessions unchanged', () => {
    expect(choiceOrder('old', 'q', false)).toEqual([0, 1, 2, 3]);
    expect(choiceOrder('a', 'q', true)).toEqual(choiceOrder('a', 'q', true));
    expect(
      new Set(Array.from({ length: 30 }, (_, i) => choiceOrder(String(i), 'q', true).join())).size,
    ).toBeGreaterThan(8);
  });
  it('renders edited inputs with the mathematically correct result', () => {
    expect(labModel('triangle', 80, 50).result).toBe(50);
    expect(labModel('circle', 110, 0).result).toBe(55);
    expect(labModel('rectangle', 7, 4).result).toBe(28);
    expect(labModel('right', 5, 12).result).toBe(13);
    expect(normalizeNumber('١٢٫٥')).toBe(12.5);
  });
});
describe('evidence-based recommendations', () => {
  const row = (skill: string, question: string, correct: boolean, assisted = false): Evidence => ({
    skill,
    question,
    correct,
    assisted,
    kind: 'practice',
    date: '2026-10-05T00:00:00Z',
  });
  it('does not count repeated or assisted questions as independent mastery', () => {
    const p = adaptiveProfile(
      [
        row('triangle', 'same', true),
        row('triangle', 'same', true),
        row('triangle', 'same', true),
        row('triangle', 'hint', true, true),
      ],
      Date.parse('2026-10-05'),
    );
    expect(p.skills.find((s) => s.id === 'triangle')?.independent).toBe(1);
    expect(p.skills.find((s) => s.id === 'triangle')?.state).not.toBe('أداء مستقل جيد');
  });
  it('recommends a weak prerequisite and explains why', () => {
    const p = adaptiveProfile(
      [
        row('triangle', 't', false),
        ...Array.from({ length: 4 }, (_, i) => row('isosceles', 'i' + i, false)),
      ],
      Date.parse('2026-10-05'),
    );
    expect(p.recommendation.skill).toBe('triangle');
    expect(p.recommendation.reason).toContain('أساس');
  });
  it('covers quantitative, verbal, and introductory science skills without extrapolating a Qiyas score', () => {
    expect(adaptiveProfile([]).skills.length).toBe(15);
    expect(adaptiveProfile([]).note).toContain('ليست');
  });
});
