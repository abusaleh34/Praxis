'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Geometry } from '../geometry';
import { lessonById } from '@/lib/mentor-catalog';
import { labDefaults, labModel, normalizeNumber, validLabValues, labInputHelp } from '@/lib/lab';
import { TriangleProof, RectangleProof } from './visual-proof';
import { problemGuidance } from '@/lib/problem-guidance';
import { rememberMentor } from '@/lib/mentor-navigation';
export function Lab({ lesson, onPractice }: { lesson: string; onPractice: () => void }) {
  useEffect(
    () => () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    [],
  );
  const meta = lessonById.get(lesson)!;
  const defaults = labDefaults[lesson] ?? [50, 60];
  const params = useSearchParams();
  const inputA = Number(params.get('a')),
    inputB = Number(params.get('b'));
  const valid = params.has('a') && validLabValues(lesson, inputA, inputB);
  const a = valid ? inputA : defaults[0],
    b = valid ? inputB : defaults[1];
  const target = params.get('target') === 'perimeter' ? 'perimeter' : 'area';
  const step = Math.min(2, Math.max(0, Math.floor(Number(params.get('step')) || 0)));
  const [playing, setPlaying] = useState(false),
    [answer, setAnswer] = useState(''),
    [stage, setStage] = useState(0),
    [feedback, setFeedback] = useState(''),
    [pair, setPair] = useState(0);
  function update(values: Record<string, string | number>) {
    const u = new URL(location.href);
    Object.entries({ skill: lesson, a, b, target, step, ...values }).forEach(([k, v]) =>
      u.searchParams.set(k, String(v)),
    );
    history.replaceState(null, '', u);
    rememberMentor();
  }
  function setStep(next: number) {
    update({ step: next });
  }
  function setTarget(next: 'area' | 'perimeter') {
    update({ target: next, step: 0 });
  }
  useEffect(() => {
    setStage(0);
    setFeedback('');
    setAnswer('');
  }, [a, b, target]);
  useEffect(() => {
    if (!playing) return;
    if (step >= 2) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep(step + 1), 3400);
    return () => clearTimeout(t);
  }, [playing, step, a, b, target]);
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
      : lesson === 'chemistry'
        ? [
            'المطلوب كتلة العينة بوحدة غرام.',
            'الكتلة المولية هي كتلة مول واحد؛ نضربها في عدد المولات.',
            'غ/مول × مول = غ. تحقق من كتلة العينة ووحدتها.',
          ]
        : ['physics', 'speed'].includes(lesson)
          ? [
              'المطلوب المسافة المقطوعة بسرعة ثابتة.',
              'وحّد وحدتي السرعة والزمن، ثم اضرب السرعة في الزمن.',
              'تحقق من المسافة ووحدتها على المحور الرأسي.',
            ]
          : meta.steps;
  const guidance = problemGuidance(
    lesson,
    lesson === 'chemistry' ? 1 : lesson === 'rectangle' && target === 'perimeter' ? 1 : 0,
  );
  const graphTime = Math.max(10, b),
    graphDistance = Math.max(lesson === 'physics' ? 150 : 1200, a * b);
  const graphX = 55 + (b / graphTime) * 285,
    graphY = 210 - ((a * b) / graphDistance) * 140;
  const spoken = steps[step] + (step === 2 ? ' ' + m.formula : '');
  function change(index: number, v: number) {
    const nextA = index === 0 ? v : a;
    const nextB =
      index === 1 ? v : ['triangle', 'exterior'].includes(lesson) ? Math.min(b, 179 - v) : b;
    if (!validLabValues(lesson, nextA, nextB)) return;
    update({ a: nextA, b: nextB });
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
      {params.has('a') && !valid && !verbal && (
        <p role="alert" className="notice">
          القيم في الرابط غير صالحة: {labInputHelp(lesson)}. نعرض مثالًا افتراضيًا.
        </p>
      )}
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
                  <text x="64" y="202" fill="white">
                    0
                  </text>
                  <text x="200" y="45" fill="#a7bbc8" textAnchor="middle">
                    المحاور تتدرّج لتناسب القيم
                  </text>
                  <path d="M55 55V210H365" fill="none" stroke="#a7bbc8" strokeWidth="2" />
                  <text x="340" y="228" fill="#a7bbc8" textAnchor="middle" fontSize="12">
                    {graphTime}
                  </text>
                  <text x="50" y="75" fill="#a7bbc8" textAnchor="end" fontSize="12">
                    {graphDistance}
                  </text>
                  <circle cx={graphX} cy={graphY} r="4" fill="#f1c36c" />
                  <path d={`M55 210L${graphX} ${graphY}`} stroke="#69d5be" strokeWidth="4" />
                  <text x="205" y="245" fill="white" textAnchor="middle">
                    الزمن: {b} {lesson === 'physics' ? 'ث' : 'ساعة'} — المسافة: {a * b} {m.unit}
                  </text>
                  <text x="200" y="20" fill="#f1c36c" textAnchor="middle">
                    المسافة ({m.unit}) ↑ · الزمن ({lesson === 'physics' ? 'ث' : 'ساعة'}) →
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
                  min={Math.min(m.ranges[i][0], i === 0 ? a : b)}
                  max={Math.max(m.ranges[i][1], i === 0 ? a : b)}
                  step={lesson === 'polygon' ? 1 : 'any'}
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
        <p>{verbal || lesson === 'fractions' ? meta.fast : guidance.fast}</p>
        <small>متى تصلح؟ {guidance.condition}</small>
      </div>
      <button className="button primary wide" onClick={onPractice}>
        جرّب ثلاث مسائل بنفسك ←
      </button>
    </section>
  );
}
