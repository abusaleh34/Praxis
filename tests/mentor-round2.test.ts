import { describe, expect, it } from 'vitest';
import { lessons, lessonById } from '../src/lib/mentor-catalog';
import { makeProblem } from '../src/lib/mentor-problems';
import { problemGuidance } from '../src/lib/problem-guidance';
import { labModel, validLabValues } from '../src/lib/lab';

describe('second review regressions', () => {
  it('gives all generated variants a transition and a valid learning destination', () => {
    for (const l of lessons)
      for (let v = 0; v < 3; v++) {
        const p = makeProblem(l.id, 0, v),
          g = problemGuidance(l.id, v);
        expect(p.choices[p.answer]).toBeTruthy();
        expect(g.bridge.length).toBeGreaterThan(15);
        expect(g.fast.length).toBeGreaterThan(15);
        const url = new URL(g.explanationHref, 'https://praxis.invalid');
        expect(url.searchParams.get('view')).toBe('learn');
        expect(lessonById.has(url.searchParams.get('skill')!)).toBe(true);
      }
  });
  it('distinguishes the inverse and exterior operations that the generic shortcut got wrong', () => {
    const exterior = makeProblem('triangle', 0, 2);
    expect(exterior.choices[exterior.answer]).toBe('70');
    expect(problemGuidance('triangle', 2).fast).toContain('اجمع');
    expect(problemGuidance('triangle', 2).fast).not.toContain('اطرح');
    expect(problemGuidance('triangle', 2).explanationHref).toContain('skill=exterior');
    expect(problemGuidance('triangle', 1).explanationHref).toContain('skill=isosceles');
    expect(problemGuidance('rectangle', 1).explanationHref).toContain('target=perimeter');
    expect(problemGuidance('rectangle', 2).fast).toContain('اقسم المساحة');
    expect(problemGuidance('chemistry', 1).fast).toContain('اضرب');
    expect(problemGuidance('physics', 0).fast).toContain('اضرب');
    expect(problemGuidance('physics', 2).fast).toContain('اقسم');
  });
  it.each([
    [20, 10, 60],
    [1000, 500, 3000],
    [20.5, 10.25, 61.5],
    [1000000, 1000000, 4000000],
  ])('accepts physical dimensions %s × %s independently of slider ranges', (a, b, perimeter) => {
    expect(validLabValues('rectangle', a, b)).toBe(true);
    expect(labModel('rectangle', a, b, 'perimeter').result).toBe(perimeter);
  });
  it.each([
    [0, 10],
    [-1, 2],
    [NaN, 3],
    [Infinity, 4],
    [1000001, 2],
  ])('rejects invalid dimensions %s × %s', (a, b) => {
    expect(validLabValues('rectangle', a, b)).toBe(false);
  });
  it('rejects degenerate angles and nonintegral polygons', () => {
    expect(validLabValues('triangle', 90, 90)).toBe(false);
    expect(validLabValues('triangle', 5, 170)).toBe(true);
    expect(validLabValues('polygon', 3.5, 0)).toBe(false);
    expect(validLabValues('circle', 180, 0)).toBe(false);
  });
});
