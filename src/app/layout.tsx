import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Praxis — الفكرة أولًا', template: '%s · Praxis' },
  description: 'مساحة عربية للتدرّب على الهندسة: افهم الفكرة، جرّب الحل، وتقدّم خطوة بخطوة.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {process.env.PRAXIS_MODE !== 'pilot' && (
          <div className="dev-banner">
            {process.env.PRAXIS_MODE === 'waitlist'
              ? 'التسجيل المبكر · التدريب لم يُفتح بعد'
              : 'نسخة تطوير داخلية · الأسئلة والتلميحات بانتظار مراجعة معلم'}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
