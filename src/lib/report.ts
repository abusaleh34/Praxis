import 'server-only';
import { db } from './db';
import { overview } from './study';
export async function reportFor(pid: string) {
  const [o, rows] = await Promise.all([
    overview(pid),
    db()`SELECT a.correct,a.assisted,a.elapsed_ms,a.created_at FROM mentor_attempts a JOIN mentor_activities m ON m.id::text=a.activity_id JOIN mentor_batches b ON b.id=m.batch_id WHERE a.participant_id=${pid} AND (m.mode<>'exam' OR b.completed_at IS NOT NULL) AND a.created_at>=now()-interval '14 days' UNION ALL SELECT a.correct,EXISTS(SELECT 1 FROM hint_events h WHERE h.session_id=a.session_id AND h.question_id=a.question_id AND h.created_at<=a.created_at) AS assisted,a.elapsed_ms,a.created_at FROM attempts a JOIN study_sessions s ON s.id=a.session_id WHERE a.participant_id=${pid} AND (s.kind='practice' OR s.completed_at IS NOT NULL) AND a.created_at>=now()-interval '14 days'`,
  ]);
  const cutoff = Date.now() - 7 * 86400000,
    week = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff),
    previous = rows.filter((r) => new Date(r.created_at).getTime() < cutoff);
  const accuracy = (xs: Array<(typeof rows)[number]>) =>
    xs.length ? Math.round((xs.filter((r) => r.correct).length / xs.length) * 100) : null;
  return {
    generatedAt: new Date().toISOString(),
    period: 'آخر 7 أيام',
    attempts: week.length,
    accuracy: accuracy(week),
    previousAccuracy: accuracy(previous),
    previousAttempts: previous.length,
    minutes: Math.round(week.reduce((n, r) => n + r.elapsed_ms, 0) / 60000),
    assisted: week.filter((r) => r.assisted).length,
    strong: o.adaptive.skills.filter((s) => s.independent >= 3).map((s) => s.name),
    review: o.adaptive.skills.filter((s) => s.wrong > 0 || s.assisted > 0).map((s) => s.name),
    recommendation: o.adaptive.recommendation,
    skills: o.adaptive.skills,
    note: o.adaptive.note,
  };
}
export type ProgressReport = Awaited<ReturnType<typeof reportFor>>;
