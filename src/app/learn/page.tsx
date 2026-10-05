'use client';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Icon } from '@/components/icon';
import { Geometry } from '@/components/geometry';
import { useOverview } from '@/components/use-overview';
import { AccountAccess } from '@/components/account-access';
export default function Learn() {
  const { data: d, error, busy, begin, router } = useOverview();
  return (
    <Shell>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!d ? (
        <div className="loading" role="status">
          نجهّز مساحتك…
        </div>
      ) : (
        <>
          <AccountAccess compact />
          <div className="page-heading">
            <div>
              <span className="hello">أهلًا بعودتك 👋</span>
              <h1>خطوة جديدة، وفكرة أوضح.</h1>
              <p>رحلتك في التعلّم تبدأ بمحاولة.</p>
            </div>
            <span className="date-tag">مساحتك، على إيقاعك.</span>
          </div>
          <section className="panel mentor-entry">
            <span className="badge">جديد · المدرب التفاعلي</span>
            <h2>الفكرة تتحرك أمامك.</h2>
            <p>رسوم قابلة للتجربة، شرح خطوة بخطوة، وأسئلة تقودك للحل.</p>
            <div className="action-row">
              <Link href="/mentor" className="button primary">
                افتح المدرّب
              </Link>
              <Link href="/challenge" className="button ghost">
                تدرّب على الوقت
              </Link>
              <Link href="/report" className="text-button">
                تقريرك الأسبوعي ←
              </Link>
            </div>
          </section>
          <section className="panel adaptive-card">
            <h2>خطوتك المقترحة: {d.adaptive.recommendation.name}</h2>
            <p>{d.adaptive.recommendation.reason}</p>
            <Link href={'/mentor?skill=' + d.adaptive.recommendation.skill} className="text-button">
              ابدأ تدريبًا موجّهًا ←
            </Link>
          </section>
          <section className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <span className="overline">
                <Icon name="spark" size={14} /> {d.pre ? 'جلسة اليوم' : 'لنبدأ من مستواك الحالي'}
              </span>
              <h2>{d.pre ? 'خمس مسائل. وخطوة أقرب للفهم.' : 'قبل ما نبدأ، نعرف نقطة البداية.'}</h2>
              <p>
                {d.pre
                  ? 'جرّب الحل، واستعن بالتلميحات عند الحاجة. كل خطوة في الرسم تساعدك تشوف العلاقة.'
                  : 'اختبار قصير من 15 سؤالًا، بلا تلميحات. نتيجتك لنفسك، ونقارنها بتقدمك بعد أسبوعين.'}
              </p>
              <button
                disabled={busy}
                className="button mint"
                onClick={() =>
                  d.activeSession
                    ? router.push('/session/' + d.activeSession)
                    : begin(d.pre ? 'practice' : 'pre')
                }
              >
                {busy
                  ? 'نجهّز الجلسة…'
                  : d.activeSession
                    ? 'أكمل من حيث توقفت'
                    : d.pre
                      ? 'ابدأ جلسة تدريب'
                      : 'ابدأ الاختبار القبلي'}
                <Icon name="arrow" size={16} />
              </button>
              <span className="hero-meta">
                {d.pre ? '5 أسئلة · خطوة بخطوة' : '15 سؤالًا · خُذ وقتك'}
              </span>
            </div>
            <Geometry diagram={{ type: 'triangle', a: 50, b: 60 }} highlight="target" />
          </section>
          <section className="stats-grid">
            <div className="stat-card">
              <span className="icon-box">
                <Icon name="book" />
              </span>
              <div>
                <strong>{d.completedQuestions}</strong>
                <p>محاولة مسجّلة</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="icon-box amber">
                <Icon name="target" />
              </span>
              <div>
                <strong>{d.completedQuestions ? `${d.accuracy}%` : '—'}</strong>
                <p>إجابات صحيحة عند التقييم</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="icon-box">
                <Icon name="check" />
              </span>
              <div>
                <strong>{d.completedSessions}</strong>
                <p>جلسات أتممتها</p>
              </div>
            </div>
          </section>
          <div className="two-col">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>رحلتك خطوة بخطوة</h2>
                  <p>الفهم يتراكم، مع كل زيارة.</p>
                </div>
                <span className="badge">تجربة أسبوعين</span>
              </div>
              {[
                {
                  title: 'نعرف نقطة البداية',
                  desc: d.pre
                    ? `أكملت الاختبار القبلي: ${d.pre.score} من 15.`
                    : '15 سؤالًا، نتعرّف بها على مستواك الحالي.',
                  done: Boolean(d.pre),
                  current: !d.pre,
                },
                {
                  title: 'نتمرّن ونفهم',
                  desc: 'جلسات قصيرة في ثماني مهارات هندسية.',
                  done: d.practiceSessions > 0,
                  current: Boolean(d.pre) && !d.post,
                },
                {
                  title: 'نلاحظ الفرق',
                  desc: d.post
                    ? 'أكملت المقارنة. راجع ما تعلّمته.'
                    : `الاختبار البعدي متاح ${new Date(d.postOpensAt).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' })}.`,
                  done: Boolean(d.post),
                  current: d.postEligible && !d.post,
                },
              ].map((s, i) => (
                <div className="journey-step" key={s.title}>
                  <span className={`step-node ${s.done ? 'done' : s.current ? 'current' : ''}`}>
                    {s.done ? <Icon name="check" size={15} /> : i + 1}
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
              {d.postEligible && !d.post && d.pre && (
                <button disabled={busy} className="text-button" onClick={() => begin('post')}>
                  ابدأ الاختبار البعدي <Icon name="arrow" size={16} />
                </button>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>اكتشف الهندسة</h2>
                <Link className="text-button" href="/library">
                  كل المهارات <Icon name="chevron" size={15} />
                </Link>
              </div>
              {d.skills.slice(0, 4).map((s, i) => (
                <Link className="skill-row" key={s.id} href="/library">
                  <span className={`icon-box ${i % 2 ? 'amber' : ''}`}>
                    <Icon name={i % 2 ? 'target' : 'triangle'} size={17} />
                  </span>
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.answered ? `${s.answered} محاولات مكتملة` : 'فكرة جديدة تنتظرك'}</p>
                  </div>
                  <Icon name="chevron" size={16} />
                </Link>
              ))}
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}
