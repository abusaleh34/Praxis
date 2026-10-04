export const DAY = 86400000;
export const CONSENT_VERSION = 'pilot-draft-2026-10-03';
export function postOpensAt(joined: string | Date) {
  return new Date(new Date(joined).getTime() + 14 * DAY);
}
export function postEligible(joined: string | Date, now = new Date()) {
  return now.getTime() >= postOpensAt(joined).getTime();
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '\uFEFF';
  const keys = Object.keys(rows[0]);
  return (
    '\uFEFF' +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(csvCell).join(','))
      .join('\r\n')
  );
}
export function learningMetrics(pairs: { pre: number; post: number }[]) {
  if (!pairs.length) return { paired: 0, gain: null, improved: null };
  return {
    paired: pairs.length,
    gain: pairs.reduce((s, p) => s + ((p.post - p.pre) / 15) * 100, 0) / pairs.length,
    improved: (pairs.filter((p) => p.post > p.pre).length / pairs.length) * 100,
  };
}
