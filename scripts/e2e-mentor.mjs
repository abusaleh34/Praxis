import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import postgres from 'postgres';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PRAXIS_TEST_URL ?? 'http://127.0.0.1:3002';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Local fixtures only.');
const sql = postgres(process.env.DATABASE_URL, { max: 1 }),
  ids = [];
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
    viewport: { width: 1440, height: 1100 },
  }),
  other = await browser.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
let client = context.request;
const page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
let passed = 0;
async function call(method, path, data, status = 200, who = client) {
  const r = await who.fetch(path, { method, data });
  const j = await r.json();
  assert.equal(r.status(), status, method + ' ' + path + ' ' + JSON.stringify(j));
  return j;
}
const get = (p) => call('GET', p),
  post = (p, d, s) => call('POST', p, d, s);
async function check(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}
try {
  await check(
    'Interactive lab is usable before account creation and reacts to values',
    async () => {
      await page.goto('/mentor');
      await page.getByRole('heading', { name: 'شاهد الفكرة. جرّبها. افهمها.' }).waitFor();
      await page.getByRole('slider', { name: 'الزاوية الأولى', exact: true }).waitFor();
      const range = page.getByRole('slider', { name: 'الزاوية الأولى', exact: true });
      await range.fill('80');
      await page.getByRole('button', { name: 'التالي', exact: true }).click();
      await page.getByRole('button', { name: 'التالي', exact: true }).click();
      assert((await page.locator('.lab-formula').innerText()).includes('40°'));
      await page.getByRole('textbox', { name: 'إجابة الخطوة', exact: true }).fill('١٤٠');
      await page.getByRole('button', { name: 'تحقق من خطوتي' }).click();
      assert((await page.locator('.socratic-box').first().innerText()).includes('صحيح'));
    },
  );
  await check('Private browser OCR reads a printed sample and requires confirmation', async () => {
    await page.evaluate(() => document.fonts.ready);
    const data = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 950;
      c.height = 180;
      const x = c.getContext('2d');
      x.fillStyle = 'white';
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = 'black';
      x.font = '38px Arial';
      x.fillText('Triangle angles: 30 and 45.', 35, 65);
      x.fillText('Find the third angle.', 35, 130);
      return c.toDataURL('image/png').split(',')[1];
    });
    await writeFile('test-results/ocr-sample.png', Buffer.from(data, 'base64'));
    await page.locator('.photo-question summary').click();
    await page.locator('input[type=file]').setInputFiles('test-results/ocr-sample.png');
    await page.getByRole('button', { name: 'اقرأ الصورة على جهازي' }).click();
    await page.waitForFunction(
      () => document.querySelector('textarea')?.value.includes('45'),
      {},
      { timeout: 90000 },
    );
    assert((await page.locator('textarea').inputValue()).includes('30'));
    await page.evaluate(() => document.fonts.load('38px PraxisArabic'));
    const arabic = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1000;
      c.height = 230;
      const x = c.getContext('2d');
      x.fillStyle = 'white';
      x.fillRect(0, 0, 1000, 230);
      x.fillStyle = 'black';
      x.font = '38px PraxisArabic';
      x.direction = 'rtl';
      x.textAlign = 'right';
      x.fillText('في مثلث زاويتان 30 و 45 درجة', 940, 85);
      x.fillText('أوجد قياس الزاوية الثالثة', 940, 175);
      return c.toDataURL().split(',')[1];
    });
    await writeFile('test-results/ocr-arabic.png', Buffer.from(arabic, 'base64'));
    await page.locator('input[type=file]').setInputFiles('test-results/ocr-arabic.png');
    await page.getByRole('button', { name: 'اقرأ الصورة على جهازي' }).click();
    await page.waitForFunction(
      () => document.querySelector('textarea')?.value.includes('45'),
      {},
      { timeout: 90000 },
    );
    const arabicText = await page.locator('textarea').inputValue();
    assert(arabicText.includes('30'));
    assert(arabicText.includes('مثلث'));

    await page.getByRole('button', { name: 'راجع نوع السؤال والقيم' }).click();
    assert(await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).isDisabled());
    await page.locator('.photo-confirm input[type=checkbox]').check();
    await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).click();
    assert.equal(
      await page.getByRole('slider', { name: 'الزاوية الأولى', exact: true }).inputValue(),
      '30',
    );
  });
  await check('Mentor training works without pre-test and isolates student data', async () => {
    const p = await post('/api/enroll', { consent: true, source: 'mentor_e2e' }, 201);
    ids.push(p.id);
    const p2 = await call(
      'POST',
      '/api/enroll',
      { consent: true, source: 'mentor_e2e' },
      201,
      other.request,
    );
    ids.push(p2.id);
    const b = await post('/api/mentor', { action: 'start', lesson: 'circle', mode: 'learn' });
    const s = await get('/api/mentor?id=' + b.id);
    assert(!('answer' in s.question));
    assert(!('steps' in s.question));
    await call('GET', '/api/mentor?id=' + b.id, undefined, 404, other.request);
    await call('POST', '/api/mentor', { action: 'hint', id: s.question.id }, 409, other.request);
    const n = Number(s.question.prompt.match(/\d+/)[0]),
      correct = s.question.choices.indexOf(String(n / 2));
    await post('/api/mentor', { action: 'hint', id: s.question.id });
    const wrong = await post('/api/mentor', {
      action: 'answer',
      id: s.question.id,
      choice: (correct + 1) % 4,
      elapsedMs: 70000,
    });
    assert.equal(wrong.correct, false);
    assert(!('answer' in wrong));
    const retry = await post('/api/mentor', {
      action: 'answer',
      id: s.question.id,
      choice: correct,
      elapsedMs: 74000,
    });
    assert.equal(retry.correct, true);
    assert(retry.steps.length);
    await post('/api/mentor', {
      action: 'answer',
      id: s.question.id,
      choice: correct,
      elapsedMs: 99999,
    });
    const next = await get('/api/mentor?id=' + b.id);
    assert.equal(next.index, 1);
    assert.notEqual(next.question.prompt, s.question.prompt);
    await post('/api/mentor', {
      action: 'answer',
      id: next.question.id,
      choice: -1,
      elapsedMs: 1500,
    });
    await post('/api/mentor', {
      action: 'answer',
      id: next.question.id,
      choice: -1,
      elapsedMs: 1600,
      reveal: true,
    });
    await post('/api/mentor', { action: 'finish', id: b.id });
    const done = await get('/api/mentor?id=' + b.id);
    assert.equal(done.results[0].firstCorrect, false);
    assert.equal(done.results[0].assisted, true);
    assert.equal(done.results[0].elapsedMs, 74000);
    const [firstAttempt] =
      await sql`SELECT elapsed_ms FROM mentor_attempts WHERE activity_id=${s.question.id} AND participant_id=${p.id}`;
    assert.equal(firstAttempt.elapsed_ms, 70000, 'first-attempt evidence remains unchanged');
  });
  await check(
    'Timed practice hides grading, denies hints, and enforces its server deadline',
    async () => {
      const before = (await get('/api/report')).report;
      const b = await post('/api/mentor', { action: 'start', lesson: 'triangle', mode: 'exam' });
      const s = await get('/api/mentor?id=' + b.id);
      assert(s.deadline);
      assert.equal(s.total, 6);
      assert(!('firstCorrect' in s.question));
      await post('/api/mentor', { action: 'hint', id: s.question.id }, 409);
      const result = await post('/api/mentor', {
        action: 'answer',
        id: s.question.id,
        choice: 0,
        elapsedMs: 1000,
      });
      assert(!('correct' in result));
      assert(!('answer' in result));
      const during = (await get('/api/report')).report;
      assert.equal(during.attempts, before.attempts);
      assert.deepEqual(during.skills, before.skills);
      await post('/api/tutor', { id: s.question.id, message: 'اشرح الفكرة' }, 403);
      await sql`UPDATE mentor_batches SET deadline=now()-interval '1 second' WHERE id=${b.id}`;
      const finished = await get('/api/mentor?id=' + b.id);
      assert(finished.finished);
      assert(finished.results[0].steps.length);
      assert.equal(finished.results[1].chosen, null);
      await post(
        '/api/mentor',
        { action: 'answer', id: finished.results[1].id, choice: 0, elapsedMs: 1000 },
        409,
      );
    },
  );
  await check(
    'Weekly report uses real attempts and shares a revocable read-only snapshot',
    async () => {
      const { report } = await get('/api/report');
      assert(report.attempts >= 3);
      assert(report.review.includes('زوايا الدائرة'));
      assert.equal(report.skills.length, 15);
      await post('/api/report', { action: 'share', consent: false }, 400);
      const share = await post('/api/report', { action: 'share', consent: true });
      const path = '/shared/' + share.token;
      const r = await other.request.get(path);
      assert.equal(r.status(), 200);
      const html = await r.text();
      assert(html.includes('للقراءة فقط'));
      assert(!html.includes(ids[0]));
      assert(!html.includes('recovery'));
      const { shares } = await get('/api/report');
      await post('/api/report', { action: 'revoke', id: shares[0].id });
      assert.equal((await other.request.get(path)).status(), 404);
    },
  );
  await check(
    'Recovery restores the same account and invalidates its previous cookie',
    async () => {
      const { code } = await post('/api/access', { action: 'create' });
      await call('POST', '/api/access', { action: 'restore', code }, 200, other.request);
      await call('GET', '/api/overview', undefined, 401, client);
      client = other.request;
      assert.equal((await get('/api/overview')).participant.id, ids[0]);
      await post('/api/logout', {});
      await call('GET', '/api/overview', undefined, 401, client);
      await post('/api/access', { action: 'restore', code });
      assert.equal((await get('/api/overview')).participant.id, ids[0]);
    },
  );
  await check('New pages work on mobile and desktop with no client-side failures', async () => {
    const owner = await other.newPage();
    owner.on('pageerror', (e) => errors.push(e.message));
    for (const width of [1440, 390]) {
      await owner.setViewportSize({ width, height: 1000 });
      for (const route of ['/mentor', '/challenge', '/report', '/learn', '/progress']) {
        await owner.goto(route);
        await owner.getByRole('heading', { level: 1 }).waitFor();
        await owner.evaluate(() => document.fonts.ready);
        assert(
          await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          route + ' overflow ' + width,
        );
        await owner.screenshot({
          path: `test-results/mentor-${route.slice(1)}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await owner.goto('/mentor?skill=analogy');
    await owner.getByRole('button', { name: 'جرّب', exact: true }).click();
    await owner.getByRole('button', { name: 'ابدأ التدريب', exact: true }).click();
    await owner.locator('.mentor-choices').waitFor();
    assert((await owner.locator('.exercise').innerText()).includes('علاقة'));
    assert.deepEqual(errors, []);
  });
  await check(
    'Targeted cleanup refuses real students and deletes only marked review fixtures',
    async () => {
      const pre = await post('/api/sessions', { kind: 'pre' }, 201);
      await post('/api/admin/login', { secret: process.env.PRAXIS_ADMIN_TOKEN });
      await sql`UPDATE participants SET is_test=false WHERE id=${ids[0]}`;
      assert.equal((await post('/api/admin/cleanup-test', { sessionId: pre.id })).removed, 0);
      await sql`UPDATE participants SET is_test=true WHERE id=${ids[0]}`;
      assert.equal((await post('/api/admin/cleanup-test', { sessionId: pre.id })).removed, 1);
    },
  );
  await writeFile(
    'test-results/mentor-summary.json',
    JSON.stringify(
      {
        passed,
        date: new Date().toISOString(),
        ocr: 'printed sample, local browser',
        modelLiveTested: false,
      },
      null,
      2,
    ),
  );
  console.log(`Completed ${passed} mentor integration checks.`);
} catch (e) {
  await page
    .screenshot({ path: 'test-results/mentor-failure.png', fullPage: true })
    .catch(() => {});
  throw e;
} finally {
  for (const id of ids) await sql`DELETE FROM participants WHERE id=${id}`;
  await sql.end();
  await browser.close();
}
