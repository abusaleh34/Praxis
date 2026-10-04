import 'server-only';
import { db } from './db';
import { questions, contentHash } from './content';
export async function readiness() {
  const reviews = await db()`SELECT question_id,content_hash FROM content_reviews`;
  const map = new Map(reviews.map((r) => [r.question_id, r.content_hash]));
  const reviewed = questions.filter((q) => map.get(q.id) === contentHash(q)).length;
  const flags = {
    content: reviewed === 80,
    demand: process.env.PRAXIS_DEMAND_VALIDATED === 'true',
    privacy: process.env.PRAXIS_PRIVACY_REVIEWED === 'true',
    hints: process.env.PRAXIS_HINT_QUALITY_APPROVED === 'true',
    access: Boolean(process.env.PRAXIS_PILOT_CODE),
    secureCookies: process.env.PRAXIS_SECURE_COOKIES === 'true',
  };
  return {
    reviewed,
    total: questions.length,
    flags,
    ready: Object.values(flags).every(Boolean),
    mode: ['pilot', 'waitlist'].includes(process.env.PRAXIS_MODE ?? '')
      ? process.env.PRAXIS_MODE!
      : 'development',
  };
}
