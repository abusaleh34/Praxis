import 'server-only';
import postgres from 'postgres';
const globalDb = globalThis as unknown as { praxisSql?: ReturnType<typeof postgres> };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('Database not configured');
  return (globalDb.praxisSql ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  }));
}
