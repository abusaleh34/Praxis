'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { api, post } from '@/components/client';
import type { ProgressReport } from '@/lib/report';
export default function Report() {
  const [report, setReport] = useState<ProgressReport | null>(null),
    [shares, setShares] = useState<any[]>([]),
    [error, setError] = useState(''),
    [guest, setGuest] = useState(false),
    [consent, setConsent] = useState(false),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  async function load() {
    try {
      const r = await api<{ report: ProgressReport; shares: any[] }>('report');
      setReport(r.report);
      setShares(r.shares);
    } catch (e) {
      setError((e as Error).message);
      setGuest((e as any).status === 401);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function share() {
    setBusy(true);
    setError('');
    try {
      const d = await post<{ token: string }>('report', { action: 'share', consent });
      setUrl(location.origin + '/shared/' + d.token);
      setCopied(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try {
      await post('report', { action: 'revoke', id });
      setUrl('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="overline">صورة أوضح عن التقدّم</span>
          <h1>تقرير هذا الأسبوع</h1>
          <p>يتحدّث من محاولاتك كلما فتحته. يمكنك مشاركته مع ولي أمرك.</p>
        </div>
        <button className="button ghost no-print" onClick={() => window.print()}>
          طباعة / حفظ PDF
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {guest && (
        <Link className="button primary" href="/start?next=/report">
          ادخل لعرض تقريرك
        </Link>
      )}
      {report && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <strong>{report.attempts}</strong>
              <span>محاولة في آخر 7 أيام</span>
            </div>
            <div className="stat-card">
              <strong>{report.accuracy === null ? '—' : report.accuracy + '%'}</strong>
              <span>صحيح من المحاولة الأولى</span>
            </div>
            <div className="stat-card">
              <strong>{report.minutes}</strong>
              <span>دقيقة مسجلة في الحل</span>
            </div>
          </div>
          <p className="muted">
            الأسبوع السابق: {report.previousAttempts} محاولات،{' '}
            {report.previousAccuracy === null
              ? 'لا توجد دقة للمقارنة'
              : report.previousAccuracy + '% صحيح'}
            . قد تختلف المهارات وصعوبة الأسئلة؛ لا تمثل المقارنة نموًا في درجة اختبار رسمي.
          </p>
          <div className="two-col">
            <section className="panel">
              <h2>نقاط القوة</h2>
              {report.strong.length ? (
                <ul>
                  {report.strong.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  نحتاج إلى ثلاث مسائل مختلفة صحيحة دون مساعدة داخل المهارة قبل وصف الأداء بالمستقل
                  الجيد.
                </p>
              )}
            </section>
            <section className="panel">
              <h2>نراجع معًا</h2>
              {report.review.length ? (
                <ul>
                  {report.review.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p>ابدأ بمحاولات قصيرة لتظهر هنا المهارات التي تحتاج متابعة.</p>
              )}
            </section>
          </div>
          <section className="panel">
            <h2>تدريبك المقترح</h2>
            <p>{report.recommendation.reason}</p>
            <Link className="button primary" href={'/mentor?skill=' + report.recommendation.skill}>
              ابدأ {report.recommendation.name}
            </Link>
            <p className="muted">{report.note}</p>
          </section>
          <section className="panel">
            <h2>خريطة المهارات</h2>
            <div className="skill-map">
              {report.skills.map((s) => (
                <Link
                  className={'skill-tile ' + (s.wrong ? 'needs-review' : '')}
                  key={s.id}
                  href={'/mentor?skill=' + s.id}
                >
                  <strong>{s.name}</strong>
                  <span>{s.state}</span>
                  <small>
                    {s.attempts} محاولات · {s.independent} مسائل مستقلة صحيحة
                    {s.due ? ' · حان وقت المراجعة' : ''}
                  </small>
                  {s.prerequisites.length > 0 && (
                    <small>
                      يعتمد على:{' '}
                      {s.prerequisites
                        .map((p) => report.skills.find((x) => x.id === p)?.name)
                        .join('، ')}
                    </small>
                  )}
                </Link>
              ))}
            </div>
          </section>
          <section className="panel no-print">
            <h2>مشاركة مع ولي الأمر</h2>
            <p>
              الرابط يعرض ملخصًا ثابتًا دون رمز دخولك أو إجاباتك التفصيلية. يستطيع من يملك الرابط
              قراءته لمدة 7 أيام، ويمكنك إلغاؤه. لا نرسل رسائل تلقائية لأي جهة.
            </p>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              أوافق على إنشاء رابط لهذا الملخص لأشاركه مع من أختار.
            </label>
            <button className="button primary" disabled={!consent || busy} onClick={share}>
              أنشئ رابط التقرير
            </button>
            {url && (
              <div className="share-link">
                <input aria-label="رابط التقرير" dir="ltr" readOnly value={url} />
                <button
                  className="button ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                    } catch {
                      setError('انسخ الرابط من الحقل يدويًا.');
                    }
                  }}
                >
                  {copied ? 'تم النسخ' : 'نسخ الرابط'}
                </button>
              </div>
            )}
            {shares.map((s) => (
              <div className="history-row" key={s.id}>
                <span>
                  رابط أُنشئ {new Date(s.created_at).toLocaleDateString('ar-SA')} · ينتهي{' '}
                  {new Date(s.expires_at).toLocaleDateString('ar-SA')}
                </span>
                <button className="danger-button" disabled={busy} onClick={() => revoke(s.id)}>
                  إلغاء الرابط
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </Shell>
  );
}
