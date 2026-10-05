'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { api } from '@/components/client';
import { Geometry } from '@/components/geometry';
import { MathText } from '@/components/math-text';
import type { PublicQuestion } from '@/lib/types';
type Review = {
  score: number;
  total: number;
  questions: (PublicQuestion & {
    answer: number;
    chosen: number | null;
    correct: boolean;
    steps: string[];
    elapsedMs: number;
  })[];
};
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Review | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    api<Review>('sessions/' + id + '/review')
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="hello">كل خطأ يرشدنا لخطوة.</span>
          <h1>مراجعة جلسة التدريب</h1>
          <p>اختيارك الأول، والفكرة التي تساعدك في المرة القادمة.</p>
        </div>
        <Link href="/progress" className="text-button">
          العودة إلى تقدّمي
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">نحمّل المراجعة…</p>}
      {data && (
        <>
          <p className="notice">
            {data.score} من {data.total} إجابات صحيحة من المحاولة الأولى.
          </p>
          {data.questions.map((q, i) => (
            <article key={q.id} className="panel review-question">
              <div>
                <span className={'badge ' + (q.correct ? '' : 'gray')}>
                  {q.correct ? 'صحيح من أول محاولة' : 'فرصة للمراجعة'}
                </span>
                <h2>
                  {i + 1}. <MathText>{q.prompt}</MathText>
                </h2>
                <p>
                  اختيارك: {q.chosen ?? '—'} {q.unit} · الصحيح: {q.answer} {q.unit}
                </p>
                <ol>
                  {q.steps.map((s) => (
                    <li key={s}>
                      <MathText>{s}</MathText>
                    </li>
                  ))}
                </ol>
                <Link className="text-button" href={'/mentor?skill=' + q.skillId}>
                  افهمها مع المدرّب
                </Link>
              </div>
              <div className="geometry-card">
                <Geometry diagram={q.diagram} />
              </div>
            </article>
          ))}
        </>
      )}
    </Shell>
  );
}
