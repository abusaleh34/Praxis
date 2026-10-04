'use client';
import { Shell } from '@/components/shell';
import { Icon } from '@/components/icon';
import { useOverview } from '@/components/use-overview';
const descriptions: Record<string, string> = {
  triangle: 'اكتشف العلاقة بين الزوايا الثلاث، وما يتبقى للزاوية المجهولة.',
  isosceles: 'من تساوي الساقين، نصل إلى علاقة بين زاويتي القاعدة.',
  parallel: 'تتبّع القاطع، وميّز الزوايا التي تقع في الموضع نفسه.',
  exterior: 'انظر خارج المثلث، واربط الزاوية بما تعرفه في داخله.',
  rectangle: 'حوّل الطول والعرض إلى مساحة، وميّزها عن المحيط.',
  right: 'استخدم علاقة فيثاغورس للوصول إلى الضلع المجهول.',
  circle: 'قوس واحد، وزاويتان. اكتشف العلاقة بينهما.',
  polygon: 'من عدد الأضلاع إلى قياس الزوايا في الأشكال المنتظمة.',
};
export default function Library() {
  const { data: d, error, busy, begin } = useOverview();
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="hello">كل فكرة تبني على فكرة.</span>
          <h1>رحلة التعلّم</h1>
          <p>ثماني مهارات، ورسوم تقرّب المعنى.</p>
        </div>
        <span className="badge">50 سؤالًا تدريبيًا</span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!d ? (
        <div className="loading">نحمّل المهارات…</div>
      ) : (
        <>
          {!d.pre && (
            <div className="notice">
              <Icon name="target" />
              <p>ابدأ بالاختبار القبلي أولًا؛ بعدها تختار المهارة التي تريد التدرّب عليها.</p>
            </div>
          )}
          <div className="skills-grid">
            {d.skills.map((s, i) => (
              <article className="skill-card" key={s.id}>
                <div className="skill-card-top">
                  <span className={`icon-box ${i % 3 === 1 ? 'amber' : ''}`}>
                    <Icon
                      name={
                        [
                          'triangle',
                          'triangle',
                          'menu',
                          'triangle',
                          'book',
                          'triangle',
                          'target',
                          'spark',
                        ][i]
                      }
                    />
                  </span>
                  <span className="badge gray">{i < 4 ? 'أساسي' : 'متوسط'}</span>
                </div>
                <h2>{s.name}</h2>
                <p>{descriptions[s.id]}</p>
                <div className="small-label">
                  {s.answered
                    ? `${s.correct} إجابات صحيحة من ${s.answered} محاولة`
                    : 'لم تبدأ هذه المهارة بعد'}
                </div>
                <div className="progress-track">
                  <span
                    style={{ width: s.answered ? `${(s.correct / s.answered) * 100}%` : '0%' }}
                  />
                </div>
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={() => begin(d.pre ? 'practice' : 'pre', d.pre ? s.id : undefined)}
                >
                  {d.pre ? 'تدرّب على المهارة' : 'ابدأ بالاختبار القبلي'}
                  <Icon name="arrow" size={17} />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
