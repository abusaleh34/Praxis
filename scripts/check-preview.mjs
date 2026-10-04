import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const base = process.env.PRAXIS_TEST_URL ?? 'http://127.0.0.1:3001';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Preview fixtures only run against a local development server.');
if (!process.env.PRAXIS_PREVIEW_PASSWORD) throw new Error('Preview password is required.');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const guest = await browser.newContext({ baseURL: base });
const member = await browser.newContext({
  baseURL: base,
});
let enrolled = false;
let passed = 0;
const page = await member.newPage();
async function check(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}
async function call(path, data) {
  const response = await page.evaluate(
    async ({ path, data }) => {
      const r = await fetch(path, {
        method: data === undefined ? 'GET' : 'POST',
        headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return { status: r.status, ok: r.ok, body: await r.json() };
    },
    { path, data },
  );
  assert(response.ok, `Request failed (${response.status})`);
  return response.body;
}
try {
  await check('Guests see an in-site login, while APIs stay protected', async () => {
    for (const path of ['/', '/start', '/admin']) {
      const response = await guest.request.get(path, { maxRedirects: 0 });
      assert.equal(response.status(), 307);
      assert.equal(new URL(response.headers().location).origin, base);
      assert.equal(new URL(response.headers().location).pathname, '/preview');
      assert(!response.headers()['www-authenticate']);
    }
    assert.equal((await guest.request.get('/api/config')).status(), 401);
    assert.equal(
      (
        await guest.request.post('/api/enroll', {
          headers: { Origin: base },
          data: { consent: true },
        })
      ).status(),
      401,
    );
  });
  await check('Database health probe works without preview credentials', async () => {
    assert.deepEqual(await (await guest.request.get('/api/health')).json(), {
      ok: true,
      app: 'Praxis',
    });
  });
  await check(
    'Proxy redirects preserve the public HTTPS origin without leaking the internal port',
    async () => {
      const response = await guest.request.get('/start', {
        maxRedirects: 0,
        headers: { Host: 'preview.example', 'X-Forwarded-Proto': 'https' },
      });
      assert.equal(response.status(), 307);
      assert.equal(response.headers().location, 'https://preview.example/preview?next=%2Fstart');
    },
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await check('Login rejects cross-origin submissions and incorrect passwords', async () => {
    const response = await guest.request.post('/preview', {
      headers: { Origin: 'https://untrusted.example' },
      form: { password: process.env.PRAXIS_PREVIEW_PASSWORD },
    });
    assert.equal(response.status(), 403);
    await page.goto('/start');
    await page.getByLabel('كلمة مرور المعاينة').fill('incorrect-password');
    await page.getByRole('button', { name: 'دخول المعاينة' }).click();
    await page.getByRole('alert').waitFor();
    assert(!(await member.cookies()).some((c) => c.name === 'praxis_preview'));
  });
  await check(
    'In-site login persists and loads protected JavaScript without browser authentication',
    async () => {
      await page.getByLabel('كلمة مرور المعاينة').fill(process.env.PRAXIS_PREVIEW_PASSWORD);
      await page.getByRole('button', { name: 'دخول المعاينة' }).click();
      await page.waitForURL('**/start');
      await page.getByRole('checkbox').waitFor();
      const cookie = (await member.cookies()).find((c) => c.name === 'praxis_preview');
      assert(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
      assert(!(await page.evaluate(() => document.cookie)).includes('praxis_preview'));
      await page.reload();
      await page.getByRole('checkbox').waitFor();
      const script = await page.locator('script[src]').first().getAttribute('src');
      assert(script);
      assert.equal((await guest.request.get(script)).status(), 401);
      assert.equal(await page.evaluate(async (url) => (await fetch(url)).status, script), 200);
      assert.deepEqual(errors, []);
    },
  );
  await check(
    'Enrollment, secure session cookie, and protected student dashboard work',
    async () => {
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'لنبدأ الرحلة' }).click();
      await page.waitForURL('**/learn');
      enrolled = true;
      await page.getByRole('button', { name: 'ابدأ الاختبار القبلي', exact: true }).waitFor();
      const cookie = (await member.cookies()).find((c) => c.name === 'praxis_session');
      assert(cookie?.secure && cookie.httpOnly);
    },
  );
  await check(
    'Pre-test, training, and authored hints work behind preview authentication',
    async () => {
      const questions = JSON.parse(
        await readFile(new URL('../content/questions.json', import.meta.url), 'utf8'),
      );
      const bank = new Map(questions.map((q) => [q.id, q]));
      const { id } = await call('/api/sessions', { kind: 'pre' });
      let state = await call('/api/sessions/' + id);
      while (!state.completed) {
        await call(`/api/sessions/${id}/answer`, {
          questionId: state.question.id,
          choice: bank.get(state.question.id).answerIndex,
          elapsedMs: 1200,
        });
        state = await call('/api/sessions/' + id);
      }
      const practice = await call('/api/sessions', { kind: 'practice' });
      state = await call('/api/sessions/' + practice.id);
      const question = bank.get(state.question.id);
      await call(`/api/sessions/${practice.id}/answer`, {
        questionId: question.id,
        choice: (question.answerIndex + 1) % 4,
        elapsedMs: 1200,
      });
      const hint = await call(`/api/sessions/${practice.id}/hint`, {
        questionId: question.id,
        stage: 1,
      });
      assert.equal(hint.source, 'authored');
      assert(hint.text.length > 0);
      await page.goto('/session/' + practice.id);
      await page.getByRole('radiogroup').waitFor();
      assert.deepEqual(errors, []);
    },
  );
  await check('Tampered preview cookies do not open protected pages', async () => {
    const cookie = (await member.cookies()).find((c) => c.name === 'praxis_preview');
    await guest.addCookies([{ ...cookie, value: cookie.value + 'tampered' }]);
    const guestPage = await guest.newPage();
    await guestPage.goto('/admin');
    await guestPage.getByLabel('كلمة مرور المعاينة').waitFor();
    await guestPage.close();
  });
  console.log(`${passed} private preview checks passed.`);
} finally {
  try {
    if (enrolled)
      assert.equal(
        await page.evaluate(async () => (await fetch('/api/account', { method: 'DELETE' })).status),
        200,
      );
  } finally {
    await browser.close();
  }
}
