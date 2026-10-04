'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand, Icon } from '@/components/icon';
import { api, post } from '@/components/client';
export default function Start() {
  const router = useRouter();
  const [config, setConfig] = useState<{
    mode: string;
    open: boolean;
    authenticated: boolean;
    channelUrl: string | null;
  } | null>(null);
  const [consent, setConsent] = useState(false),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [joined, setJoined] = useState(false);
  useEffect(() => {
    api('config')
      .then((c) => {
        setConfig(c);
        if (c.authenticated) {
          if (c.mode === 'waitlist') setJoined(true);
          else router.replace('/learn');
        }
      })
      .catch((e) => setError(e.message));
  }, [router]);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const source = new URLSearchParams(location.search).get('from') ?? 'direct';
      await post('enroll', {
        consent,
        code,
        source: /^[a-zA-Z0-9_-]{1,50}$/.test(source) ? source : 'direct',
      });
      if (config?.mode === 'waitlist') setJoined(true);
      else router.push('/learn');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="start-page">
      <header className="start-back">
        <Link href="/">
          <Brand />
        </Link>
        <Link href="/">العودة للرئيسية ←</Link>
      </header>
      <div className="start-layout">
        <section className="start-intro">
          <span className="overline">بداية بسيطة، وأثر تلاحظه.</span>
          <h1>
            خذ أول خطوة.
            <br />
            خلّنا نفهم الهندسة معًا.
          </h1>
          <p>ما تحتاج تعرف كل الإجابات. تبدأ من مستواك الحالي، وتتعلم مع كل محاولة.</p>
          <ul className="start-points">
            <li>
              <Icon name="target" /> 15 سؤالًا لتحديد نقطة البداية
            </li>
            <li>
              <Icon name="spark" /> 50 سؤالًا تدريبيًا، مع رسوم وتلميحات
            </li>
            <li>
              <Icon name="chart" /> مقارنة تقدّمك بعد أسبوعين
            </li>
          </ul>
        </section>
        <section className="start-card">
          {joined ? (
            <>
              <span className="icon-box">
                <Icon name="check" />
              </span>
              <h2>وصلنا اهتمامك.</h2>
              <p>
                التدريب لم يُفتح بعد.{' '}
                {config?.channelUrl
                  ? 'تابع القناة لتصلك أخبار التجربة.'
                  : 'يمكنك العودة إلى هذه الصفحة لمتابعة إتاحة التجربة.'}
              </p>
              {config?.channelUrl && (
                <a
                  className="button primary wide"
                  href={config.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  تابع قناة التجربة
                </a>
              )}
            </>
          ) : (
            <>
              <h2>{config?.mode === 'waitlist' ? 'كن من أوائل المهتمين' : 'أهلًا بك في Praxis'}</h2>
              <p>دخول بسيط، دون اسم أو رقم هاتف. نحفظ تقدمك في هذا المتصفح.</p>
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              {!config ? (
                <div className="loading" role="status">
                  نجهّز البداية…
                </div>
              ) : !config.open ? (
                <div className="notice">
                  <Icon name="clock" />
                  <p>التجربة ليست مفتوحة بعد. نراجع المحتوى ونجهّزها لاستقبال المشاركين.</p>
                </div>
              ) : (
                <form onSubmit={join}>
                  {config.mode === 'pilot' && (
                    <label className="field">
                      <span>رمز الدعوة</span>
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                        autoComplete="off"
                      />
                    </label>
                  )}
                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      أوافق على حفظ محاولاتي ونتائجي لقياس تجربة التعلّم، واطلعت على{' '}
                      <Link href="/privacy">سياسة البيانات</Link>.
                    </span>
                  </label>
                  <button className="button primary wide" disabled={!consent || busy}>
                    {busy
                      ? 'لحظة واحدة…'
                      : config.mode === 'waitlist'
                        ? 'سجّل اهتمامي'
                        : 'لنبدأ الرحلة'}
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
              )}
              <p className="privacy-line">
                <Icon name="shield" size={13} /> لا نطلب صورًا أو معلومات تواصل. يمكنك حذف بياناتك
                من صفحة تقدمك.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
