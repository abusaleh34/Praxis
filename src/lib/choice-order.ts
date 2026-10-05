import { createHash } from 'node:crypto';
export function choiceOrder(sessionId: string, questionId: string, shuffled: boolean) {
  return [0, 1, 2, 3].sort((a, b) => {
    if (!shuffled) return a - b;
    const digest = (i: number) =>
      createHash('sha256').update(`${sessionId}:${questionId}:${i}`).digest('hex');
    return digest(a).localeCompare(digest(b));
  });
}
