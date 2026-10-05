'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { lessons, lessonById } from '@/lib/mentor-catalog';
import { Lab } from '@/components/mentor/lab';
import { Exercise } from '@/components/mentor/exercise';
import { PhotoQuestion } from '@/components/mentor/photo';
export default function Mentor() {
  const [lesson, setLesson] = useState('triangle'),
    [category, setCategory] = useState('هندسة'),
    [imported, setImported] = useState<{ a: number; b: number; stamp: number }>();
  useEffect(() => {
    const key = new URLSearchParams(location.search).get('skill');
    if (key && lessonById.has(key)) {
      setLesson(key);
      setCategory(lessonById.get(key)!.category);
    }
  }, []);
  function choose(id: string) {
    setLesson(id);
    setImported(undefined);
    const u = new URL(location.href);
    u.searchParams.set('skill', id);
    u.searchParams.delete('batch');
    history.replaceState(null, '', u);
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="overline">مدرّبك، خطوة بخطوة</span>
          <h1>شاهد الفكرة. جرّبها. افهمها.</h1>
          <p>حرّك الرسم، ناقش خطوة، ثم اختبر فهمك دون مساعدة.</p>
        </div>
        <Link href="/challenge" className="button ghost">
          تحدّي الوقت ←
        </Link>
      </div>
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
        onApply={(id, a, b) => {
          choose(id);
          setCategory(lessonById.get(id)!.category);
          setImported({ a, b, stamp: Date.now() });
          document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <div id="lab">
        <Lab lesson={lesson} imported={imported} />
      </div>
      <Exercise key={lesson} lesson={lesson} />
    </Shell>
  );
}
