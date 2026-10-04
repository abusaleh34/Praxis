export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error ?? 'تعذّر الاتصال.'), { status: response.status });
  return data;
}
export const post = <T = any>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
