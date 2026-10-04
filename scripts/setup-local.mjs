import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (!existsSync('.env.local') && !existsSync('.env.db')) {
  const password = randomBytes(24).toString('hex');
  const admin = randomBytes(32).toString('hex');
  writeFileSync('.env.db', `POSTGRES_PASSWORD=${password}\n`, { mode: 0o600 });
  writeFileSync(
    '.env.local',
    `DATABASE_URL=postgres://praxis:${password}@127.0.0.1:55432/praxis\nPRAXIS_ADMIN_TOKEN=${admin}\nPRAXIS_MODE=development\nPRAXIS_SECURE_COOKIES=false\n`,
    { mode: 0o600 },
  );
  console.log('Created private local configuration; no credentials printed.');
} else if (!existsSync('.env.local') || !existsSync('.env.db')) {
  throw new Error(
    'Partial local configuration exists. Preserve it and repair the missing file before continuing.',
  );
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
};
run('docker', ['compose', '--env-file', '.env.db', 'up', '-d', '--wait']);
run(process.execPath, ['--env-file=.env.local', 'scripts/migrate.mjs']);
console.log('Local PostgreSQL ready. Start with npm run dev.');
