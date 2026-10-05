'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { lessons, lessonById } from '@/lib/mentor-catalog';
import { Lab } from '@/components/mentor/lab';
import { Exercise } from '@/components/mentor/exercise';
import { PhotoQuestion } from '@/components/mentor/photo';
import { rememberMentor, safeDestination } from '@/lib/mentor-navigation';
export default function Mentor() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p>نحمّل المدرّب…</p>
        </Shell>
      }
    >
      <MentorContent />
    </Suspense>
  );
}
function MentorContent() {
  const params = useSearchParams();
  const lesson = lessonById.has(params.get('skill') ?? '') ? params.get('skill')! : 'triangle';
  const category = lessonById.get(lesson)!.category;
  const requestedView = params.get('view');
  const view = ['learn', 'practice', 'review'].includes(requestedView ?? '')
    ? requestedView!
    : params.has('batch')
      ? 'practice'
      : 'learn';
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!location.search) {
      const saved = sessionStorage.getItem('praxis-context:/mentor');
      if (saved) history.replaceState(null, '', safeDestination(saved));
    }
    setReady(true);
  }, []);
  function choose(id: string) {
    const u = new URL(location.href);
    u.searchParams.set('skill', id);
    u.searchParams.delete('batch');
    ['a', 'b', 'target', 'step'].forEach((k) => u.searchParams.delete(k));
    history.replaceState(null, '', u);
    rememberMentor();
  }
  function switchView(next: string) {
    const u = new URL(location.href);
    u.searchParams.set('view', next);
    history.replaceState(null, '', u);
    rememberMentor();
  }
  return (
    <Shell>
      <div className="page-heading mentor-heading">
        <div>
          <span className="overline">مدرّبك، خطوة بخطوة</span>
          <h1>شاهد الفكرة. جرّبها. افهمها.</h1>
          <p>حرّك الرسم، ناقش خطوة، ثم اختبر فهمك دون مساعدة.</p>
        </div>
        <Link href="/challenge" className="button ghost">
          تحدّي الوقت ←
        </Link>
      </div>
      <nav className="learning-tabs" aria-label="خطوات التعلّم">
        {[
          ['learn', 'افهم'],
          ['practice', 'جرّب'],
          ['review', 'راجع'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={view === id} onClick={() => switchView(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div hidden={view !== 'learn'}>
        <div className="lesson-picker panel">
          <div className="category-tabs" role="group" aria-label="مجال التدريب">
            {['هندسة', 'كمي', 'لفظي', 'تحصيلي'].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => {
                  choose(lessons.find((l) => l.category === c)!.id);
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <label>
            اختر الفكرة
            <select value={lesson} onChange={(e) => choose(e.target.value)}>
              {lessons
                .filter((l) => l.category === category)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
          {category === 'تحصيلي' && (
            <p className="notice">
              وحدتان تمهيديتان في الحركة والمول؛ لا تغطيان منهج التحصيلي كاملًا.
            </p>
          )}
          <p className="muted">محتوى تدريبي تجريبي؛ لا يقدم أسئلة اختبار رسمي.</p>
        </div>
        <PhotoQuestion
          onApply={(id, a, b, target) => {
            choose(id);
            const u = new URL(location.href);
            Object.entries({ a, b, target, step: 0, view: 'learn' }).forEach(([k, v]) =>
              u.searchParams.set(k, String(v)),
            );
            history.replaceState(null, '', u);
            rememberMentor();
            document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <div id="lab">
          {ready && <Lab key={lesson} lesson={lesson} onPractice={() => switchView('practice')} />}
        </div>
      </div>
      <div hidden={view === 'learn'}>
        {ready && (
          <Exercise
            key={lesson}
            lesson={lesson}
            active={view === 'practice'}
            reviewOnly={view === 'review'}
            batchId={params.get('batch')}
          />
        )}
      </div>
    </Shell>
  );
}
