'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Brand, Icon } from '@/components/icon';
import { Geometry } from '@/components/geometry';
import { MathText } from '@/components/math-text';
import { api, post } from '@/components/client';
import type { Question } from '@/lib/types';
type ReviewedQuestion = Question & {
  hash: string;
  review: null | { reviewer: string; approved_at: string };
};
type AdminData = {
  readiness: {
    reviewed: number;
    total: number;
    ready: boolean;
    mode: string;
    flags: Record<string, boolean>;
  };
  registered: number;
  waitlist: number;
  firstSession: number;
  retained: number;
  preCompleted: number;
  learning: { paired: number; gain: number | null; improved: number | null };
  paid: number;
  reasons: { value: string; n: number }[];
  usage: { source: string; n: number; input_tokens: number; output_tokens: number }[];
  participants: {
    id: string;
    joinedAt: string;
    source: string;
    pre: boolean;
    firstSession: boolean;
    retained: boolean;
  }[];
};
const gateNames: Record<string, string> = {
  content: 'اعتماد الأسئلة الثمانين',
  demand: 'توثيق التحقق من الطلب',
  privacy: 'مراجعة الخصوصية والموافقات',
  hints: 'اعتماد قياس جودة التلميحات',
  access: 'تجهيز رمز التجربة المغلقة',
  secureCookies: 'تفعيل ملفات جلسة HTTPS',
};
export default function Admin() {
  const [data, setData] = useState<AdminData | null>(null),
    [loginNeeded, setLoginNeeded] = useState(false),
    [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('overview'),
    [items, setItems] = useState<ReviewedQuestion[]>([]),
    [selected, setSelected] = useState(0),
    [reviewer, setReviewer] = useState(''),
    [notes, setNotes] = useState(''),
    [verified, setVerified] = useState(false),
    [success, setSuccess] = useState(''),
    [paymentId, setPaymentId] = useState(''),
    [reference, setReference] = useState(''),
    [paymentVerified, setPaymentVerified] = useState(false);
  async function load() {
    const d = await api<AdminData>('admin/overview');
    setData(d);
    setLoginNeeded(false);
  }
  useEffect(() => {
    load().catch((e) => {
      if (e.status === 401) setLoginNeeded(true);
      else setError(e.message);
    });
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('admin/login', { secret });
      setSecret('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function content() {
    setTab('content');
    setError('');
    try {
      setItems(await api('admin/content'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function review(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await post('admin/review', {
        questionId: items[selected].id,
        hash: items[selected].hash,
        reviewer,
        notes,
        verified,
      });
      setVerified(false);
      setNotes('');
      await content();
      await load();
      setSuccess('حُفظ اعتماد هذا الإصدار من السؤال.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    try {
      await api('admin/review', {
        method: 'DELETE',
        body: JSON.stringify({ questionId: items[selected].id }),
      });
      await content();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function payment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post('admin/payment', {
        participantId: paymentId,
        reference,
        status: 'paid',
        verified: paymentVerified,
      });
      setPaymentId('');
      setReference('');
      setPaymentVerified(false);
      setSuccess('سُجل الدفع الموثق. لم تُنفذ عملية تحصيل من التطبيق.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const q = items[selected];
  return (
    <main className="admin-page">
      <Link href="/">
        <Brand />
      </Link>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      {loginNeeded ? (
        <form className="panel admin-login" onSubmit={login}>
          <span className="icon-box">
            <Icon name="shield" />
          </span>
          <h1>مساحة إدارة التجربة</h1>
          <p>دخول المراجعين والمشرفين فقط.</p>
          <label className="field">
            <span>رمز المشرف</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="button primary wide" disabled={busy}>
            دخول آمن
          </button>
        </form>
      ) : !data ? (
        <div className="loading">نحمّل بيانات التجربة…</div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <h1>إدارة تجربة Praxis</h1>
              <p>
                بيانات{' '}
                {data.readiness.mode === 'development'
                  ? 'التطوير فقط؛ لا تمثل نتائج تجربة طلاب فعلية'
                  : data.readiness.mode === 'waitlist'
                    ? 'التسجيل المبكر'
                    : 'التجربة المغلقة'}
                .
              </p>
            </div>
            <span className="badge gold">{data.readiness.reviewed} / 80 سؤال معتمد</span>
          </div>
          <div className="admin-nav">
            <div>
              <button
                onClick={() => setTab('overview')}
                className={`button ghost small ${tab === 'overview' ? 'active' : ''}`}
              >
                القياس والجاهزية
              </button>
              <button
                onClick={content}
                className={`button ghost small ${tab === 'content' ? 'active' : ''}`}
              >
                مراجعة المحتوى
              </button>
            </div>
            <div>
              <a className="button ghost small" href="/api/admin/export">
                <Icon name="download" size={16} /> تصدير CSV
              </a>
              <button
                className="text-button"
                onClick={async () => {
                  await post('admin/logout', {});
                  setData(null);
                  setLoginNeeded(true);
                }}
              >
                خروج
              </button>
            </div>
          </div>
          {tab === 'overview' ? (
            <>
              <div className="admin-stats">
                {[
                  [data.registered, 'التسجيلات', '60'],
                  [data.firstSession, 'أكملوا جلسة تدريب', '30'],
                  [data.retained, 'عادوا في الأيام 12–16', '15'],
                  [data.paid, 'مشاركون دفعوا فعليًا', '5'],
                ].map(([n, label, target]) => (
                  <div className="stat-card" key={label}>
                    <div>
                      <strong>{n}</strong>
                      <p>{label}</p>
                      <span className="small-label">الهدف: {target}</span>
                    </div>
                  </div>
                ))}
              </div>
              <section className="panel">
                <h2>شروط فتح التجربة المغلقة</h2>
                <p>تُثبت هذه الشروط قبل استقبال المشاركين. حفظ اعتماد سؤال لا ينشر التطبيق.</p>
                <div className="gate-list">
                  {Object.entries(data.readiness.flags).map(([key, value]) => (
                    <div className={`gate ${value ? 'done' : ''}`} key={key}>
                      <Icon name={value ? 'check' : 'clock'} size={17} />
                      {gateNames[key]}
                    </div>
                  ))}
                </div>
                <div className="notice">
                  <Icon name="shield" />
                  <p>
                    نجاح الدفع لا يكفي وحده. نربطه بالاستمرار والتحسن. 3–4 مدفوعات نتيجة غير حاسمة،
                    وأقل من 3 فشل لمؤشر الدفع. أرقام التطوير معزولة عن بيانات التجربة.
                  </p>
                </div>
              </section>
              <div className="two-col" style={{ marginTop: 22 }}>
                <section className="panel">
                  <h2>الأثر التعليمي</h2>
                  <div className="history-row">
                    <span>أكملوا الاختبارين</span>
                    <strong>{data.learning.paired}</strong>
                  </div>
                  <div className="history-row">
                    <span>متوسط التحسن — الهدف 10 نقاط مئوية</span>
                    <strong>
                      {data.learning.gain === null ? '—' : data.learning.gain.toFixed(1) + ' pp'}
                    </strong>
                  </div>
                  <div className="history-row">
                    <span>تحسنت درجاتهم — الهدف 60%</span>
                    <strong>
                      {data.learning.improved === null
                        ? '—'
                        : data.learning.improved.toFixed(0) + '%'}
                    </strong>
                  </div>
                  <p style={{ marginTop: 18 }}>
                    المقارنة للأزواج المكتملة فقط. من لم يكتمل أسبوعاه لا يُحسب فشلًا تلقائيًا.
                  </p>
                </section>
                <section className="panel">
                  <h2>التلميحات والاستخدام</h2>
                  {data.usage.length ? (
                    data.usage.map((u) => (
                      <div className="history-row" key={u.source}>
                        <span>
                          {
                            (
                              {
                                authored: 'معدّة مسبقًا',
                                model: 'النموذج اللغوي',
                                fallback: 'عودة للمحتوى المرجعي',
                                pending: 'قيد التجهيز',
                              } as Record<string, string>
                            )[u.source]
                          }
                        </span>
                        <strong>{u.n}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="empty">لا توجد طلبات تلميح بعد.</div>
                  )}
                  <p>
                    الإحصاءات التشغيلية تشمل كل الأوضاع. حساب التكلفة النقدية يتطلب تسعير المزود؛ لا
                    تُعرض تكلفة تقديرية غير موثقة.
                  </p>
                </section>
              </div>
              <section className="panel" style={{ marginTop: 22 }}>
                <div className="panel-heading">
                  <h2>المشاركون</h2>
                  <span className="small-label">قائمة الاهتمام: {data.waitlist}</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>المعرّف</th>
                        <th>المصدر</th>
                        <th>القبلي</th>
                        <th>أول جلسة</th>
                        <th>العودة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.participants.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <code>{p.id}</code>
                          </td>
                          <td>{p.source}</td>
                          <td>{p.pre ? '✓' : '—'}</td>
                          <td>{p.firstSession ? '✓' : '—'}</td>
                          <td>{p.retained ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.participants.length && (
                    <div className="empty">لا توجد تسجيلات في هذا الوضع.</div>
                  )}
                </div>
              </section>
              <section className="panel" style={{ marginTop: 22 }}>
                <h2>تسجيل دفعة تم التحقق منها</h2>
                <p>سجل قياس فقط. لا ينفذ تحصيلًا، ولا يُعد الضغط على رابط الدفع دفعة ناجحة.</p>
                <form onSubmit={payment} className="payment-form">
                  <label className="field">
                    <span>معرّف المشارك</span>
                    <input
                      value={paymentId}
                      onChange={(e) => setPaymentId(e.target.value)}
                      required
                      dir="ltr"
                    />
                  </label>
                  <label className="field">
                    <span>مرجع دفع 149 ريالًا</span>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      required
                    />
                  </label>
                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={paymentVerified}
                      onChange={(e) => setPaymentVerified(e.target.checked)}
                    />
                    <span>تحققت من وصول دفعة فعلية بقيمة 149 ريالًا.</span>
                  </label>
                  <button className="button ghost" disabled={!paymentVerified || busy}>
                    حفظ الدفعة الموثقة
                  </button>
                </form>
              </section>
            </>
          ) : !q ? (
            <div className="loading">نحمّل المحتوى…</div>
          ) : (
            <div className="review-layout">
              <aside className="review-list" aria-label="أسئلة المراجعة">
                {items.map((item, i) => (
                  <button
                    className={i === selected ? 'active' : ''}
                    key={item.id}
                    onClick={() => {
                      setSelected(i);
                      setVerified(false);
                      setSuccess('');
                      setNotes('');
                    }}
                  >
                    <span>
                      <bdi>{item.id}</bdi>
                      <br />
                      {item.skill}
                    </span>
                    <Icon name={item.review ? 'check' : 'clock'} size={14} />
                  </button>
                ))}
              </aside>
              <article className="review-detail">
                <div className="review-meta">
                  <span className="badge">
                    {q.split === 'practice' ? 'تدريب' : q.split === 'pre' ? 'قبلي' : 'بعدي'}
                  </span>
                  <span className="badge gold">{q.review ? 'معتمد' : 'مسودة غير معتمدة'}</span>
                  <bdi>{q.source.reference}</bdi>
                </div>
                <h2>
                  <MathText>{q.prompt}</MathText>
                </h2>
                <div className="geometry-card">
                  <Geometry diagram={q.diagram} highlight="all" />
                </div>
                <div className="review-answer">
                  الإجابة:{' '}
                  <bdi>
                    {q.choices[q.answerIndex]} {q.unit}
                  </bdi>
                </div>
                <h3>الحل المرجعي</h3>
                <ol>
                  {q.steps.map((s) => (
                    <li key={s}>
                      <MathText>{s}</MathText>
                    </li>
                  ))}
                </ol>
                <h3>التلميحات</h3>
                <ol>
                  {q.hints.map((h) => (
                    <li key={h.text}>
                      {h.text} <small>({h.highlight})</small>
                    </li>
                  ))}
                </ol>
                <h3>تفسير المشتتات</h3>
                <ul>
                  {q.choices.map((value, i) => (
                    <li key={i}>
                      <bdi>
                        {value} {q.unit}
                      </bdi>
                      : {q.feedback[i]}
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  {q.source.author}. يتطلب الاعتماد مراجعة الحل والرسم واللغة وملاءمة المستوى،
                  وتكافؤ مجموعتي الاختبار.
                </p>
                {q.review ? (
                  <div className="success">
                    اعتمده: {q.review.reviewer}
                    <button
                      className="text-button"
                      style={{ marginRight: 20 }}
                      disabled={busy}
                      onClick={revoke}
                    >
                      إلغاء الاعتماد
                    </button>
                  </div>
                ) : (
                  <form onSubmit={review}>
                    <label className="field">
                      <span>اسم المعلم المراجع</span>
                      <input
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                        minLength={2}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>ملاحظات المراجعة</span>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                    <label className="consent">
                      <input
                        type="checkbox"
                        checked={verified}
                        onChange={(e) => setVerified(e.target.checked)}
                      />
                      <span>
                        راجعت هذا السؤال وحله ومشتتاته وتلميحاته والرسم، وأعتمد هذا الإصدار.
                      </span>
                    </label>
                    <button className="button primary" disabled={!verified || busy}>
                      اعتماد السؤال
                    </button>
                  </form>
                )}
              </article>
            </div>
          )}
        </>
      )}
    </main>
  );
}
