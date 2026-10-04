import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="completion">
      <h1>هذه الصفحة غير موجودة.</h1>
      <p>لنعد إلى مساحتك ونكمل من هناك.</p>
      <Link href="/learn" className="button primary">
        مساحتي
      </Link>
    </main>
  );
}
