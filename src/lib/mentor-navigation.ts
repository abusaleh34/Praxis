import { lessonById } from './mentor-catalog';

export function safeDestination(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path))
    return '/learn';
  const url = new URL(path, 'https://praxis.invalid');
  if (!['/mentor', '/challenge', '/report'].includes(url.pathname)) return '/learn';
  const q = new URLSearchParams();
  const skill = url.searchParams.get('skill');
  if (skill && lessonById.has(skill)) q.set('skill', skill);
  for (const [key, allowed] of Object.entries({
    mode: ['learn', 'speed', 'exam'],
    view: ['learn', 'practice', 'review'],
    target: ['area', 'perimeter'],
  })) {
    const value = url.searchParams.get(key);
    if (value && allowed.includes(value)) q.set(key, value);
  }
  for (const key of ['a', 'b', 'step']) {
    const value = url.searchParams.get(key);
    if (value && /^\d+(\.\d+)?$/.test(value) && Number(value) <= 10000) q.set(key, value);
  }
  const batch = url.searchParams.get('batch');
  if (batch && /^[a-f0-9-]{36}$/.test(batch)) q.set('batch', batch);
  return url.pathname + (q.size ? '?' + q.toString() : '');
}

export function rememberMentor() {
  const url = new URL(location.href);
  url.searchParams.delete('batch');
  sessionStorage.setItem(
    'praxis-context:' + url.pathname,
    safeDestination(url.pathname + url.search),
  );
}

export function sessionHref(s: { id: string; lesson: string; mode: string }) {
  return `${s.mode === 'learn' ? '/mentor' : '/challenge'}?skill=${s.lesson}&mode=${s.mode}&batch=${s.id}&view=practice`;
}
