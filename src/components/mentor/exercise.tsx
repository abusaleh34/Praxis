'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../client';
import { Geometry } from '../geometry';
import type { Diagram } from '@/lib/types';
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
  firstCorrect: boolean;
  assisted: boolean;
  resolved: boolean;
  elapsedMs: number;
  answer?: number;
  steps?: string[];
  fast?: string;
  condition?: string;
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
};
export function Exercise({
  lesson,
  mode = 'learn',
}: {
  lesson: string;
  mode?: 'learn' | 'speed' | 'exam';
}) {
  const [batch, setBatch] = useState<Batch | null>(null),
    [choice, setChoice] = useState<number | null>(null),
    [feedback, setFeedback] = useState<any>(null),
    [hint, setHint] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [guest, setGuest] = useState(false),
    [seconds, setSeconds] = useState(0),
    [remaining, setRemaining] = useState(360),
    [sessions, setSessions] = useState<any[]>([]);
  const [model, setModel] = useState(false),
    [message, setMessage] = useState(''),
    [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const elapsed = useRef(0),
    expired = useRef(false);
  const q = batch?.question;
  async function load(id: string) {
    setBusy(true);
    setError('');
    try {
      const state = await api<Batch>('mentor?id=' + id);
      setBatch(state);
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
    const id = new URLSearchParams(location.search).get('batch');
    if (id && /^[a-f0-9-]{36}$/.test(id)) void load(id);
  }, []);
  useEffect(() => {
    setChat([]);
    setMessage('');
  }, [q?.id]);
  useEffect(() => {
    if (!q?.id) return;
    const key = 'praxis-time:' + q.id;
    elapsed.current = Number(sessionStorage.getItem(key)) || 0;
    setSeconds(Math.floor(elapsed.current / 1000));
    let previous = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && !feedback?.resolved) {
        elapsed.current += now - previous;
        sessionStorage.setItem(key, String(Math.floor(elapsed.current)));
        setSeconds(Math.floor(elapsed.current / 1000));
      }
      previous = now;
    }, 500);
    return () => clearInterval(t);
  }, [q?.id, feedback?.resolved]);
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
      url.searchParams.set('batch', d.id);
      url.searchParams.set('mode', mode);
      url.searchParams.set('skill', lesson);
      history.replaceState(null, '', url);
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
        elapsedMs: Math.min(3600000, Math.floor(elapsed.current)),
        reveal,
      });
      if (batch.mode === 'exam') {
        await load(batch.id);
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
      setHint([d.hint, d.step].filter(Boolean).join(' '));
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function finish(confirm = true) {
    if (!batch) return;
    if (confirm && !window.confirm('تسليم التدريب الآن؟ الأسئلة المتبقية ستظهر دون إجابة.')) return;
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
  return (
    <section className="panel exercise" id="practice">
      <div className="panel-heading">
        <div>
          <span className="badge">
            {mode === 'exam' ? 'محاكاة تدريبية' : mode === 'speed' ? 'سرعة مع فهم' : 'ثبّت الفكرة'}
          </span>
          <h2>
            {mode === 'exam'
              ? 'ستة أسئلة في ست دقائق'
              : mode === 'speed'
                ? 'حاول في أقل من دقيقة'
                : 'ثلاث مسائل للفكرة نفسها'}
          </h2>
        </div>
        {!batch && (
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
            href={'/start?next=' + (mode === 'learn' ? '/mentor' : '/challenge')}
          >
            ادخل لحفظ محاولاتك
          </Link>
        </p>
      )}
      {!batch && (
        <>
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
            <details>
              <summary>جلساتك الأخيرة</summary>
              <div className="session-links">
                {sessions.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    className="text-button"
                    disabled={busy}
                    onClick={() => load(s.id)}
                  >
                    {s.mode === 'exam'
                      ? 'تدريب مؤقّت'
                      : s.mode === 'speed'
                        ? 'تدريب سرعة'
                        : 'تدريب المهارة'}{' '}
                    · {new Date(s.created_at).toLocaleDateString('ar-SA')} ·{' '}
                    {s.completed_at ? 'النتيجة' : 'استئناف'}
                  </button>
                ))}
              </div>
            </details>
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
          {q ? (
            <>
              <h3>{q.name}</h3>
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
                    {batch.mode !== 'exam' && (
                      <>
                        <button className="button ghost" disabled={busy} onClick={askHint}>
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
          <p>صحة المحاولة الأولى. راجع السؤال والوقت وطريقة الاختصار، ثم جرّب سؤالًا جديدًا.</p>
          {batch.results?.map((r) => (
            <article key={r.id} className="result-card">
              <div className="exercise-meta">
                <strong>
                  {r.firstCorrect
                    ? '✓ صحيح من أول محاولة'
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
                اختيارك:{' '}
                {r.chosen === null || r.chosen < 0 ? 'لا أعرف / لم أجب' : r.choices[r.chosen]} ·
                الصحيح: {r.choices[r.answer!]} {r.unit}
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
              <Link href={'/mentor?skill=' + r.lesson} className="text-button">
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
