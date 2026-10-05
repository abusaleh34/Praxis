'use client';
import { useState } from 'react';
import { Shell } from '@/components/shell';
import { Icon } from '@/components/icon';
import { useOverview } from '@/components/use-overview';
import { api, post } from '@/components/client';
import { AccountAccess } from '@/components/account-access';
export default function Progress() {
  const { data: d, error, busy, begin, router } = useOverview();
  const [actionError, setActionError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false),
    [offerShown, setOfferShown] = useState(false),
    [surveyDone, setSurveyDone] = useState(false),
    [checkout, setCheckout] = useState('');
  async function logout() {
    try {
      await post('logout', {});
      router.push('/start');
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function remove() {
    try {
      await api('account', { method: 'DELETE' });
      router.push('/start');
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function offer() {
    try {
      const r = await post('offer', {});
      setCheckout(r.url);
      setOfferShown(true);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function decline(reason: string) {
    try {
      await post('decline', { reason });
      setSurveyDone(true);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="hello">أثر كل محاولة.</span>
          <h1>تقدّمك، خطوة بخطوة.</h1>
          <p>قارن نفسك بنقطة البداية، وخذ وقتك في التعلّم.</p>
        </div>
      </div>
      {(error || actionError) && (
        <div className="error" role="alert">
          {error || actionError}
        </div>
      )}
      {!d ? (
        <div className="loading">نجمع تقدمك…</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="icon-box">
                <Icon name="book" />
              </span>
              <div>
                <strong>{d.completedQuestions}</strong>
                <p>محاولة تدريبية مكتملة</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="icon-box amber">
                <Icon name="target" />
              </span>
              <div>
                <strong>{d.completedQuestions ? `${d.accuracy}%` : '—'}</strong>
                <p>صحيح من المحاولة الأولى</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="icon-box">
                <Icon name="check" />
              </span>
              <div>
                <strong>{d.practiceSessions}</strong>
                <p>جلسات أنجزتها</p>
              </div>
            </div>
          </div>
          <div className="two-col">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>من أين بدأت، وأين وصلت؟</h2>
                  <p>كل اختبار من 15 سؤالًا.</p>
                </div>
                <Icon name="chart" style={{ color: '#6e9f84' }} />
              </div>
              {d.pre ? (
                <>
                  <div className="score-compare">
                    <div className="score-column">
                      <b>{d.pre.score} / 15</b>
                      <div style={{ height: `${(d.pre.score / 15) * 130}px` }} />
                      <span>الاختبار القبلي</span>
                    </div>
                    <div className="score-column post">
                      <b>{d.post ? `${d.post.score} / 15` : '—'}</b>
                      <div style={{ height: d.post ? `${(d.post.score / 15) * 130}px` : '4px' }} />
                      <span>الاختبار البعدي</span>
                    </div>
                  </div>
                  {d.post ? (
                    <div className="notice">
                      <Icon name="chart" />
                      <p>
                        تغيّرت نتيجتك بمقدار {(d.post.score - d.pre.score).toLocaleString('ar-SA')}{' '}
                        درجات. هذه مقارنة داخل التجربة، وليست تقديرًا لدرجة اختبار القدرات.
                      </p>
                    </div>
                  ) : d.postEligible ? (
                    <button
                      className="button primary wide"
                      disabled={busy}
                      onClick={() => begin('post')}
                    >
                      ابدأ الاختبار البعدي <Icon name="arrow" />
                    </button>
                  ) : (
                    <div className="notice">
                      <Icon name="lock" size={18} />
                      <p>
                        يتاح الاختبار البعدي في{' '}
                        {new Date(d.postOpensAt).toLocaleDateString('ar-SA-u-ca-gregory', {
                          day: 'numeric',
                          month: 'long',
                          timeZone: 'Asia/Riyadh',
                        })}
                        ، بعد مرور 14 يومًا من دخولك.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty">
                  <Icon name="target" size={29} />
                  <p>ابدأ بالاختبار القبلي لتظهر نقطة البداية هنا.</p>
                  <button
                    className="button primary small"
                    disabled={busy}
                    onClick={() => begin('pre')}
                  >
                    ابدأ الاختبار
                  </button>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>آخر خطواتك</h2>
                <Icon name="clock" style={{ color: '#6e9f84' }} />
              </div>
              {d.recent.length ? (
                d.recent.map((s) => (
                  <div className="history-row" key={s.id}>
                    <div>
                      {s.kind === 'practice'
                        ? 'جلسة تدريب'
                        : s.kind === 'pre'
                          ? 'الاختبار القبلي'
                          : 'الاختبار البعدي'}
                      <small>
                        {new Date(s.completedAt).toLocaleDateString('ar-SA-u-ca-gregory', {
                          day: 'numeric',
                          month: 'long',
                          timeZone: 'Asia/Riyadh',
                        })}
                      </small>
                      {s.kind === 'practice' && (
                        <a href={'/review/' + s.id} className="text-button">
                          راجع الأسئلة والخطوات
                        </a>
                      )}
                    </div>
                    <strong dir="ltr">
                      {s.score} / {s.total}
                    </strong>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <Icon name="book" size={28} />
                  <p>ستظهر جلساتك المكتملة هنا.</p>
                </div>
              )}
            </section>
          </div>
          <section className="panel" style={{ marginTop: 22 }}>
            <div className="panel-heading">
              <h2>المهارات التي تدرّبت عليها</h2>
              <span className="small-label">صحة المحاولة الأولى</span>
            </div>
            {d.skills.map((s) => (
              <div key={s.id} style={{ margin: '17px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>{s.name}</span>
                  <span className="muted">
                    {s.answered ? `${s.correct} / ${s.answered}` : 'لم تبدأ بعد'}
                  </span>
                </div>
                <div className="progress-track">
                  <span
                    style={{ width: s.answered ? `${(s.correct / s.answered) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </section>
          {d.offer.enabled && d.offer.eligible && (
            <section className="panel" style={{ marginTop: 22 }}>
              <h2>واصل رحلتك</h2>
              <p>{d.offer.description}</p>
              <p>149 ريالًا</p>
              {!offerShown ? (
                <button onClick={offer} className="button primary">
                  عرض الاشتراك
                </button>
              ) : (
                <>
                  <a
                    className="button primary"
                    href={checkout}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    الانتقال إلى الدفع
                  </a>
                  <div className="divider" />
                  {surveyDone ? (
                    <p>شكرًا، ملاحظتك تساعدنا.</p>
                  ) : (
                    <>
                      <p>إذا لم يناسبك الاشتراك، ما السبب الأقرب؟</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                          ['price', 'السعر'],
                          ['geometry_only', 'يغطي الهندسة فقط'],
                          ['not_needed', 'لا أحتاجه الآن'],
                          ['other', 'سبب آخر'],
                        ].map(([reason, label]) => (
                          <button
                            key={reason}
                            className="button ghost small"
                            onClick={() => decline(reason)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}
          <section className="panel">
            <h2>المدرّب وخريطة المهارات</h2>
            <p>
              شاهد محاولات المدرّب التفاعلي والتدريب المؤقّت، والتوصية التالية، وشارك ملخصًا مع ولي
              أمرك.
            </p>
            <a href="/report" className="button primary">
              افتح التقرير الأسبوعي
            </a>
          </section>
          <AccountAccess />
          <div className="account-actions">
            <button className="text-button" onClick={logout}>
              <Icon name="logout" size={15} /> تسجيل الخروج
            </button>
            <button className="danger-button" onClick={() => setConfirmDelete(!confirmDelete)}>
              حذف بياناتي
            </button>
          </div>
          {confirmDelete && (
            <div className="error" role="alert">
              <p>سيُحذف تقدمك ومحاولاتك نهائيًا، ولن تستطيع استعادتها.</p>
              <button className="button ghost small" onClick={remove}>
                تأكيد حذف بياناتي
              </button>
              <button
                className="text-button"
                style={{ marginRight: 18 }}
                onClick={() => setConfirmDelete(false)}
              >
                إلغاء
              </button>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
