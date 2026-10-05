'use client';
import { useEffect, useState } from 'react';
import { api, post } from './client';
export function AccountAccess({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    api<{ enabled: boolean }>('access')
      .then((r) => setEnabled(r.enabled))
      .catch(() => setMessage('تعذّر تحميل رمز العودة. أعد تحميل الصفحة.'));
  }, []);
  async function create() {
    setBusy(true);
    setMessage('');
    try {
      const r = await post('access', { action: 'create' });
      setCode(r.code);
      setEnabled(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (compact && enabled && !code) return null;
  return (
    <section className="panel access-panel" aria-label="حفظ الحساب">
      <div>
        <h2>{enabled ? 'رمز العودة إلى حسابك' : 'احفظ طريق العودة إلى تقدمك'}</h2>
        <p>
          {enabled
            ? 'استخدم رمزك من صفحة الدخول لاستعادة الحساب على أي جهاز. يعيد الدخول إغلاق الجلسات الأقدم.'
            : 'أنشئ رمز دخول خاصًا واحفظه؛ ستحتاجه عند تغيير المتصفح أو تسجيل الخروج.'}
        </p>
      </div>
      {code ? (
        <>
          <output className="recovery-code" dir="ltr">
            {code}
          </output>
          <p>هذا الرمز يمنح الوصول إلى حسابك. احتفظ به لنفسك؛ لن نعرضه مرة أخرى.</p>
          <div className="action-row">
            <button
              className="button primary small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setMessage('تم نسخ الرمز.');
                } catch {
                  setMessage('يمكنك تحديد الرمز ونسخه يدويًا.');
                }
              }}
            >
              نسخ الرمز
            </button>
            <button
              className="button ghost small"
              onClick={() => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(
                  new Blob(
                    [
                      `رمز دخول Praxis\n${code}\nhttps://praxis-production-1c78.up.railway.app/start`,
                    ],
                    { type: 'text/plain;charset=utf-8' },
                  ),
                );
                a.download = 'praxis-access.txt';
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              حفظ ملف الرمز
            </button>
            <button className="text-button" onClick={() => setCode('')}>
              حفظت الرمز
            </button>
          </div>
        </>
      ) : (
        <button
          disabled={busy}
          className="button ghost small"
          onClick={() => {
            if (!enabled || window.confirm('سيُلغى رمز العودة السابق. هل تريد إصدار رمز جديد؟'))
              void create();
          }}
        >
          {busy ? 'نجهّز الرمز…' : enabled ? 'إصدار رمز جديد' : 'إنشاء رمز دخولي'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
