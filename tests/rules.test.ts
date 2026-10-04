import { describe, it, expect } from 'vitest';
import { postEligible, postOpensAt, learningMetrics, toCsv } from '../src/lib/rules';
describe('experiment rules', () => {
  it('unlocks the post-test exactly 14 elapsed days after enrollment', () => {
    const joined = '2026-10-03T23:30:00+03:00';
    expect(postEligible(joined, new Date('2026-10-17T20:29:59.999Z'))).toBe(false);
    expect(postEligible(joined, new Date('2026-10-17T20:30:00Z'))).toBe(true);
    expect(postOpensAt(joined).toISOString()).toBe('2026-10-17T20:30:00.000Z');
  });
  it('reports percentage-point gains and the share who improved', () => {
    const m = learningMetrics([
      { pre: 5, post: 7 },
      { pre: 8, post: 11 },
      { pre: 10, post: 12 },
      { pre: 8, post: 8 },
      { pre: 10, post: 9 },
    ]);
    expect(m.paired).toBe(5);
    expect(m.gain).toBeCloseTo(8);
    expect(m.improved).toBe(60);
  });
  it('does not present empty cohorts as zero improvement', () => {
    expect(learningMetrics([])).toEqual({ paired: 0, gain: null, improved: null });
  });
  it('escapes spreadsheet formulas and embedded CSV quotes', () => {
    const csv = toCsv([{ source: '=HYPERLINK("bad")', note: 'a,b\nnext' }]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"a,b\nnext"');
  });
});
