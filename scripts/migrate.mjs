import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  });
  console.log('Database schema ready.');
} finally {
  await sql.end();
}
