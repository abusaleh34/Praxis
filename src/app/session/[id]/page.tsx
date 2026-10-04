'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Shell } from '@/components/shell';
import { Icon } from '@/components/icon';
import { Geometry } from '@/components/geometry';
import { MathText } from '@/components/math-text';
import { api, post } from '@/components/client';
import type { StudyState, Hint } from '@/lib/types';
type Feedback = {
  correct?: boolean;
  resolved: boolean;
  feedback?: string;
  steps?: string[];
  answerIndex?: number;
  assessment?: boolean;
};
const labels = { pre: 'الاختبار القبلي', practice: 'جلسة تدريب', post: 'الاختبار البعدي' };
export default function Session() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<StudyState | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [hints, setHints] = useState<Hint[]>([]),
    [activeHint, setActiveHint] = useState(-1),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [busy, setBusy] = useState(false),
    [hintBusy, setHintBusy] = useState(false),
    [error, setError] = useState('');
  const started = useRef(0);
  async function load() {
    const s = await api<StudyState>('sessions/' + id);
    setState(s);
    setSelected(null);
    setHints(s.hints);
    setActiveHint(s.hints.length - 1);
    setFeedback(null);
    started.current = Date.now();
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
  useEffect(() => {
    load().catch((e) => {
      if (e.status === 401) router.replace('/start');
      else setError(e.message);
    });
  }, [id]); // The route ID owns this session.
  async function getHint(choice = selected) {
    if (!state?.question || hints.length >= 3 || hintBusy) return;
    setHintBusy(true);
    setError('');
    try {
      const h = await post<Hint>(`sessions/${id}/hint`, {
        questionId: state.question.id,
        stage: hints.length + 1,
        choice,
      });
      setHints((prev) => [...prev, h]);
      setActiveHint(hints.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHintBusy(false);
    }
  }
  async function submit(reveal = false) {
    if (!state?.question || busy || (!reveal && selected === null)) return;
    setBusy(true);
    setError('');
    try {
      const result = await post<Feedback>(`sessions/${id}/answer`, {
        questionId: state.question.id,
        choice: reveal ? null : selected,
        elapsedMs: Math.max(0, Math.min(3600000, Date.now() - started.current)),
        reveal,
      });
      if (result.assessment) {
        await load();
      } else {
        setFeedback(result);
        if (!result.resolved) {
          if (hints.length === 0) await getHint(selected);
          setSelected(null);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    setBusy(true);
    setError('');
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function another() {
    setBusy(true);
    try {
      const s = await post('sessions', { kind: 'practice' });
      router.push('/session/' + s.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Shell>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!state ? (
        <div className="loading" role="status">
          نحضّر السؤال…
        </div>
      ) : state.completed ? (
        <section className="completion">
          <span className="icon-box">
            <Icon name="check" size={35} />
          </span>
          <span className="overline">خطوة أنجزتها.</span>
          <h1>{state.kind === 'practice' ? 'أحسنت، أكملت الجلسة!' : 'اكتمل الاختبار.'}</h1>
          <p>
            {state.kind === 'pre'
              ? 'هذه نقطة البداية. الآن نبدأ التدرّب، ونعود للمقارنة بعد أسبوعين.'
              : state.kind === 'post'
                ? 'صار بإمكانك مقارنة نتيجتك بنقطة البداية، ورؤية ما تغيّر.'
                : 'كل محاولة، حتى الخاطئة، فرصة لفهم أفضل.'}
          </p>
          <div className="score-big">
            {state.score}
            <small> / {state.total}</small>
          </div>
          <p>{state.kind === 'practice' ? 'إجابات صحيحة من المحاولة الأولى' : 'إجابات صحيحة'}</p>
          <div className="completion-actions">
            {state.kind !== 'post' && (
              <button className="button primary" disabled={busy} onClick={another}>
                {busy ? 'نجهّز الجلسة…' : 'لنواصل التدرّب'}
                <Icon name="arrow" size={17} />
              </button>
            )}
            <Link href="/progress" className="button ghost">
              شاهد تقدمك
            </Link>
          </div>
        </section>
      ) : state.question ? (
        <>
          <div className="session-top">
            <Link className="text-button" href="/learn">
              <Icon name="chevron" /> مساحتي
            </Link>
            <div className="session-title">
              <h1>{labels[state.kind]}</h1>
              <span>
                {state.kind === 'practice'
                  ? 'جرّب. لاحظ. ثم افهم.'
                  : 'من دون تلميحات، لتكون المقارنة مفيدة.'}
              </span>
            </div>
            <span className="session-count">
              {state.index + 1} من {state.total}
            </span>
          </div>
          <div
            className="session-progress"
            role="progressbar"
            aria-label="تقدم الجلسة"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={state.index}
          >
            <span style={{ width: `${(state.index / state.total) * 100}%` }} />
          </div>
          <h2 className="mobile-question-heading">
            <MathText>{state.question.prompt}</MathText>
          </h2>
          <div className="question-grid">
            <section className="question-panel">
              <div className="question-meta">
                <span className="badge">{state.question.skill}</span>
                <span className="small-label">{state.question.difficulty}</span>
              </div>
              <h2 id="question-title">
                <MathText>{state.question.prompt}</MathText>
              </h2>
              <div className="answer-options" role="radiogroup" aria-labelledby="question-title">
                {state.question.choices.map((value, index) => (
                  <label
                    key={index}
                    className={`answer-choice ${selected === index ? 'selected' : ''} ${feedback?.resolved && feedback.answerIndex === index ? 'correct' : ''} ${feedback?.resolved && selected === index && feedback.answerIndex !== index ? 'wrong' : ''}`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={index}
                      checked={selected === index}
                      disabled={busy || Boolean(feedback?.resolved)}
                      onChange={() => setSelected(index)}
                    />
                    <span className="answer-letter">{['أ', 'ب', 'ج', 'د'][index]}</span>
                    <span className="answer-number">
                      <bdi>{value}</bdi>
                      <small>{state!.question!.unit}</small>
                    </span>
                  </label>
                ))}
              </div>
              {feedback && (
                <div className={`feedback ${feedback.correct ? 'good' : 'retry'}`} role="status">
                  {feedback.resolved && !feedback.correct
                    ? 'نراجع الفكرة معًا، ثم نكمل.'
                    : feedback.feedback}
                </div>
              )}
              {feedback?.resolved ? (
                <>
                  <details className="solution" open>
                    <summary>خطوات الحل</summary>
                    <ol>
                      {feedback.steps?.map((s) => (
                        <li key={s}>
                          <MathText>{s}</MathText>
                        </li>
                      ))}
                    </ol>
                  </details>
                  <button className="button primary" onClick={next} disabled={busy}>
                    {state.index + 1 === state.total ? 'شاهد ملخص الجلسة' : 'السؤال التالي'}
                    <Icon name="arrow" size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button primary"
                    disabled={selected === null || busy || hintBusy}
                    onClick={() => submit()}
                  >
                    {busy ? 'نراجع المحاولة…' : feedback ? 'جرّب مرة أخرى' : 'تأكيد الإجابة'}
                    <Icon name="check" size={18} />
                  </button>
                  {feedback && !feedback.resolved && (
                    <button
                      disabled={busy || hintBusy}
                      className="text-button"
                      style={{ marginTop: 14 }}
                      onClick={() => submit(true)}
                    >
                      اعرض خطوات الحل
                    </button>
                  )}
                </>
              )}
            </section>
            <aside className="question-side">
              <div className="geometry-card">
                <div className="geometry-bar">
                  <span>نرى الفكرة معًا</span>
                  <Icon name="triangle" size={15} />
                </div>
                <Geometry
                  diagram={state.question.diagram}
                  highlight={hints[activeHint]?.highlight ?? ''}
                />
              </div>
              {state.kind === 'practice' ? (
                <section className="coach-panel">
                  <div className="coach-heading">
                    <span className="icon-box">
                      <Icon name="spark" size={20} />
                    </span>
                    <div>
                      <h3>خطوة تساعدك</h3>
                      <span>تلميح عند الحاجة، لا استعجال.</span>
                    </div>
                  </div>
                  {hints.length === 0 ? (
                    <p>خذ لحظة تفكّر. وإذا احتجت مساعدة، نبدأ بتلميح يقرّب الفكرة.</p>
                  ) : (
                    <>
                      <div className="hint-tabs" role="tablist" aria-label="التلميحات">
                        {hints.map((h, i) => (
                          <button
                            role="tab"
                            aria-selected={activeHint === i}
                            className={activeHint === i ? 'active' : ''}
                            key={i}
                            onClick={() => setActiveHint(i)}
                          >
                            تلميح {i + 1}
                          </button>
                        ))}
                      </div>
                      <div className="hint-text" role="status">
                        <MathText>{hints[activeHint]?.text ?? ''}</MathText>
                      </div>
                    </>
                  )}
                  <div className="coach-foot">
                    <button
                      className="text-button"
                      disabled={
                        hints.length >= 3 || hintBusy || busy || Boolean(feedback?.resolved)
                      }
                      onClick={() => getHint()}
                    >
                      <Icon name="spark" size={15} />
                      {hintBusy
                        ? 'نجهّز التلميح…'
                        : hints.length === 3
                          ? 'اكتملت التلميحات'
                          : hints.length
                            ? 'تلميح آخر'
                            : 'أحتاج تلميحًا'}
                    </button>
                    <span>{hints.length} / 3</span>
                  </div>
                </section>
              ) : (
                <div className="notice">
                  <Icon name="shield" size={18} />
                  <p>لن تظهر صحة الإجابات أثناء الاختبار. ترى النتيجة بعد إكمال الأسئلة.</p>
                </div>
              )}
            </aside>
          </div>
          <p className="session-note">
            <Icon name="shield" size={11} /> محاولاتك محفوظة. يمكنك العودة لإكمال الجلسة.
          </p>
        </>
      ) : null}
    </Shell>
  );
}
