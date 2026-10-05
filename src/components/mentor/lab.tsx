'use client';
import { useEffect, useState } from 'react';
import { Geometry } from '../geometry';
import { lessonById } from '@/lib/mentor-catalog';
import { labDefaults, labModel, normalizeNumber } from '@/lib/lab';
export function Lab({
  lesson,
  imported,
}: {
  lesson: string;
  imported?: { a: number; b: number; stamp: number };
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
      setA(imported.a);
      setB(imported.b);
      setStep(0);
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
      2200,
    );
    return () => clearInterval(t);
  }, [playing]);
  const m = labModel(lesson, a, b),
    verbal = ['analogy', 'reading'].includes(lesson);
  const spoken = meta.steps[step] + (step === 2 ? ' ' + m.formula : '');
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
          {m.diagram && (
            <Geometry
              diagram={m.diagram}
              highlight={step === 0 ? 'given' : step === 1 ? 'relation' : 'target'}
            />
          )}
          {lesson === 'triangle' && step > 0 && (
            <svg
              className="angle-proof"
              viewBox="0 0 360 95"
              role="img"
              aria-label="تمثيل مجموع الزوايا الثلاث على نصف دورة يساوي 180 درجة"
            >
              <path d="M30 60H330" stroke="#b7edda" strokeWidth="2" />
              {[a, b, 180 - a - b].map((v, i) => {
                const start = i === 0 ? 0 : i === 1 ? a : a + b;
                const x1 = 180 - 65 * Math.cos((start * Math.PI) / 180),
                  y1 = 60 - 65 * Math.sin((start * Math.PI) / 180),
                  x2 = 180 - 65 * Math.cos(((start + v) * Math.PI) / 180),
                  y2 = 60 - 65 * Math.sin(((start + v) * Math.PI) / 180);
                return (
                  <path
                    key={i}
                    d={`M180 60L${x1} ${y1}A65 65 0 0 1 ${x2} ${y2}Z`}
                    fill={['#69d5be', '#f1c36c', '#b9a2ee'][i]}
                    opacity=".8"
                  />
                );
              })}
              <text x="180" y="88" textAnchor="middle" fill="white" fontSize="15">
                {a}° + {b}° + {180 - a - b}° = 180°
              </text>
            </svg>
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
            {meta.steps.map((s, i) => (
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
              onClick={() => setStep(step - 1)}
            >
              السابق
            </button>
            <button
              className="button primary small"
              disabled={step === 2}
              onClick={() => setStep(step + 1)}
            >
              التالي
            </button>
          </div>
          <p className="lab-formula" dir="auto" aria-live="polite">
            {step === 2 ? m.formula : meta.steps[step]}
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
        <p>{meta.fast}</p>
        <small>متى تصلح؟ {meta.condition}</small>
      </div>
    </section>
  );
}
