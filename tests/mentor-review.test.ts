import { describe, expect, it } from 'vitest';
import { questionIntent } from '../src/lib/question-intent';
import { labModel } from '../src/lib/lab';
import { adaptiveProfile } from '../src/lib/adaptive';
import { safeDestination } from '../src/lib/mentor-navigation';
import { guideFor, publicGuide } from '../src/lib/mentor-guides';
import { lessons } from '../src/lib/mentor-catalog';

describe('review regressions', () => {
  it('solves the requested rectangle quantity with the right units', () => {
    const perimeter = questionIntent('مستطيل طوله ٨ سم وعرضه ٥ سم، ما محيطه؟');
    expect(perimeter.template).toBe('rectangle-perimeter');
    expect(perimeter.values).toEqual([8, 5]);
    expect(labModel('rectangle', 8, 5, 'perimeter')).toMatchObject({ result: 26, unit: 'سم' });
    expect(questionIntent('مستطيل طوله 8 سم وعرضه 5 سم، ما مساحته؟').template).toBe('rectangle');
    expect(labModel('rectangle', 8, 5)).toMatchObject({ result: 40, unit: 'سم²' });
  });
  it.each([
    'مستطيل طوله 8 سم وعرضه 5 سم',
    'مساحة مستطيل 40 سم² وطوله 8 سم، ما عرضه؟',
    'مستطيل طوله 8 سم وعرضه 5 سم، احسب المساحة والمحيط',
    'مستطيل طوله 8 متر وعرضه 5 سم، ما محيطه؟',
    'زاوية محيطية 30، ما الزاوية المركزية؟',
  ])('asks for clarification instead of guessing: %s', (text) => {
    expect(questionIntent(text).template).toBe('');
  });
  it('preserves a safe lesson destination through login without allowing external redirects', () => {
    expect(safeDestination('/mentor?skill=reading&view=practice')).toBe(
      '/mentor?skill=reading&view=practice',
    );
    expect(safeDestination('//evil.example')).toBe('/learn');
    expect(safeDestination('/\\evil.example')).toBe('/learn');
    expect(safeDestination('https://evil.example/mentor')).toBe('/learn');
    expect(safeDestination('/mentor?skill=invalid&token=secret')).toBe('/mentor');
  });
  it('prioritizes the observed circle gap over untouched skills after 2/3 correct', () => {
    const p = adaptiveProfile(
      [false, true, true].map((correct, i) => ({
        skill: 'circle',
        question: 'q' + i,
        correct,
        assisted: false,
        kind: 'practice',
        date: new Date().toISOString(),
      })),
    );
    expect(p.recommendation.skill).toBe('circle');
    expect(p.recommendation.reason).toContain('موضع التعثر');
  });
  it('guides central, inscribed and equal-angle problems differently without exposing keys', () => {
    const central = guideFor('circle', 0, 1),
      inscribed = guideFor('circle', 0, 0),
      equal = guideFor('circle', 0, 2);
    expect(central[1].choices[central[1].answer]).toBe('نضاعفه');
    expect(inscribed[1].choices[inscribed[1].answer]).toBe('نأخذ نصفه');
    expect(equal[1].choices[equal[1].answer]).toBe('نبقيه كما هو');
    expect(publicGuide(central, 0)).not.toHaveProperty('answer');
    expect(publicGuide(central, 2)).toBeNull();
    for (const l of lessons)
      for (let v = 0; v < 3; v++)
        for (const s of guideFor(l.id, 0, v)) {
          expect(new Set(s.choices).size).toBe(s.choices.length);
          expect(s.choices[s.answer]).toBeTruthy();
        }
  });
});
