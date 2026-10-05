'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { lessons, lessonById } from '@/lib/mentor-catalog';
import { Lab } from '@/components/mentor/lab';
import { Exercise } from '@/components/mentor/exercise';
import { PhotoQuestion } from '@/components/mentor/photo';
import { rememberMentor, safeDestination } from '@/lib/mentor-navigation';
export default function Mentor() {
  const [lesson, setLesson] = useState('triangle'),
    [category, setCategory] = useState('هندسة'),
    [ready, setReady] = useState(false),
    [view, setView] = useState('learn'),
    [imported, setImported] = useState<{
      a: number;
      b: number;
      stamp: number;
      target?: 'area' | 'perimeter';
      step?: number;
    }>();
  useEffect(() => {
    if (!location.search) {
      const saved = sessionStorage.getItem('praxis-context:/mentor');
      if (saved) history.replaceState(null, '', safeDestination(saved));
    }
    const params = new URLSearchParams(location.search);
    const key = params.get('skill');
    if (key && lessonById.has(key)) {
      setLesson(key);
      setCategory(lessonById.get(key)!.category);
    }
    setView(params.has('batch') ? 'practice' : (params.get('view') ?? 'learn'));
    if (params.has('a') && params.has('b'))
      setImported({
        a: Number(params.get('a')),
        b: Number(params.get('b')),
        target: params.get('target') === 'perimeter' ? 'perimeter' : 'area',
        step: Math.min(2, Math.max(0, Number(params.get('step')) || 0)),
        stamp: Date.now(),
      });
    setReady(true);
  }, []);
  function choose(id: string) {
    setLesson(id);
    setImported(undefined);
    const u = new URL(location.href);
    u.searchParams.set('skill', id);
    u.searchParams.delete('batch');
    ['a', 'b', 'target', 'step'].forEach((k) => u.searchParams.delete(k));
    history.replaceState(null, '', u);
    rememberMentor();
  }
  function switchView(next: string) {
    setView(next);
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
                  setCategory(c);
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
            setCategory(lessonById.get(id)!.category);
            setImported({ a, b, target, stamp: Date.now() });
            document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <div id="lab">
          {ready && (
            <Lab
              key={lesson}
              lesson={lesson}
              imported={imported}
              onPractice={() => switchView('practice')}
            />
          )}
        </div>
      </div>
      <div hidden={view === 'learn'}>
        {ready && <Exercise key={lesson} lesson={lesson} reviewOnly={view === 'review'} />}
      </div>
    </Shell>
  );
}
