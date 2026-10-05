'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuestionTimer } from './use-question-timer';
import { api, post } from '../client';
import { Geometry } from '../geometry';
import type { Diagram } from '@/lib/types';
import { lessonById } from '@/lib/mentor-catalog';
import { rememberMentor, sessionHref } from '@/lib/mentor-navigation';
type Guide = { question: string; choices: string[]; index: number; total: number };
type Question = {
  id: string;
  lesson: string;
  name: string;
  prompt: string;
  choices: string[];
  unit: string;
  diagram?: Diagram;
  passage?: string;
  hint?: string;
  hints: number;
  chosen: number | null;
  firstChosen: number | null;
  flagged: boolean;
  guide: Guide | null;
  firstCorrect: boolean;
  assisted: boolean;
  resolved: boolean;
  elapsedMs: number;
  answer?: number;
  steps?: string[];
  fast?: string;
  condition?: string;
  bridge?: string;
  explanationHref?: string;
};
type Batch = {
  id: string;
  mode: string;
  total: number;
  index: number;
  finished: boolean;
  deadline: string | null;
  question: Question | null;
  score?: number;
  results?: Question[];
  navigation?: { id: string; position: number; answered: boolean; flagged: boolean }[];
};
export function Exercise({
  lesson,
  mode = 'learn',
  reviewOnly = false,
  active = true,
  batchId,
}: {
  lesson: string;
  mode?: 'learn' | 'speed' | 'exam';
  reviewOnly?: boolean;
  active?: boolean;
  batchId?: string | null;
}) {
  const [batch, setBatch] = useState<Batch | null>(null),
    [choice, setChoice] = useState<number | null>(null),
    [feedback, setFeedback] = useState<any>(null),
    [hint, setHint] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [guest, setGuest] = useState(false),
    [remaining, setRemaining] = useState(360),
    [sessions, setSessions] = useState<any[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null),
    [submitReview, setSubmitReview] = useState(false),
    [loginHref, setLoginHref] = useState('/start');
  const [model, setModel] = useState(false),
    [message, setMessage] = useState(''),
    [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const expired = useRef(false),
    requestedBatch = useRef<string | null>(null);
  const q = batch?.question;
  const { seconds, readElapsed } = useQuestionTimer(
    q?.id,
    active && !reviewOnly && !busy && !batch?.finished && !feedback?.resolved && !submitReview,
    q?.elapsedMs ?? 0,
  );

  async function load(id: string, position?: number) {
    setBusy(true);
    setError('');
    try {
      const state = await api<Batch>(
        'mentor?id=' + id + (position === undefined ? '' : '&position=' + position),
      );
      setBatch(state);
      setSubmitReview(false);
      setGuide(state.question?.guide ?? null);
      setFeedback(
        state.mode !== 'exam' && state.question?.firstCorrect === false
          ? { correct: false, resolved: false }
          : null,
      );
      setHint(state.question?.hint ?? '');
      setChoice(
        state.question?.chosen !== null &&
          state.question?.chosen !== undefined &&
          state.question.chosen >= 0
          ? state.question.chosen
          : null,
      );
      expired.current = false;
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  function failure(e: unknown) {
    const err = e as Error & { status?: number };
    if (err.status === 401) {
      setGuest(true);
      setError('');
    } else setError(err.message);
  }
  useEffect(() => {
    api<{ sessions: any[]; vision: boolean }>('mentor')
      .then((d) => {
        setSessions(d.sessions);
        setModel(d.vision);
      })
      .catch(failure);
    setLoginHref('/start?next=' + encodeURIComponent(location.pathname + location.search));
  }, [reviewOnly]);
  useEffect(() => {
    const id = batchId ?? null;
    if (requestedBatch.current === id) return;
    requestedBatch.current = id;
    if (id && /^[a-f0-9-]{36}$/.test(id)) void load(id);
    else {
      setBatch(null);
      setFeedback(null);
      setChoice(null);
      setHint('');
      setGuide(null);
    }
  }, [batchId]);
  useEffect(() => {
    setLoginHref('/start?next=' + encodeURIComponent(location.pathname + location.search));
  }, [reviewOnly, lesson]);
  useEffect(() => {
    setChat([]);
    setMessage('');
  }, [q?.id]);
  useEffect(() => {
    if (!batch?.deadline || batch.finished) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((Date.parse(batch.deadline!) - Date.now()) / 1000));
      setRemaining(left);
      if (!left && !expired.current) {
        expired.current = true;
        void finish(false);
      }
    }, 500);
    return () => clearInterval(t);
  }, [batch?.id, batch?.finished]);
  async function start() {
    setBusy(true);
    setError('');
    try {
      const d = await post<{ id: string }>('mentor', { action: 'start', lesson, mode });
      const url = new URL(location.href);
      requestedBatch.current = d.id;
      url.searchParams.set('batch', d.id);
      url.searchParams.set('view', 'practice');
      url.searchParams.set('mode', mode);
      url.searchParams.set('skill', lesson);
      history.replaceState(null, '', url);
      rememberMentor();
      await load(d.id);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function answer(reveal = false, skip = false) {
    if (!q || !batch) return;
    setBusy(true);
    setError('');
    try {
      const result = await post('mentor', {
        action: 'answer',
        id: q.id,
        choice: skip ? -1 : (choice ?? -1),
        elapsedMs: readElapsed(),
        reveal,
      });
      if (batch.mode === 'exam') {
        await load(batch.id, batch.index + 1 < batch.total ? batch.index + 1 : undefined);
      } else {
        setFeedback(result);
        if (result.hint && !result.resolved) setHint(result.hint);
      }
    } catch (e) {
      failure(e);
      if ((e as any).status === 409) await load(batch.id);
    } finally {
      setBusy(false);
    }
  }
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q || !message.trim()) return;
    setBusy(true);
    setError('');
    try {
      const d = await post<{ text: string }>('tutor', {
        id: q.id,
        message,
        history: chat.slice(-6).map((m) => ({ ...m, content: m.content.slice(0, 1000) })),
      });
      setChat([
        ...chat,
        { role: 'user', content: message },
        { role: 'assistant', content: d.text },
      ]);
      setMessage('');
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function askHint() {
    if (!q) return;
    setBusy(true);
    try {
      const d = await post('mentor', { action: 'hint', id: q.id });
      setHint(d.hint);
      setGuide(d.guide);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function respondToGuide(choice: number) {
    if (!q || !guide) return;
    setBusy(true);
    try {
      const d = await post('mentor', { action: 'guide', id: q.id, index: guide.index, choice });
      setGuide(d.guide);
      setHint(d.hint);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function navigate(position: number) {
    if (!batch || !q) {
      if (batch) await load(batch.id, position);
      return;
    }
    setBusy(true);
    try {
      if (choice !== null && choice !== q.chosen)
        await post('mentor', {
          action: 'answer',
          id: q.id,
          choice,
          elapsedMs: readElapsed(),
        });
      await load(batch.id, position);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function flag() {
    if (!q || !batch) return;
    setBusy(true);
    try {
      await post('mentor', { action: 'flag', id: q.id, flagged: !q.flagged });
      setBatch({
        ...batch,
        question: { ...q, flagged: !q.flagged },
        navigation: batch.navigation?.map((n) =>
          n.id === q.id ? { ...n, flagged: !q.flagged } : n,
        ),
      });
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function reviewSubmission() {
    if (!batch) return;
    setBusy(true);
    try {
      if (q && choice !== null && choice !== q.chosen)
        await post('mentor', {
          action: 'answer',
          id: q.id,
          choice,
          elapsedMs: readElapsed(),
        });
      await load(batch.id, q ? batch.index : undefined);
      setSubmitReview(true);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function finish(confirm = true) {
    if (!batch) return;
    if (confirm && !submitReview) {
      await reviewSubmission();
      return;
    }
    setBusy(true);
    try {
      await post('mentor', { action: 'finish', id: batch.id });
      await load(batch.id);
    } catch (e) {
      failure(e);
      expired.current = false;
    } finally {
      setBusy(false);
    }
  }
  if (reviewOnly)
    return (
      <section className="panel session-history" aria-label="جلساتك السابقة">
        <h2>راجع تدريباتك</h2>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {guest && <Link href={loginHref}>ادخل لعرض جلساتك</Link>}
        <div className="session-links">
          {sessions.map((s) => (
            <Link key={s.id} className="text-button" href={sessionHref(s)}>
              {s.mode === 'exam' ? 'تدريب مؤقّت' : lessonById.get(s.lesson)?.name} ·{' '}
              {new Date(s.created_at).toLocaleDateString('ar-SA')} ·{' '}
              {s.completed_at ? 'النتيجة' : 'استئناف'}
            </Link>
          ))}
        </div>
        {!guest && !sessions.length && <p>لا توجد جلسات بعد. انتقل إلى «جرّب» وابدأ تدريبًا.</p>}
      </section>
    );
  return (
    <section className="panel exercise" id="practice">
      <div className="panel-heading">
        <div>
          <span className="badge">
            {mode === 'exam' ? 'محاكاة تدريبية' : mode === 'speed' ? 'سرعة مع فهم' : 'ثبّت الفكرة'}
            {mode !== 'exam' && ` · ${lessonById.get(lesson)?.name}`}
          </span>
          <h2>
            {mode === 'exam'
              ? 'ستة أسئلة في ست دقائق'
              : mode === 'speed'
                ? 'حاول في أقل من دقيقة'
                : 'ثلاث مسائل متدرّجة'}
          </h2>
        </div>
        {!batch && !reviewOnly && (
          <button disabled={busy} className="button primary" onClick={start}>
            {busy ? 'نجهز الأسئلة…' : 'ابدأ التدريب'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {guest && (
        <p>
          <Link
            className="button primary"
            href={loginHref}
            onClick={(e) => {
              e.preventDefault();
              location.href =
                '/start?next=' + encodeURIComponent(location.pathname + location.search);
            }}
          >
            ادخل لحفظ محاولاتك
          </Link>
        </p>
      )}
      {!batch && (
        <>
          {sessions
            .filter((s) => !s.completed_at && !reviewOnly)
            .slice(0, 1)
            .map((s) => (
              <a className="resume-card" href={sessionHref(s)} key={s.id}>
                أكمل{' '}
                {s.mode === 'exam'
                  ? 'التدريب المؤقّت'
                  : 'تدريب ' + (lessonById.get(s.lesson)?.name ?? '')}{' '}
                — السؤال {Math.min(s.done + 1, s.total)} من {s.total} ←
              </a>
            ))}
          <p>
            الأسئلة تتغير في الأرقام وطريقة الطلب. تُحفظ صحة محاولتك الأولى ووقت السؤال واستخدامك
            للتلميحات.
          </p>
          {mode === 'exam' && (
            <p className="notice">
              تدريب مختصر للكمي واللفظي. الزمن مستمر عند مغادرة الصفحة. هذه ليست محاكاة كاملة لشروط
              قياس أو مقياسًا لدرجتك الرسمية.
            </p>
          )}
          {sessions.length > 0 && (
            <details open={reviewOnly}>
              <summary>جلساتك الأخيرة</summary>
              <div className="session-links">
                {sessions
                  .filter((s) => !reviewOnly || s.completed_at)
                  .slice(0, 12)
                  .map((s) => (
                    <a key={s.id} className="text-button" href={sessionHref(s)}>
                      {s.mode === 'exam'
                        ? 'تدريب مؤقّت'
                        : s.mode === 'speed'
                          ? 'تدريب سرعة'
                          : 'تدريب المهارة'}{' '}
                      · {s.mode !== 'exam' ? lessonById.get(s.lesson)?.name : 'كمي ولفظي'} ·{' '}
                      {new Date(s.created_at).toLocaleDateString('ar-SA')} ·{' '}
                      {s.completed_at ? 'النتيجة' : 'استئناف'}
                    </a>
                  ))}
              </div>
            </details>
          )}
          {reviewOnly && !sessions.some((s) => s.completed_at) && (
            <p>لا توجد جلسات مكتملة بعد. انتقل إلى «جرّب» وابدأ تدريبًا.</p>
          )}
        </>
      )}
      {batch && !batch.finished && (
        <>
          <div className="exercise-meta">
            <strong>
              السؤال {Math.min(batch.index + 1, batch.total)} من {batch.total}
            </strong>
            <span role="timer">
              {batch.mode === 'exam'
                ? `المتبقي ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
                : `${seconds} ثانية`}
            </span>
          </div>
          {batch.mode === 'exam' && (
            <>
              <nav className="exam-navigation" aria-label="أسئلة التدريب المؤقّت">
                {batch.navigation?.map((n) => (
                  <button
                    key={n.id}
                    disabled={busy}
                    aria-current={batch.index === n.position ? 'step' : undefined}
                    aria-label={`السؤال ${n.position + 1}${n.answered ? '، تمت الإجابة' : '، دون إجابة'}${n.flagged ? '، للمراجعة' : ''}`}
                    onClick={() => navigate(n.position)}
                  >
                    {n.position + 1}
                    {n.answered ? ' ✓' : ''}
                    {n.flagged ? ' ⚑' : ''}
                  </button>
                ))}
              </nav>
              <p className="muted">
                يمكنك الرجوع لأي سؤال وتعديل إجابتك حتى التسليم. ✓ إجابة محفوظة · ⚑ للمراجعة
              </p>
              {submitReview && (
                <div className="submission-review" role="region" aria-label="مراجعة قبل التسليم">
                  <h3>قبل تسليم التدريب</h3>
                  <p>
                    أجبت عن {batch.navigation?.filter((n) => n.answered).length} من {batch.total}.
                  </p>
                  <p>
                    دون إجابة:{' '}
                    {batch.navigation
                      ?.filter((n) => !n.answered)
                      .map((n) => n.position + 1)
                      .join('، ') || 'لا يوجد'}
                  </p>
                  <p>
                    للمراجعة:{' '}
                    {batch.navigation
                      ?.filter((n) => n.flagged)
                      .map((n) => n.position + 1)
                      .join('، ') || 'لا يوجد'}
                  </p>
                  <button className="button primary" disabled={busy} onClick={() => finish()}>
                    تأكيد التسليم
                  </button>
                  <button className="button ghost" onClick={() => setSubmitReview(false)}>
                    أكمل المراجعة
                  </button>
                </div>
              )}
            </>
          )}
          {q ? (
            <>
              <h3>{q.name}</h3>
              {q.bridge && batch.mode !== 'exam' && (
                <p className="notice problem-bridge">{q.bridge}</p>
              )}
              <h2>{q.prompt}</h2>
              {q.passage && <blockquote className="reading-passage">{q.passage}</blockquote>}
              <div className={q.diagram ? 'exercise-grid' : ''}>
                {q.diagram && (
                  <div>
                    <Geometry diagram={q.diagram} highlight={hint ? 'relation' : 'given'} />
                  </div>
                )}
                <div>
                  <div className="mentor-choices" role="radiogroup" aria-label="اختيارات السؤال">
                    {q.choices.map((c, i) => (
                      <label key={i} className={choice === i ? 'selected' : ''}>
                        <input
                          type="radio"
                          name={q.id}
                          checked={choice === i}
                          disabled={busy || feedback?.resolved}
                          onChange={() => setChoice(i)}
                        />
                        <span>
                          {c} {q.unit}
                        </span>
                      </label>
                    ))}
                  </div>
                  {hint && (
                    <div className="socratic-box" aria-live="polite">
                      {hint}
                    </div>
                  )}
                  {guide && !feedback?.resolved && (
                    <div className="guide-question" aria-live="polite">
                      <small>
                        خطوة {guide.index + 1} من {guide.total}
                      </small>
                      <h3>{guide.question}</h3>
                      <div className="action-row">
                        {guide.choices.map((c, i) => (
                          <button
                            key={c}
                            className="button ghost"
                            disabled={busy}
                            onClick={() => respondToGuide(i)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {feedback && !feedback.resolved && (
                    <p role="status">لم تصل بعد. استخدم السؤال الموجّه ثم جرّب خيارًا آخر.</p>
                  )}
                  {feedback?.resolved && (
                    <div className="answer-explanation" role="status">
                      <strong>
                        {feedback.correct ? 'أحسنت، إجابتك صحيحة.' : 'لنراجع طريقة الحل.'}
                      </strong>
                      <p>
                        الإجابة: {q.choices[feedback.answer]} {q.unit}
                      </p>
                      <ol>
                        {feedback.steps?.map((s: string) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                      <p className="muted">
                        تُحسب المحاولة الأولى في التقدّم، حتى لو صحّحت إجابتك لاحقًا.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="action-row">
                {feedback?.resolved ? (
                  <button disabled={busy} className="button primary" onClick={() => load(batch.id)}>
                    {batch.index + 1 === batch.total ? 'اعرض النتيجة' : 'السؤال التالي'}
                  </button>
                ) : (
                  <>
                    <button
                      className="button primary"
                      disabled={busy || choice === null}
                      onClick={() => answer()}
                    >
                      {batch.mode === 'exam' ? 'حفظ والانتقال' : 'تحقق من الإجابة'}
                    </button>
                    <button
                      className="button ghost"
                      disabled={busy}
                      onClick={() => answer(false, true)}
                    >
                      لا أعرف
                    </button>
                    {batch.mode === 'exam' && (
                      <button
                        className="button ghost"
                        aria-pressed={q.flagged}
                        disabled={busy}
                        onClick={flag}
                      >
                        {q.flagged ? 'إزالة علامة المراجعة' : 'علّم للمراجعة'}
                      </button>
                    )}
                    {batch.mode !== 'exam' && (
                      <>
                        <button
                          className="button ghost"
                          disabled={busy || Boolean(guide)}
                          onClick={askHint}
                        >
                          ساعدني بسؤال
                        </button>
                        {feedback && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => answer(true)}
                          >
                            اشرح الحل
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p>أجبت عن كل الأسئلة. سلّم التدريب لتظهر المراجعة.</p>
          )}
          {q && model && batch.mode !== 'exam' && (
            <form className="tutor-chat" onSubmit={ask}>
              <h3>اسأل عن الخطوة التي أوقفتك</h3>
              <div aria-live="polite">
                {chat.map((m, i) => (
                  <p key={i} className={m.role}>
                    <strong>{m.role === 'user' ? 'أنت: ' : 'المدرّب: '}</strong>
                    {m.content}
                  </p>
                ))}
              </div>
              <div className="action-row">
                <input
                  aria-label="سؤالك للمدرب"
                  value={message}
                  maxLength={1000}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="لماذا قسمنا على اثنين؟"
                />
                <button className="button primary" disabled={busy || !message.trim()}>
                  اسأل المدرّب
                </button>
              </div>
              <small>قد يخطئ المدرب؛ يمكنك دائمًا الرجوع إلى الحل المرجعي.</small>
            </form>
          )}
          {batch.mode === 'exam' && (
            <button className="text-button" disabled={busy} onClick={() => finish()}>
              تسليم وعرض النتيجة
            </button>
          )}
        </>
      )}
      {batch?.finished && (
        <div className="mentor-results">
          <h2>
            نتيجتك: {batch.score} من {batch.total}
          </h2>
          <p>
            {batch.mode === 'exam'
              ? 'الدرجة للإجابة النهائية المحفوظة عند التسليم.'
              : 'الدرجة للمحاولة الأولى؛ تصحيح الإجابة لاحقًا يظهر أدناه.'}{' '}
            راجع السؤال والوقت وطريقة الاختصار.
          </p>
          {batch.results?.map((r) => (
            <article key={r.id} className="result-card">
              <div className="exercise-meta">
                <strong>
                  {r.firstCorrect
                    ? batch.mode === 'exam'
                      ? '✓ إجابة نهائية صحيحة'
                      : '✓ صحيح من أول محاولة'
                    : r.chosen === null
                      ? 'دون إجابة'
                      : 'نراجع الفكرة'}
                </strong>
                <span>
                  {Math.round(r.elapsedMs / 1000)} ثانية {r.assisted ? '· بمساعدة' : ''}
                </span>
              </div>
              <h3>{r.prompt}</h3>
              <p>
                {batch.mode === 'exam' ? 'إجابتك النهائية: ' : 'محاولتك الأولى: '}
                {batch.mode === 'exam'
                  ? r.chosen === null || r.chosen < 0
                    ? 'لم أجب'
                    : r.choices[r.chosen]
                  : r.firstChosen === null || r.firstChosen < 0
                    ? 'لا أعرف / لم أجب'
                    : r.choices[r.firstChosen]}{' '}
                {r.unit}
                {batch.mode !== 'exam' && r.chosen !== r.firstChosen && (
                  <>
                    {' '}
                    · بعد التصحيح:{' '}
                    {r.chosen === null || r.chosen < 0 ? 'لم أجب' : r.choices[r.chosen]} {r.unit}
                  </>
                )}{' '}
                · الصحيح: {r.choices[r.answer!]} {r.unit}
              </p>
              <ol>
                {r.steps?.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p>
                <strong>الاختصار: </strong>
                {r.fast}
              </p>
              <small>{r.condition}</small>
              {r.elapsedMs > 60000 && (
                <p className="notice">
                  استغرق السؤال أكثر من دقيقة. جرّب الاختصار في مسألة مشابهة؛ لا يلزم أن تصل للسرعة
                  نفسها من أول مرة.
                </p>
              )}
              <Link
                href={r.explanationHref ?? '/mentor?skill=' + r.lesson + '&view=learn'}
                className="text-button"
              >
                افهم {r.name} بالرسم ←
              </Link>
            </article>
          ))}
          <div className="action-row">
            <button className="button primary" disabled={busy} onClick={start}>
              تدريب جديد
            </button>
            <Link className="button ghost" href="/report">
              تقرير التقدّم
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
