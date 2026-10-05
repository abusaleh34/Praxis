import { lessons } from './mentor-catalog';
export const skillNames: Record<string, string> = Object.fromEntries(
  lessons.map((l) => [l.id, l.name]),
);
export const prerequisites: Record<string, string[]> = {
  triangle: [],
  isosceles: ['triangle'],
  parallel: [],
  exterior: ['triangle'],
  rectangle: [],
  right: ['rectangle'],
  circle: ['triangle'],
  polygon: ['triangle'],
  ratio: [],
  fractions: ['ratio'],
  speed: ['ratio'],
  analogy: [],
  reading: [],
  physics: ['speed'],
  chemistry: ['ratio'],
};
export type Evidence = {
  skill: string;
  question: string;
  correct: boolean;
  assisted: boolean;
  kind: string;
  date: string;
};
export function adaptiveProfile(evidence: Evidence[], now = Date.now()) {
  const skills = Object.entries(skillNames).map(([id, name]) => {
    const rows = evidence.filter((e) => e.skill === id);
    const recent = [...rows].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 12);
    const independent = new Set(
      recent
        .filter((e) => e.kind === 'practice' && e.correct && !e.assisted)
        .map((e) => e.question),
    ).size;
    const wrong = recent.filter((e) => !e.correct).length,
      assisted = recent.filter((e) => e.assisted).length;
    const last = recent[0]?.date ?? null;
    const due = Boolean(last && now - Date.parse(last) > 3 * 86400000);
    const state = !rows.length
      ? 'لم نستكشفها'
      : independent >= 3
        ? 'أداء مستقل جيد'
        : wrong || assisted
          ? 'نحتاج مراجعة'
          : 'قيد التدريب';
    const priority =
      wrong * 3 + assisted * 2 + (due ? 3 : 0) + (rows.length ? 0 : 2) - independent * 2;
    return {
      id,
      name,
      independent,
      wrong,
      assisted,
      attempts: rows.length,
      last,
      due,
      state,
      priority,
      prerequisites: prerequisites[id],
    };
  });
  const ranked = [...skills].sort((a, b) => b.priority - a.priority);
  let next = ranked[0];
  const prerequisite = next.prerequisites
    .map((id) => skills.find((s) => s.id === id)!)
    .find((s) => s.wrong > 0 && s.independent < 2);
  if (prerequisite) next = prerequisite;
  const reason = prerequisite
    ? `نراجع ${next.name} لأنها أساس لمهارة ${ranked[0].name} وظهرت أخطاء فيها.`
    : next.wrong
      ? `ظهرت ${next.wrong} محاولات تحتاج مراجعة في ${next.name}. نبدأ بالفكرة ثم سؤال جديد.`
      : next.assisted
        ? `نجرّب ${next.name} دون مساعدة بعد استخدام التلميحات.`
        : next.due
          ? `حان وقت مراجعة ${next.name} للتأكد من بقاء الفهم.`
          : `نستكشف ${next.name} لبناء صورة أوضح عن مستواك.`;
  return {
    skills,
    recommendation: { skill: next.id, name: next.name, reason },
    note: 'هذه توصية تدريب من محاولاتك، وليست تقديرًا لدرجة قياس. يتأكد الفهم مع أسئلة جديدة ومراجعة لاحقة.',
  };
}
