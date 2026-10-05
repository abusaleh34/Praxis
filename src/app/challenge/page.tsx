'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/shell';
import { Exercise } from '@/components/mentor/exercise';
import { lessons } from '@/lib/mentor-catalog';
import { rememberMentor, safeDestination } from '@/lib/mentor-navigation';
export default function Challenge() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p>نحمّل التدريب…</p>
        </Shell>
      }
    >
      <ChallengeContent />
    </Suspense>
  );
}
function ChallengeContent() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'exam' ? 'exam' : 'speed';
  const lesson = lessons.some((l) => l.id === params.get('skill'))
    ? params.get('skill')!
    : 'triangle';
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!location.search) {
      const saved = sessionStorage.getItem('praxis-context:/challenge');
      if (saved) history.replaceState(null, '', safeDestination(saved));
    }
    setReady(true);
  }, []);
  function reset(nextMode = mode, nextLesson = lesson) {
    const u = new URL(location.href);
    u.searchParams.delete('batch');
    u.searchParams.set('mode', nextMode);
    u.searchParams.set('skill', nextLesson);
    history.replaceState(null, '', u);
    rememberMentor();
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="overline">إدارة الوقت</span>
          <h1>الفهم أولًا، ثم السرعة.</h1>
          <p>تمرّن دون ضغط، أو اختبر توزيع وقتك في مجموعة مختلطة.</p>
        </div>
      </div>
      <section className="panel">
        <div className="category-tabs">
          <button
            aria-pressed={mode === 'speed'}
            onClick={() => {
              reset('speed');
            }}
          >
            سرعة مع تلميحات
          </button>
          <button
            aria-pressed={mode === 'exam'}
            onClick={() => {
              reset('exam');
            }}
          >
            تدريب مؤقّت بلا تلميحات
          </button>
        </div>
        {mode === 'speed' && (
          <label>
            مهارة التدريب
            <select
              value={lesson}
              onChange={(e) => {
                reset(mode, e.target.value);
              }}
            >
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p>
          {mode === 'speed'
            ? 'هدف إرشادي: أقل من دقيقة للسؤال. الساعة لا تمنعك من مواصلة الفهم.'
            : 'ستة أسئلة متنوعة في ست دقائق. إذا تعثّرت، انتقل للسؤال التالي بدل استنزاف الوقت.'}
        </p>
      </section>
      {ready && (
        <Exercise key={mode + lesson} mode={mode} lesson={lesson} batchId={params.get('batch')} />
      )}
    </Shell>
  );
}
