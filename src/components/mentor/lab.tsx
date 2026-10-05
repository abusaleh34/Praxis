'use client';
import { useEffect, useState } from 'react';
import { Geometry } from '../geometry';
import { lessonById } from '@/lib/mentor-catalog';
import { labDefaults, labModel, normalizeNumber } from '@/lib/lab';
import { TriangleProof, RectangleProof } from './visual-proof';
import { rememberMentor } from '@/lib/mentor-navigation';
export function Lab({
  lesson,
  imported,
  onPractice,
}: {
  lesson: string;
  imported?: { a: number; b: number; stamp: number; target?: 'area' | 'perimeter'; step?: number };
  onPractice: () => void;
}) {
  useEffect(
    () => () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    [],
  );
  const meta = lessonById.get(lesson)!;
  const defaults = labDefaults[lesson] ?? [50, 60];
  const [a, setA] = useState(defaults[0]),
    [b, setB] = useState(defaults[1]),
    [target, setTarget] = useState<'area' | 'perimeter'>('area'),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [answer, setAnswer] = useState(''),
    [stage, setStage] = useState(0),
    [feedback, setFeedback] = useState(''),
    [pair, setPair] = useState(0);
  useEffect(() => {
    setA((labDefaults[lesson] ?? [50, 60])[0]);
    setB((labDefaults[lesson] ?? [50, 60])[1]);
    setStep(0);
    setPlaying(false);
    setStage(0);
    setFeedback('');
    setAnswer('');
  }, [lesson]);
  useEffect(() => {
    if (imported) {
      const ranges = labModel(lesson, imported.a, imported.b).ranges;
      const safeA = Math.max(ranges[0][0], Math.min(ranges[0][1], imported.a || defaults[0]));
      const safeRanges = labModel(lesson, safeA, imported.b).ranges;
      setA(safeA);
      setB(
        safeRanges[1]
          ? Math.max(safeRanges[1][0], Math.min(safeRanges[1][1], imported.b || defaults[1]))
          : 0,
      );
      setTarget(imported.target ?? 'area');
      setStep(imported.step ?? 0);
      setStage(0);
      setFeedback('');
    }
  }, [imported]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setStep((s) => {
          if (s >= 2) {
            setPlaying(false);
            return 2;
          }
          return s + 1;
        }),
      3400,
    );
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    const u = new URL(location.href);
    u.searchParams.set('skill', lesson);
    u.searchParams.set('a', String(a));
    u.searchParams.set('b', String(b));
    u.searchParams.set('target', target);
    u.searchParams.set('step', String(step));
    history.replaceState(null, '', u);
    rememberMentor();
  }, [a, b, target, step, lesson]);
  const m = labModel(lesson, a, b, target),
    verbal = ['analogy', 'reading'].includes(lesson);
  const steps =
    lesson === 'rectangle'
      ? target === 'perimeter'
        ? [
            'المطلوب المحيط: طول الحدود الأربعة.',
            'تتبّع ضلعًا طويلًا ثم قصيرًا، ثم الضلعين المقابلين المساويين لهما.',
            'اجمع الطول والعرض واضرب المجموع في اثنين.',
          ]
        : [
            'المطلوب المساحة: تغطية داخل المستطيل.',
            'كل صف يحتوي عددًا من مربعات الوحدة يساوي الطول.',
            'اضرب عدد المربعات في الصف في عدد الصفوف.',
          ]
      : meta.steps;
  const spoken = steps[step] + (step === 2 ? ' ' + m.formula : '');
  function change(index: number, v: number) {
    if (index === 0) {
      setA(v);
      if (['triangle', 'exterior'].includes(lesson)) setB((old) => Math.min(old, 170 - v));
    } else setB(v);
    setStage(0);
    setFeedback('');
    setAnswer('');
  }
  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    const expected = stage === 0 ? m.checkpoint.answer : m.result;
    if (Math.abs(normalizeNumber(answer) - expected) < 0.015) {
      setFeedback(
        stage === 0
          ? 'صحيح. الآن استخدم ما وصلت إليه لإيجاد المطلوب.'
          : 'صحيح! جرّب تغيير المعطيات، ثم اختبر فهمك بمسائل جديدة.',
      );
      setStage((s) => Math.min(2, s + 1));
      setAnswer('');
    } else
      setFeedback(
        stage === 0
          ? m.checkpoint.hint
          : 'راجع العلاقة في الرسم، واستخدم نتيجة الخطوة السابقة. يمكنك الرجوع إلى الشرح.',
      );
  }
  return (
    <section className="mentor-lab panel">
      <div className="panel-heading">
        <div>
          <span className="badge">مختبر تفاعلي</span>
          <h2>{meta.name}</h2>
          <p>{meta.idea}</p>
        </div>
      </div>
      <div className="lab-grid">
        <div className="lab-visual">
          {lesson === 'triangle' && <TriangleProof a={a} b={b} step={step} />}
          {lesson === 'rectangle' && <RectangleProof a={a} b={b} step={step} target={target} />}
          {m.diagram && !['triangle', 'rectangle'].includes(lesson) && (
            <Geometry
              diagram={m.diagram}
              highlight={
                step === 0 ? 'known' : step === 1 ? (lesson === 'circle' ? 'arc' : 'all') : 'target'
              }
            />
          )}
          {!m.diagram && !verbal && (
            <svg className="relation-graph" viewBox="0 0 400 260" role="img" aria-label={m.formula}>
              {['speed', 'physics'].includes(lesson) ? (
                <>
                  <path d="M55 25V210H365" fill="none" stroke="#a7bbc8" strokeWidth="2" />
                  <path
                    d={`M55 210L${55 + b * 28} ${210 - Math.min(165, a * b * (lesson === 'physics' ? 1 : 0.1))}`}
                    stroke="#69d5be"
                    strokeWidth="4"
                  />
                  <text x="205" y="245" fill="white" textAnchor="middle">
                    الزمن: {b} — المسافة: {a * b}
                  </text>
                  <text x="200" y="27" fill="#f1c36c" textAnchor="middle">
                    الميل يتغير مع السرعة
                  </text>
                </>
              ) : (
                <>
                  <rect x="45" y="80" width="310" height="50" rx="6" fill="#294650" />
                  <rect
                    x="45"
                    y="80"
                    width={lesson === 'fractions' ? (310 * a) / 100 : Math.min(310, b * 25)}
                    height="50"
                    rx="6"
                    fill="#69d5be"
                  />
                  <text x="200" y="175" fill="white" textAnchor="middle" fontSize="20">
                    {a} {lesson === 'fractions' ? '% من' : '×'} {b}
                  </text>
                </>
              )}
            </svg>
          )}
          {verbal && (
            <div className="verbal-lab">
              {lesson === 'analogy' ? (
                <>
                  <div className="semantic-flow">
                    <strong>{['قلم', 'صفحة', 'عطش'][pair]}</strong>
                    <span>← {['أداة تؤدي وظيفة', 'جزء من كل', 'حاجة وما يسدها'][pair]} ←</span>
                    <strong>{['كتابة', 'كتاب', 'ماء'][pair]}</strong>
                  </div>
                  <div className="semantic-flow">
                    <strong>{['فرشاة', 'غرفة', 'جوع'][pair]}</strong>
                    <span>← العلاقة نفسها ←</span>
                    <strong>{['رسم', 'منزل', 'طعام'][pair]}</strong>
                  </div>
                  <button className="button mint" onClick={() => setPair((pair + 1) % 3)}>
                    جرّب علاقة أخرى
                  </button>
                </>
              ) : (
                <>
                  <p>
                    نباتان لهما التربة والماء نفسيهما.{' '}
                    <mark className={step > 0 ? 'lit' : ''}>
                      نما النبات القريب من النافذة أكثر.
                    </mark>{' '}
                    أوصى المعلم بتكرار التجربة قبل التعميم.
                  </p>
                  <div className="semantic-flow">
                    <strong>الضوء</strong>
                    <span>← عامل اختلف ←</span>
                    <strong>النمو</strong>
                  </div>
                  <button className="button mint" onClick={() => setStep(1)}>
                    أظهر دليل الاستنتاج
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="lab-controls">
          {lesson === 'rectangle' && (
            <div className="category-tabs" aria-label="المطلوب في المستطيل">
              <button
                aria-pressed={target === 'area'}
                onClick={() => {
                  setTarget('area');
                  setStep(0);
                  setStage(0);
                  setFeedback('');
                }}
              >
                المساحة
              </button>
              <button
                aria-pressed={target === 'perimeter'}
                onClick={() => {
                  setTarget('perimeter');
                  setStep(0);
                  setStage(0);
                  setFeedback('');
                }}
              >
                المحيط
              </button>
            </div>
          )}
          {!verbal &&
            m.labels.map((label, i) => (
              <label key={label}>
                {label}
                <output>{i === 0 ? a : b}</output>
                <input
                  aria-label={label}
                  type="range"
                  min={m.ranges[i][0]}
                  max={m.ranges[i][1]}
                  step="1"
                  value={i === 0 ? a : b}
                  onChange={(e) => change(i, +e.target.value)}
                />
              </label>
            ))}
          <p className="muted">حرّك القيم ولاحظ ما يتغير وما يبقى ثابتًا.</p>
          <ol className="lesson-steps">
            {steps.map((s, i) => (
              <li key={s} className={step === i ? 'active' : ''}>
                <button
                  onClick={() => {
                    setStep(i);
                    setPlaying(false);
                  }}
                  aria-current={step === i ? 'step' : undefined}
                >
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <div className="action-row">
            <button
              className="button ghost small"
              onClick={() => {
                if (step === 2) setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? 'إيقاف' : 'تشغيل الشرح'}
            </button>
            <button
              className="button ghost small"
              disabled={step === 0}
              onClick={() => {
                setStep(step - 1);
                setPlaying(false);
              }}
            >
              السابق
            </button>
            <button
              className="button primary small"
              disabled={step === 2}
              onClick={() => {
                setStep(step + 1);
                setPlaying(false);
              }}
            >
              التالي
            </button>
          </div>
          <p className="lab-formula" dir="auto" aria-live="polite">
            {step === 2 ? m.formula : steps[step]}
          </p>
          <button
            className="text-button"
            onClick={() => {
              if ('speechSynthesis' in window) {
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(spoken);
                u.lang = 'ar-SA';
                speechSynthesis.speak(u);
              }
            }}
          >
            اقرأ الخطوة بصوت الجهاز
          </button>
          <small className="muted">يتوقف توفر الصوت العربي على جهازك.</small>
        </div>
      </div>
      {!verbal && (
        <form className="socratic-box" onSubmit={check}>
          <span className="badge">نفكّر معًا</span>
          <h3>
            {stage === 0
              ? m.checkpoint.question
              : stage === 1
                ? 'والآن، ما قيمة المطلوب في هذا المثال؟ (قرّب إلى منزلتين عند الحاجة)'
                : 'وصلت إليها بنفسك'}
          </h3>
          {stage < 2 && (
            <div className="action-row">
              <input
                aria-label="إجابة الخطوة"
                inputMode="decimal"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="اكتب رقمًا"
              />
              <button className="button primary">تحقق من خطوتي</button>
            </div>
          )}
          <p aria-live="polite">{feedback}</p>
        </form>
      )}
      <div className="fast-strategy">
        <h3>طريقة أسرع للاختبار</h3>
        <p>
          {lesson === 'rectangle' && target === 'perimeter'
            ? 'اجمع الطول والعرض مرة واحدة ثم ضاعفهما. لا تضرب الطول في العرض؛ ذلك يحسب المساحة.'
            : meta.fast}
        </p>
        <small>متى تصلح؟ {meta.condition}</small>
      </div>
      <button className="button primary wide" onClick={onPractice}>
        جرّب ثلاث مسائل بنفسك ←
      </button>
    </section>
  );
}
