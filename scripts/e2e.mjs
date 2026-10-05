import { strict as assert } from 'node:assert';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import postgres from 'postgres';
const base = process.env.PRAXIS_TEST_URL ?? 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('This fixture runner is restricted to a local development server.');
const raw = JSON.parse(
  await readFile(new URL('../content/questions.json', import.meta.url), 'utf8'),
);
const bank = new Map(raw.map((q) => [q.id, q]));
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 1050 },
  extraHTTPHeaders: { Origin: base },
});
const second = await browser.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
const page = await context.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));
const participantIds = [];
let passed = 0;
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
const out = new URL('../test-results/', import.meta.url);
async function call(client, method, path, data, status = 200) {
  const r = await client.fetch('/api/' + path, { method, data });
  const body = await r.json();
  assert.equal(r.status(), status, `${method} ${path}: ${JSON.stringify(body)}`);
  return body;
}
const get = (path) => call(context.request, 'GET', path);
const post = (path, data, status = 200) => call(context.request, 'POST', path, data, status);
async function check(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}
async function complete(id) {
  let s = await get('sessions/' + id);
  while (!s.completed) {
    const q = bank.get(s.question.id);
    await post(`sessions/${id}/answer`, {
      questionId: q.id,
      choice: s.question.choices.indexOf(q.choices[q.answerIndex]),
      elapsedMs: 1200,
    });
    s = await get('sessions/' + id);
  }
  return s;
}
try {
  const config = await get('config');
  assert.equal(config.mode, 'development', 'Fixture tests must not run on an open pilot.');
  await check('Unauthenticated data and cross-origin enrollment are rejected', async () => {
    await call(context.request, 'GET', 'overview', undefined, 401);
    const r = await context.request.post('/api/enroll', {
      headers: { Origin: 'https://not-praxis.example' },
      data: { consent: true },
    });
    assert.equal(r.status(), 403);
    await post('enroll', { consent: false }, 400);
  });
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('landing-desktop.png', out).pathname, fullPage: true });
  await check('Consent-based enrollment and initial dashboard', async () => {
    await page.goto('/start?from=e2e');
    await page.getByRole('checkbox').waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'لنبدأ الرحلة' }).click();
    await page.waitForURL('**/learn');
    await page.getByRole('button', { name: 'ابدأ الاختبار القبلي', exact: true }).waitFor();
    participantIds.push((await get('overview')).participant.id);
    await page.screenshot({ path: new URL('dashboard-desktop.png', out).pathname, fullPage: true });
    const c = await context.cookies();
    assert(c.find((x) => x.name === 'praxis_session')?.httpOnly);
    assert(!(await page.evaluate(() => document.cookie.includes('praxis_session'))));
  });
  await check('Practice and post-test require the pre-test', async () => {
    await post('sessions', { kind: 'practice' }, 409);
    await post('sessions', { kind: 'post' }, 409);
  });
  let preId;
  await check('Pre-test is server-scored and never leaks answer keys or correctness', async () => {
    const pre = await post('sessions', { kind: 'pre' }, 201);
    preId = pre.id;
    let s = await get('sessions/' + pre.id);
    assert.equal(s.total, 15);
    assert(!('answerIndex' in s.question));
    assert(!('steps' in s.question));
    assert(!('feedback' in s.question));
    await post(
      `sessions/${pre.id}/hint`,
      { questionId: s.question.id, stage: 1, choice: null },
      403,
    );
    await post(
      `sessions/${pre.id}/answer`,
      { questionId: 'pre-02', choice: 0, elapsedMs: 1000 },
      409,
    );
    const answer = {
      questionId: s.question.id,
      choice: s.question.choices.indexOf(
        bank.get(s.question.id).choices[bank.get(s.question.id).answerIndex],
      ),
      elapsedMs: 1000,
    };
    const first = await post(`sessions/${pre.id}/answer`, answer);
    const repeat = await post(`sessions/${pre.id}/answer`, answer);
    assert(!('correct' in first));
    assert(!('correct' in repeat));
    assert(!('answerIndex' in repeat));
    s = await complete(pre.id);
    assert.equal(s.score, 15);
  });
  let practiceId;
  await check('Concurrent starts reuse one practice session', async () => {
    const [a, b] = await Promise.all([
      post('sessions', { kind: 'practice' }, 201),
      post('sessions', { kind: 'practice' }, 201),
    ]);
    assert.equal(a.id, b.id);
    practiceId = a.id;
  });
  await check(
    'Choosing a new skill preserves separate open sessions and stable choices',
    async () => {
      const circle = await post('sessions', { kind: 'practice', skill: 'circle' }, 201);
      const rectangle = await post('sessions', { kind: 'practice', skill: 'rectangle' }, 201);
      assert.notEqual(circle.id, rectangle.id);
      assert.equal((await get('sessions/' + circle.id)).question.skillId, 'circle');
      assert.equal((await get('sessions/' + rectangle.id)).question.skillId, 'rectangle');
      const resume = await post('sessions', { kind: 'practice', skill: 'circle' }, 201);
      assert.equal(resume.id, circle.id);
      assert.deepEqual(
        (await get('sessions/' + circle.id)).question.choices,
        (await get('sessions/' + resume.id)).question.choices,
      );
    },
  );
  await check('Wrong answer, authored hint, retry, and progress survive the real UI', async () => {
    const s = await get('sessions/' + practiceId),
      q = bank.get(s.question.id),
      correct = s.question.choices.indexOf(q.choices[q.answerIndex]),
      wrong = (correct + 1) % 4;
    await page.goto('/session/' + practiceId);
    await page.getByRole('radiogroup').waitFor();
    await page.getByRole('radio').nth(wrong).check();
    await page.getByRole('button', { name: 'تأكيد الإجابة', exact: true }).click();
    await page.getByRole('button', { name: 'جرّب مرة أخرى', exact: true }).waitFor();
    await page.locator('.hint-text').waitFor();
    assert.equal((await get('sessions/' + practiceId)).index, 0);
    await page.screenshot({ path: new URL('training-desktop.png', out).pathname, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: new URL('training-mobile.png', out).pathname, fullPage: true });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Mobile training must not overflow horizontally',
    );
    await page.getByRole('radio').nth(correct).check();
    await page.getByRole('button', { name: 'جرّب مرة أخرى', exact: true }).click();
    await page.getByRole('button', { name: 'السؤال التالي', exact: true }).waitFor();
    await page.getByRole('button', { name: 'السؤال التالي', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.session-count')?.textContent === '2 من 5',
    );
    await page.reload();
    await page.getByRole('radiogroup').waitFor();
    assert.equal((await get('sessions/' + practiceId)).index, 1);
  });
  await check('Participant isolation rejects access to another learner’s session', async () => {
    const p = await call(second.request, 'POST', 'enroll', { consent: true, source: 'e2e' }, 201);
    participantIds.push(p.id);
    await call(second.request, 'GET', 'sessions/' + practiceId, undefined, 404);
    await call(
      second.request,
      'POST',
      `sessions/${practiceId}/answer`,
      { questionId: 'practice-02', choice: 0, elapsedMs: 10 },
      404,
    );
  });
  await check('Five-question session preserves the first-attempt score', async () => {
    const done = await complete(practiceId);
    assert.equal(done.score, 4);
    const d = await get('overview');
    assert.equal(d.practiceSessions, 1);
    assert.equal(d.accuracy, 80);
  });
  await check('Post-test stays locked for fourteen days and opens at eligibility', async () => {
    await post('sessions', { kind: 'post' }, 409);
    await sql`UPDATE participants SET created_at=now()-interval '14 days 1 minute' WHERE id=${participantIds[0]}`;
    const postTest = await post('sessions', { kind: 'post' }, 201);
    const done = await complete(postTest.id);
    assert.equal(done.score, 15);
  });
  await check(
    'Admin protects content, rejects stale approvals, and exports live data',
    async () => {
      await call(second.request, 'GET', 'admin/content', undefined, 401);
      await post('admin/login', { secret: process.env.PRAXIS_ADMIN_TOKEN });
      const content = await get('admin/content');
      assert.equal(content.length, 80);
      await post(
        'admin/review',
        { questionId: content[0].id, hash: 'stale', reviewer: 'Test fixture', verified: true },
        409,
      );
      const report = await get('admin/overview');
      assert(
        !report.participants.some((p) => participantIds.includes(p.id)),
        'Test participants are excluded from reporting',
      );
      const csv = await context.request.get('/api/admin/export');
      assert.equal(csv.status(), 200);
      assert(!(await csv.text()).includes(participantIds[0]));
    },
  );
  await check('Reviewer UI shows drafts and requires explicit human signoff', async () => {
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto('/admin');
    await page.getByRole('button', { name: 'مراجعة المحتوى', exact: true }).click();
    await page.locator('.review-detail h2').waitFor();
    assert.equal(await page.locator('.review-list button').count(), 80);
    if (await page.getByRole('button', { name: 'اعتماد السؤال', exact: true }).count()) {
      assert(await page.getByRole('button', { name: 'اعتماد السؤال', exact: true }).isDisabled());
    }
    await page.screenshot({ path: new URL('review-desktop.png', out).pathname, fullPage: true });
  });
  await check('All student pages fit mobile screens without JavaScript failures', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/learn', '/library', '/progress']) {
      await page.goto(route);
      await page.waitForFunction(() => !document.querySelector('.loading'));
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route + ' overflows',
      );
      await page.screenshot({
        path: new URL(route.slice(1) + '-mobile.png', out).pathname,
        fullPage: true,
      });
    }
    assert.deepEqual(jsErrors, []);
  });
  await check('Account deletion removes the participant and child records', async () => {
    await call(second.request, 'DELETE', 'account');
    await call(second.request, 'GET', 'overview', undefined, 401);
    const [row] = await sql`SELECT count(*)::int n FROM participants WHERE id=${participantIds[1]}`;
    assert.equal(row.n, 0);
  });
  await writeFile(
    new URL('e2e-summary.json', out),
    JSON.stringify(
      {
        passed,
        failed: 0,
        createdAt: new Date().toISOString(),
        mode: config.mode,
        modelEvaluated: false,
      },
      null,
      2,
    ),
  );
  console.log(
    `Completed ${passed} functional checks. All passed. Fixture participants are removed below.`,
  );
} catch (e) {
  await page
    .screenshot({ path: new URL('failure.png', out).pathname, fullPage: true })
    .catch(() => {});
  throw e;
} finally {
  if (participantIds.length) await sql`DELETE FROM participants WHERE id IN ${sql(participantIds)}`;
  await context.close();
  await second.close();
  await browser.close();
  await sql.end();
}
