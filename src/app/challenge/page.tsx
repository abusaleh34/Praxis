'use client';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { Exercise } from '@/components/mentor/exercise';
import { lessons } from '@/lib/mentor-catalog';
export default function Challenge() {
  const [mode, setMode] = useState<'speed' | 'exam'>('speed'),
    [lesson, setLesson] = useState('triangle');
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('mode') === 'exam') setMode('exam');
    const s = q.get('skill');
    if (s && lessons.some((l) => l.id === s)) setLesson(s);
  }, []);
  function reset() {
    const u = new URL(location.href);
    u.searchParams.delete('batch');
    history.replaceState(null, '', u);
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
              reset();
              setMode('speed');
            }}
          >
            سرعة مع تلميحات
          </button>
          <button
            aria-pressed={mode === 'exam'}
            onClick={() => {
              reset();
              setMode('exam');
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
                reset();
                setLesson(e.target.value);
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
      <Exercise key={mode + lesson} mode={mode} lesson={lesson} />
    </Shell>
  );
}
