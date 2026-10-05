import Link from 'next/link';
import { Brand, Icon } from '@/components/icon';
import { Geometry } from '@/components/geometry';
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#how">كيف تتعلّم؟</a>
          <Link href="/privacy">الخصوصية</Link>
          <Link href="/start" className="button small ghost">
            دخول التجربة <Icon name="arrow" size={17} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="overline">
              <span /> خطوة صغيرة. فهم أعمق.
            </span>
            <h1>
              مو بس تعرف الإجابة.
              <br />
              <em>تعرف ليش.</em>
            </h1>
            <p>
              مدرّب للقدرات يبدأ معك من الفكرة: رسوم تفاعلية، وتلميحات، وتدريب في الكمي واللفظي،
              وخطوة تالية من محاولاتك.
            </p>
            <div className="hero-actions">
              <Link href="/start" className="button primary">
                ابدأ رحلتك <Icon name="arrow" />
              </Link>
              <Link href="/mentor" className="text-button">
                جرّب المدرّب التفاعلي <Icon name="chevron" size={18} />
              </Link>
            </div>
            <div className="hero-facts">
              <span>
                <Icon name="check" size={16} /> بالعربية، من أول خطوة
              </span>
              <span>
                <Icon name="check" size={16} /> جلسات قصيرة تناسبك
              </span>
            </div>
          </div>
          <div className="landing-visual">
            <div className="floating-note">
              <span className="icon-box amber">
                <Icon name="spark" />
              </span>
              <span>
                لحظة فهم واحدة
                <br />
                <strong>تغيّر طريقة الحل.</strong>
              </span>
            </div>
            <div className="demo-board">
              <div className="board-top">
                <span>
                  <i /> لنكتشفها معًا
                </span>
                <span>01 / 50</span>
              </div>
              <Geometry diagram={{ type: 'triangle', a: 50, b: 60 }} highlight="known" />
              <div className="demo-hint">
                <Icon name="spark" size={19} />
                <p>نعرف زاويتين. كيف نصل إلى الثالثة؟</p>
              </div>
            </div>
            <div className="floating-tag">
              <Icon name="target" size={20} /> الفكرة أولًا، السرعة تأتي بعدها.
            </div>
          </div>
        </section>
        <section className="how-section" id="how">
          <div className="section-heading">
            <div>
              <span className="overline">رحلتك في Praxis</span>
              <h2>ثلاث خطوات. وطريقة فهم جديدة.</h2>
            </div>
            <p>نبني على محاولتك، خطوة بخطوة.</p>
          </div>
          <div className="feature-grid">
            {[
              [
                '01',
                'target',
                'اعرف نقطة البداية',
                'اختبار قصير يساعدك تقارن مستواك بنفسك بعد التجربة.',
              ],
              [
                '02',
                'spark',
                'جرّب، ثم اكتشف',
                'كل سؤال معه رسم وتلميحات متدرجة. خذ منها ما تحتاجه.',
              ],
              ['03', 'chart', 'شوف أثر تعلّمك', 'ارجع إلى تقدّمك، وقارن الاختبارين بعد أسبوعين.'],
            ].map(([n, icon, title, text]) => (
              <article className="feature-card" key={n}>
                <div>
                  <span className="icon-box">
                    <Icon name={icon} />
                  </span>
                  <span className="feature-number">{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="quiet-cta">
          <div>
            <h2>ابدأ بخطوة. والباقي نتعلّمه معًا.</h2>
            <p>رسم يتحرك معك، ومسائل متنوعة، وتقرير يوضح خطوتك القادمة.</p>
          </div>
          <Link href="/start" className="button dark">
            لنبدأ <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>الفهم مهارة. ندرّبها معًا.</span>
        <Link href="/privacy">الخصوصية والبيانات</Link>
      </footer>
    </div>
  );
}
