import 'server-only';
import { db } from './db';
import { readiness } from './readiness';
import { learningMetrics } from './rules';
export async function adminOverview() {
  const status = await readiness();
  const mode = status.mode;
  const [participants, sessions, pairs, retained, reasons, payments, usage, waitlist] =
    await Promise.all([
      db()`SELECT id,created_at,source FROM participants WHERE mode=${mode} AND is_test=false ORDER BY created_at DESC`,
      db()`SELECT s.* FROM study_sessions s JOIN participants p ON p.id=s.participant_id WHERE p.mode=${mode} AND p.is_test=false AND s.completed_at IS NOT NULL`,
      db()`SELECT a.score AS pre,b.score AS post FROM study_sessions a JOIN study_sessions b ON a.participant_id=b.participant_id JOIN participants p ON p.id=a.participant_id WHERE p.mode=${mode} AND p.is_test=false AND a.kind='pre' AND b.kind='post' AND a.completed_at IS NOT NULL AND b.completed_at IS NOT NULL`,
      db()`SELECT DISTINCT p.id FROM participants p JOIN study_sessions s ON s.participant_id=p.id WHERE p.mode=${mode} AND p.is_test=false AND s.kind='practice' AND s.completed_at>=p.created_at+interval '12 days' AND s.completed_at<p.created_at+interval '17 days' AND EXISTS(SELECT 1 FROM study_sessions a WHERE a.participant_id=p.id AND a.kind='practice' AND a.completed_at<s.completed_at)`,
      db()`SELECT e.value,count(DISTINCT e.participant_id)::int n FROM events e JOIN participants p ON p.id=e.participant_id WHERE p.mode=${mode} AND p.is_test=false AND e.name='decline_reason' GROUP BY e.value`,
      db()`SELECT count(DISTINCT a.participant_id)::int n FROM payments a JOIN participants p ON p.id=a.participant_id WHERE p.mode=${mode} AND p.is_test=false AND a.status='paid'`,
      db()`SELECT h.source,count(*)::int n,sum(input_tokens)::int input_tokens,sum(output_tokens)::int output_tokens FROM hint_events h JOIN participants p ON p.id=h.participant_id WHERE p.is_test=false GROUP BY h.source`,
      db()`SELECT count(*)::int n FROM participants WHERE mode='waitlist' AND is_test=false`,
    ]);
  const first = new Set(sessions.filter((s) => s.kind === 'practice').map((s) => s.participant_id));
  const preCompleted = new Set(
    sessions.filter((s) => s.kind === 'pre').map((s) => s.participant_id),
  );
  return {
    readiness: status,
    registered: participants.length,
    waitlist: waitlist[0].n,
    firstSession: first.size,
    retained: retained.length,
    preCompleted: preCompleted.size,
    learning: learningMetrics(pairs.map((p) => ({ pre: p.pre, post: p.post }))),
    paid: payments[0].n,
    reasons,
    usage,
    participants: participants.map((p) => ({
      id: p.id,
      joinedAt: p.created_at,
      source: p.source,
      pre: preCompleted.has(p.id),
      firstSession: first.has(p.id),
      retained: retained.some((r) => r.id === p.id),
    })),
  };
}
