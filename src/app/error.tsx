'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="completion">
      <h1>تعذّر عرض الصفحة.</h1>
      <p>محاولاتك المكتملة محفوظة. يمكنك إعادة المحاولة.</p>
      <button className="button primary" onClick={reset}>
        إعادة المحاولة
      </button>
    </main>
  );
}
