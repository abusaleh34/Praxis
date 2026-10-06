import { describe, expect, it } from 'vitest';
import { questionIntent } from '../src/lib/question-intent';
import { labModel } from '../src/lib/lab';
import { makeProblem } from '../src/lib/mentor-problems';
import { guideFor } from '../src/lib/mentor-guides';

describe('measurement extraction', () => {
  it.each([
    ['سيارة تسير بسرعة 60 كم/ساعة لمدة 30 دقيقة. أوجد المسافة المقطوعة.', 60, 0.5, 30],
    ['بسرعة ٩٠ كم/ساعة لمدة ٢٠ دقيقة، احسب المسافة.', 90, 1 / 3, 30],
    ['بسرعة ۱۰ م/ث لمدة ۳۰ ثانية، احسب المسافة.', 36, 1 / 120, 0.3],
    ['احسب المسافة بسرعة 2 كم/دقيقة لمدة 0.5 ساعة.', 120, 0.5, 60],
    ['لمدة 2 ساعات وبسرعة 60 كم/ساعة، أوجد المسافة.', 60, 2, 120],
  ])('normalizes source units: %s', (text, speed, time, distance) => {
    const intent = questionIntent(String(text));
    expect(intent.template).toBe('speed');
    expect(intent.values[0]).toBeCloseTo(Number(speed));
    expect(intent.values[1]).toBeCloseTo(Number(time));
    expect(labModel('speed', ...(intent.values as [number, number])).result).toBeCloseTo(
      Number(distance),
    );
  });
  it.each([
    'السؤال 14: مستطيل طوله 8 سم وعرضه 5 سم. أوجد مساحته.',
    '١٤) مستطيل عرضه ٥ سم وطوله ٨ سم، ما مساحته؟',
    'س ۱۴: مستطيل الطول = ۸ سم والعرض = ۵ سم، احسب المساحة.',
  ])('associates values with dimensions, not their position: %s', (text) => {
    expect(questionIntent(text)).toMatchObject({ template: 'rectangle', values: [8, 5] });
  });
  it.each([
    'سرعة السيارة 60 لمدة 30، احسب المسافة.',
    'سرعة السيارة 60 ميل/ساعة لمدة 30 دقيقة، احسب المسافة.',
    'بسرعة 60 كم/ساعة لمدة 1 ساعة و30 دقيقة، احسب المسافة.',
    'بسرعة 60 كم/ساعة لمدة ساعة و30 دقيقة، احسب المسافة.',
    'بسرعة -60 كم/ساعة لمدة 30 دقيقة، احسب المسافة.',
    'مستطيل طوله 8 سم وطوله 9 سم وعرضه 5 سم، أوجد المساحة.',
    'مثلث زواياه 30 و40 وسعره 50، أوجد الزاوية الثالثة.',
  ])('requires clarification for missing or ambiguous units/values: %s', (text) => {
    expect(questionIntent(text).template).toBe('');
  });
});

describe('versioned verbal content', () => {
  it.each(['analogy', 'reading'])(
    'varies %s content and preserves every original key',
    (lesson) => {
      const originals = [0, 1, 2].map((v) => makeProblem(lesson, 42, v));
      const prompts = new Set<string>(),
        passages = new Set<string>();
      for (let set = 0; set < 4; set++)
        for (let v = 0; v < 3; v++) {
          const p = makeProblem(lesson, 42, v, set);
          prompts.add(p.prompt);
          if (p.passage) passages.add(p.passage);
          expect(new Set(p.choices).size).toBe(4);
          expect(p.choices[p.answer]).toBeTruthy();
          expect(p.steps[0]).toBeTruthy();
          expect(makeProblem(lesson, 42, v, set)).toEqual(p);
          const guides = guideFor(lesson, 42, v, set);
          expect(guides.every((g) => new Set(g.choices).size === g.choices.length)).toBe(true);
          if (set > 0)
            expect(guides.map((g) => g.hint + g.question).join(' ')).not.toMatch(
              /بالقلم|الصفحة|النباتات/,
            );
          if (set === 0) expect(p).toEqual(originals[v]);
        }
      expect(prompts.size).toBeGreaterThanOrEqual(10);
      if (lesson === 'reading') expect(passages.size).toBe(4);
    },
  );
  it('keeps historical seed 0 answers unchanged', () => {
    expect(
      [0, 1, 2].map((v) => {
        const p = makeProblem('analogy', 0, v);
        return p.choices[p.answer];
      }),
    ).toEqual(['فرشاة : رسم', 'صفحة : كتاب', 'جوع : طعام']);
  });
});
