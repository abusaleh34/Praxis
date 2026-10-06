import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PRAXIS_TEST_URL ?? 'http://127.0.0.1:3002';
const host = new URL(base).hostname;
assert(['localhost', '127.0.0.1', 'praxis-production-1c78.up.railway.app'].includes(host));
const dir = `test-results/fixes-${host.endsWith('.app') ? 'hosted' : 'local'}`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
let enrolled = false,
  other,
  otherEnrolled = false,
  stage = 'entry';
async function call(
  path,
  data,
  method = data ? 'POST' : 'GET',
  client = context.request,
  status = 200,
) {
  // Use browser fetch so secure localhost cookies follow the same behavior as the UI.
  const target = client === context.request ? page : other.pages()[0];
  const response = await target.evaluate(
    async ({ path, data, method }) => {
      const r = await fetch(path, {
        method,
        headers: data ? { 'Content-Type': 'application/json' } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
      return { status: r.status, body: await r.json() };
    },
    { path, data, method },
  );
  assert.equal(response.status, status, response.body.error ?? path);
  return response.body;
}

const state = (id, position) =>
  call('/api/mentor?id=' + id + (position === undefined ? '' : '&position=' + position));
async function check(name, fn) {
  stage = name;
  await fn();
  checks.push(name);
  console.log('PASS ' + name);
}
async function enter(p) {
  await p.goto('/mentor');
  if (new URL(p.url()).pathname === '/preview') {
    assert(process.env.PRAXIS_PREVIEW_PASSWORD, 'Preview credential required');
    await p.locator('input[type=password]').fill(process.env.PRAXIS_PREVIEW_PASSWORD);
    await p.locator('button[type=submit]').click();
  }
  await p.locator('.mentor-lab').waitFor();
}
async function prepare(text) {
  await page.goto('/mentor');
  await page.locator('.mentor-lab').waitFor();
  await page.locator('.photo-question summary').click();
  await page.locator('textarea').fill(text);
  await page.getByRole('button', { name: 'راجع نوع السؤال والقيم' }).click();
}
async function apply() {
  await page.locator('.photo-confirm input[type=checkbox]').check();
  await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).click();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  return page.locator('.lab-formula').innerText();
}
try {
  await enter(page);
  await check('Minute conversion and numbered/reordered dimensions solve correctly', async () => {
    await prepare('سيارة تسير بسرعة 60 كم/ساعة لمدة 30 دقيقة. أوجد المسافة المقطوعة.');
    assert.equal(await page.locator('.photo-confirm select').inputValue(), 'speed');
    assert((await page.locator('.photo-confirm [role=status]').innerText()).includes('0.5'));
    assert((await apply()).includes('30 كم'));
    await prepare('السؤال 14: مستطيل عرضه 5 سم وطوله 8 سم. أوجد مساحته.');
    assert.deepEqual(
      await page
        .locator('.photo-confirm input:not([type=checkbox])')
        .evaluateAll((es) => es.map((e) => e.value)),
      ['8', '5'],
    );
    assert((await apply()).includes('40 سم²'));
    await prepare('سرعة السيارة 60 ميل/ساعة لمدة 30 دقيقة، أوجد المسافة.');
    assert.equal(await page.locator('.photo-confirm select').inputValue(), '');
    assert(await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).isDisabled());
  });
  await check('Unknown angle stays hidden until solved or explanation requested', async () => {
    await page.goto('/mentor?skill=triangle&a=50&b=60&step=0');
    await page.locator('.mentor-lab').waitFor();
    assert.deepEqual(
      (await page.locator('.moving-angle text').allTextContents()).map((t) => t.trim()),
      ['50°', '60°', 'س'],
    );
    assert(!(await page.locator('.proof-player').innerText()).includes('70°'));
    await page.getByRole('textbox', { name: 'إجابة الخطوة', exact: true }).fill('١١٠');
    await page.getByRole('button', { name: 'تحقق من خطوتي' }).click();
    await page.getByRole('textbox', { name: 'إجابة الخطوة', exact: true }).fill('٧٠');
    await page.getByRole('button', { name: 'تحقق من خطوتي' }).click();
    assert((await page.locator('.moving-angle text').last().textContent()).includes('70°'));
    await page.reload();
    await page.locator('.mentor-lab').waitFor();
    assert((await page.locator('.moving-angle text').last().textContent()).includes('س'));
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    assert((await page.locator('.moving-angle text').last().textContent()).includes('س'));
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    assert((await page.locator('.moving-angle text').last().textContent()).includes('70°'));
  });
  await check('Mobile question immediately follows diagram and uses named operations', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mentor?skill=triangle&a=50&b=60&step=0');
    await page.locator('.mentor-lab').waitFor();
    const visual = await page.locator('.lab-visual').boundingBox(),
      question = await page.locator('form.socratic-box').boundingBox();
    assert(question.y - visual.y - visual.height < 25, 'question should follow visual');
    assert(question.y < 1400, 'question should not be buried below the controls');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: dir + '/mobile-lab.png', fullPage: true });
    for (const skill of ['speed', 'physics']) {
      await page.goto('/mentor?skill=' + skill);
      await page.locator('.mentor-lab').waitFor();
      const form = page.locator('form.socratic-box');
      assert.equal(await form.locator('input').count(), 0);
      await form.getByRole('button', { name: 'القسمة', exact: true }).click();
      assert((await form.locator('h3').innerText()).includes('أي عملية'));
      await form.getByRole('button', { name: 'الضرب', exact: true }).click();
      await form
        .getByRole('textbox', { name: 'إجابة الخطوة' })
        .fill(skill === 'speed' ? '120' : '20');
      await form.getByRole('button', { name: 'تحقق من خطوتي' }).click();
      assert((await form.innerText()).includes('صحيح!'));
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await call('/api/enroll', { consent: true, source: 'mentor_e2e' }, 'POST', context.request, 201);
  enrolled = true;
  other = await browser.newContext({ baseURL: base });
  const otherPage = await other.newPage();
  await enter(otherPage);
  await call('/api/enroll', { consent: true, source: 'mentor_e2e' }, 'POST', other.request, 201);
  otherEnrolled = true;
  await check(
    'Skipped exam time persists across navigation, reload and submission without adding attempts',
    async () => {
      const batch = await call('/api/mentor', {
        action: 'start',
        lesson: 'triangle',
        mode: 'exam',
      });
      await page.goto('/challenge?mode=exam&batch=' + batch.id);
      await page.getByRole('radiogroup').waitFor();
      const first = (await state(batch.id, 0)).question;
      await page.waitForTimeout(2200);
      await page.locator('.exam-navigation button').nth(1).click();
      await page.waitForFunction(() =>
        document.querySelector('.exercise-meta')?.textContent.includes('السؤال 2 من 6'),
      );
      const persisted = await state(batch.id, 0);
      assert(persisted.question.elapsedMs >= 1800);
      assert.equal(persisted.question.chosen, null);
      assert.equal(persisted.navigation[0].answered, false);
      assert(!('answer' in persisted.question));
      await call('/api/mentor', { action: 'time', id: first.id, elapsedMs: 1 });
      assert(
        (await state(batch.id, 0)).question.elapsedMs >= persisted.question.elapsedMs,
        'monotonic writes',
      );
      await call(
        '/api/mentor',
        { action: 'time', id: first.id, elapsedMs: 90000 },
        'POST',
        other.request,
        404,
      );
      await page.goto('/mentor?skill=triangle&view=learn');
      await page.evaluate(() => sessionStorage.clear());
      await page.goto('/challenge?mode=exam&batch=' + batch.id);
      await page.getByRole('radiogroup').waitFor();
      assert(
        (await state(batch.id, 0)).question.elapsedMs >= persisted.question.elapsedMs,
        'server survives missing local timer',
      );
      // A known time-only fixture verifies report accounting without a grading event.
      await call('/api/mentor', { action: 'time', id: first.id, elapsedMs: 64000 });
      await page.getByRole('button', { name: 'تسليم وعرض النتيجة', exact: true }).click();
      await page.getByRole('button', { name: 'تأكيد التسليم', exact: true }).click();
      await page.locator('.mentor-results').waitFor();
      const result = await state(batch.id);
      assert.equal(result.results[0].elapsedMs, 64000);
      assert.equal(result.results[0].chosen, null);
      assert.equal(result.score, 0);
      await call('/api/mentor', { action: 'time', id: first.id, elapsedMs: 100000 });
      assert.equal(
        (await state(batch.id)).results[0].elapsedMs,
        64000,
        'finished results immutable',
      );
      const { report } = await call('/api/report');
      assert.equal(report.attempts, 0);
      assert.equal(report.accuracy, null);
      assert(report.minutes >= 1);
      await page.screenshot({ path: dir + '/skipped-time.png', fullPage: true });
    },
  );
  await check('Verbal sessions use four distinct sets and retain earlier questions', async () => {
    for (const lesson of ['analogy', 'reading']) {
      const sessions = [];
      for (let run = 0; run < 4; run++) {
        const b = await call('/api/mentor', { action: 'start', lesson, mode: 'learn' }),
          prompts = [];
        for (let i = 0; i < 3; i++) {
          const current = await state(b.id),
            q = current.question;
          prompts.push({ prompt: q.prompt, passage: q.passage, choices: [...q.choices].sort() });
          await call('/api/mentor', { action: 'hint', id: q.id });
          await call('/api/mentor', { action: 'answer', id: q.id, choice: -1, elapsedMs: 1000 });
          await call('/api/mentor', {
            action: 'answer',
            id: q.id,
            choice: -1,
            elapsedMs: 1000,
            reveal: true,
          });
        }
        sessions.push({ id: b.id, prompts });
      }
      assert.equal(new Set(sessions.map((s) => JSON.stringify(s.prompts))).size, 4);
      for (const s of sessions) {
        const finished = await state(s.id);
        assert.deepEqual(
          finished.results.map((q) => ({
            prompt: q.prompt,
            passage: q.passage,
            choices: [...q.choices].sort(),
          })),
          s.prompts,
        );
      }
      const old = sessions.find((s) =>
        lesson === 'analogy'
          ? s.prompts[0].prompt.includes('قلم : كتابة')
          : s.prompts[0].passage.includes('زرع طلاب'),
      );
      assert(old, 'original bank still supported');
      const legacy = await state(old.id);
      assert.equal(
        legacy.results[0].choices[legacy.results[0].answer],
        lesson === 'analogy' ? 'فرشاة : رسم' : 'التعرض للضوء',
      );
      await page.goto('/mentor?view=practice&skill=' + lesson + '&batch=' + sessions[0].id);
      await page.locator('.mentor-results').waitFor();
      await page.screenshot({ path: dir + '/' + lesson + '.png', fullPage: true });
    }
  });
  assert.deepEqual(errors, []);
  await writeFile(
    dir + '/summary.json',
    JSON.stringify({ base, checks, errors, date: new Date().toISOString() }, null, 2),
  );
} catch (e) {
  console.error('FAIL ' + stage + ': ' + e.stack);
  process.exitCode = 1;
  await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
} finally {
  try {
    if (enrolled) await call('/api/account', undefined, 'DELETE');
    if (otherEnrolled) await call('/api/account', undefined, 'DELETE', other.request);
  } finally {
    await browser.close();
  }
}
