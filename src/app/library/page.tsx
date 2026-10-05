'use client';
import { Shell } from '@/components/shell';
import { Icon } from '@/components/icon';
import { useOverview } from '@/components/use-overview';
import Link from 'next/link';
import { lessons } from '@/lib/mentor-catalog';
export default function Library() {
  const { data: d, error } = useOverview();
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="hello">كل فكرة تبني على فكرة.</span>
          <h1>رحلة التعلّم</h1>
          <p>خمس عشرة مهارة، ورسوم تقرّب المعنى.</p>
        </div>
        <span className="badge">تدريب متدرّج ومتجدد</span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!d ? (
        <div className="loading">نحمّل المهارات…</div>
      ) : (
        <>
          <div className="skills-grid">
            {lessons.map((lesson, i) => {
              const s = d.skills.find((skill) => skill.id === lesson.id)!;
              return (
                <article className="skill-card" key={s.id}>
                  <div className="skill-card-top">
                    <span className={`icon-box ${i % 3 === 1 ? 'amber' : ''}`}>
                      <Icon
                        name={
                          lesson.category === 'لفظي'
                            ? 'book'
                            : lesson.category === 'هندسة'
                              ? 'triangle'
                              : 'spark'
                        }
                      />
                    </span>
                    <span className="badge gray">{lesson.category}</span>
                  </div>
                  <h2>{s.name}</h2>
                  <p>{lesson.idea}</p>
                  <div className="small-label">
                    {s.answered
                      ? `${s.correct} إجابات صحيحة من ${s.answered} محاولة`
                      : 'لم تبدأ هذه المهارة بعد'}
                  </div>
                  <div className="progress-track">
                    <span
                      style={{ width: s.answered ? `${(s.correct / s.answered) * 100}%` : '0%' }}
                    />
                  </div>
                  <Link className="text-button" href={`/mentor?skill=${lesson.id}&view=practice`}>
                    تدرّب على المهارة <Icon name="arrow" size={17} />
                  </Link>
                </article>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
