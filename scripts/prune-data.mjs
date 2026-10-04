import postgres from 'postgres';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const rows =
    await sql`DELETE FROM participants WHERE created_at<now()-interval '90 days' RETURNING id`;
  await sql`DELETE FROM rate_limits WHERE expires_at<now()`;
  await sql`DELETE FROM events WHERE participant_id IS NULL AND created_at<now()-interval '90 days'`;
  console.log(`Deleted ${rows.length} expired participant records and associated data.`);
} finally {
  await sql.end();
}
