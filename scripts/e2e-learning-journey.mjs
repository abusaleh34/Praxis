import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PRAXIS_TEST_URL ?? 'http://127.0.0.1:3002';
const host = new URL(base).hostname;
if (!['localhost', '127.0.0.1', 'praxis-production-1c78.up.railway.app'].includes(host))
  throw new Error('Unexpected test destination');
const hosted = host.endsWith('.railway.app');
const dir = `test-results/journey-${hosted ? 'hosted' : 'local'}`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let enrolled = false,
  passed = 0,
  stage = 'entry';
async function call(path, data, method) {
  return page.evaluate(
    async ({ path, data, method }) => {
      const r = await fetch(path, {
        method: method ?? (data ? 'POST' : 'GET'),
        headers: data ? { 'Content-Type': 'application/json' } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error}`);
      return body;
    },
    { path, data, method },
  );
}
async function check(name, fn) {
  stage = name;
  await fn();
  passed++;
  console.log('PASS ' + name);
}
const tab = (name) =>
  page.locator('.learning-tabs').getByRole('button', { name, exact: true }).click();
const start = () => page.getByRole('button', { name: 'ابدأ التدريب', exact: true }).click();
const state = () => call('/api/mentor?id=' + new URL(page.url()).searchParams.get('batch'));
try {
  await page.goto('/mentor');
  if (hosted || new URL(page.url()).pathname === '/preview') {
    if (!process.env.PRAXIS_PREVIEW_PASSWORD) throw new Error('Preview credential required');
    await page.locator('input[type=password]').fill(process.env.PRAXIS_PREVIEW_PASSWORD);
    await page.locator('button[type=submit]').click();
  }
  await page.locator('.mentor-lab').waitFor();
  await check(
    'Perimeter interpretation, stale-confirmation reset, and persisted lab values',
    async () => {
      await page.locator('.photo-question summary').click();
      await page.locator('textarea').fill('مستطيل طوله ٨ سم وعرضه ٥ سم، ما محيطه؟');
      await page.getByRole('button', { name: 'راجع نوع السؤال والقيم' }).click();
      assert.equal(await page.locator('.photo-confirm select').inputValue(), 'rectangle-perimeter');
      await page.locator('.photo-confirm input[type=checkbox]').check();
      await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).click();
      await page.getByRole('button', { name: 'التالي', exact: true }).click();
      await page.getByRole('button', { name: 'التالي', exact: true }).click();
      assert((await page.locator('.lab-formula').innerText()).includes('26 سم'));
      await page.reload();
      await page.waitForFunction(() =>
        document.querySelector('.lab-formula')?.textContent.includes('26 سم'),
      );
      await page.locator('.photo-question summary').click();
      assert((await page.locator('textarea').inputValue()).includes('محيطه'));
      await page.locator('textarea').fill('مستطيل طوله ٨ سم وعرضه ٥ سم');
      await page.getByRole('button', { name: 'راجع نوع السؤال والقيم' }).click();
      assert.equal(await page.locator('.photo-confirm select').inputValue(), '');
      assert(await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).isDisabled());
      await page.screenshot({ path: dir + '/perimeter.png', fullPage: true });
    },
  );
  await check('Selected reading lesson survives consent and login', async () => {
    await page.locator('.lesson-picker').getByRole('button', { name: 'لفظي', exact: true }).click();
    await page.locator('.lesson-picker select').selectOption('reading');
    await tab('جرّب');
    await page.getByRole('link', { name: 'ادخل لحفظ محاولاتك' }).click();
    await page.route('**/api/enroll', async (route) => {
      const data = route.request().postDataJSON();
      data.source = 'mentor_e2e';
      await route.continue({ postData: JSON.stringify(data) });
    });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'لنبدأ الرحلة' }).click();
    await page.waitForURL(/\/mentor\?/);
    enrolled = true;
    await page.getByRole('button', { name: 'ابدأ التدريب', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('skill'), 'reading');
    await tab('افهم');
    assert.equal(await page.locator('.lesson-picker select').inputValue(), 'reading');
    assert((await page.locator('.mentor-lab h2').innerText()).includes('استيعاب'));
  });
  await check('Branching hints and transparent correction history', async () => {
    await page.goto('/mentor?skill=circle&view=practice');
    await start();
    await page.getByRole('radiogroup').waitFor();
    for (let i = 0; i < 3; i++) {
      const s = await state(),
        q = s.question,
        n = Number(q.prompt.match(/\d+/)[0]);
      const correct = q.choices.indexOf(String(i === 0 ? n / 2 : i === 1 ? n * 2 : n));
      if (i === 0) {
        await page
          .getByRole('radio')
          .nth((correct + 1) % 4)
          .check();
        await page.getByRole('button', { name: 'تحقق من الإجابة', exact: true }).click();
        await page.getByText('لم تصل بعد. استخدم السؤال الموجّه ثم جرّب خيارًا آخر.').waitFor();
        await page.getByRole('button', { name: 'ساعدني بسؤال' }).click();
        await page
          .locator('.guide-question')
          .getByRole('button', { name: 'في مركز الدائرة', exact: true })
          .click();
        await page.getByText('المطلوب زاوية محيطية؛ رأسها نقطة على الدائرة.').waitFor();
        await page
          .locator('.guide-question')
          .getByRole('button', { name: 'على محيط الدائرة', exact: true })
          .click();
        await page
          .locator('.guide-question')
          .getByRole('button', { name: 'نأخذ نصفه', exact: true })
          .click();
        await page.getByText('صحيح. استخدم ما توصلت إليه لحل السؤال الأصلي.').waitFor();
      }
      await page.getByRole('radio').nth(correct).check();
      await page.getByRole('button', { name: 'تحقق من الإجابة', exact: true }).click();
      await page.getByText('أحسنت، إجابتك صحيحة.').waitFor();
      await page
        .getByRole('button', { name: i === 2 ? 'اعرض النتيجة' : 'السؤال التالي', exact: true })
        .click();
      if (i < 2)
        await page.waitForFunction(
          (i) =>
            document.querySelector('.exercise-meta')?.textContent.includes(`السؤال ${i + 2} من 3`),
          i,
        );
    }
    await page.locator('.mentor-results').waitFor();
    const text = await page.locator('.mentor-results').innerText();
    assert(
      text.includes('2 من 3') && text.includes('محاولتك الأولى') && text.includes('بعد التصحيح'),
    );
    await page.screenshot({ path: dir + '/corrected-answer.png', fullPage: true });
  });
  await check('Dashboard, progress, report and recommendation agree', async () => {
    const o = await call('/api/overview'),
      { report } = await call('/api/report');
    assert.equal(o.completedQuestions, 3);
    assert.equal(o.accuracy, 67);
    assert.equal(o.practiceSessions, 1);
    assert.equal(report.attempts, o.completedQuestions);
    assert.equal(report.accuracy, o.accuracy);
    assert.equal(o.adaptive.recommendation.skill, 'circle');
    assert.equal(o.skills.find((s) => s.id === 'circle').answered, 3);
    for (const route of ['/learn', '/progress']) {
      await page.goto(route);
      await page.locator('.stats-grid').waitFor();
      const values = await page.locator('.stats-grid strong').allTextContents();
      assert.deepEqual(values, ['3', '67%', '1']);
    }
    assert((await page.locator('.history-row').first().innerText()).includes('زوايا الدائرة'));
  });
  await check('Named unfinished session resumes after leaving the mentor', async () => {
    await page.goto('/mentor?skill=analogy&view=practice');
    await start();
    await page.getByRole('radiogroup').waitFor();
    const id = new URL(page.url()).searchParams.get('batch');
    await page.goto('/learn');
    await page.locator('.stats-grid').waitFor();
    await page.goto('/mentor');
    const resume = page.locator('.resume-card');
    await resume.waitFor();
    assert((await resume.innerText()).includes('التناظر اللفظي'));
    await resume.click();
    await page.getByRole('radiogroup').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('batch'), id);
    assert((await page.locator('.exercise h3').first().innerText()).includes('التناظر'));
  });
  await check('Timed navigation, flags, revisable drafts and submission overview', async () => {
    await page.goto('/challenge?mode=exam');
    await start();
    await page.getByRole('radiogroup').waitFor();
    const initial = await state(),
      q = initial.question,
      angles = q.prompt.match(/\d+/g).map(Number);
    const correct = q.choices.indexOf(String(180 - angles[0] - angles[1]));
    await page.getByRole('button', { name: 'علّم للمراجعة', exact: true }).click();
    await page.getByRole('button', { name: 'لا أعرف', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('.exercise-meta')?.textContent.includes('السؤال 2 من 6'),
    );
    await page.locator('.exam-navigation button').first().click();
    await page.waitForFunction(() =>
      document.querySelector('.exercise-meta')?.textContent.includes('السؤال 1 من 6'),
    );
    await page
      .getByRole('radio')
      .nth((correct + 1) % 4)
      .check();
    await page.getByRole('button', { name: 'حفظ والانتقال', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('.exercise-meta')?.textContent.includes('السؤال 2 من 6'),
    );
    await page.locator('.exam-navigation button').first().click();
    await page.waitForFunction(() =>
      document.querySelector('.exercise-meta')?.textContent.includes('السؤال 1 من 6'),
    );
    await page.getByRole('radio').nth(correct).check();
    await page.getByRole('button', { name: 'تسليم وعرض النتيجة', exact: true }).click();
    const summary = page.getByRole('region', { name: 'مراجعة قبل التسليم' });
    await summary.waitFor();
    assert((await summary.innerText()).includes('أجبت عن 1 من 6'));
    assert((await summary.innerText()).includes('للمراجعة: 1'));
    const during = await state();
    assert(!('score' in during));
    const report = (await call('/api/report')).report;
    assert.equal(report.attempts, 3);
    await page.screenshot({ path: dir + '/exam-review.png', fullPage: true });
    await page.getByRole('button', { name: 'تأكيد التسليم', exact: true }).click();
    await page.locator('.mentor-results').waitFor();
    assert((await page.locator('.mentor-results').innerText()).includes('نتيجتك: 1 من 6'));
    const completed = await state();
    assert.equal(completed.results[0].chosen, correct);
    assert.equal((await call('/api/report')).report.attempts, 4);
  });
  await check('Mobile direct practice and moving mathematical explanation', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mentor?skill=triangle&view=learn');
    await page.locator('.proof-player').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const practiceTab = page
      .locator('.learning-tabs')
      .getByRole('button', { name: 'جرّب', exact: true });
    assert((await practiceTab.boundingBox()).y < 700);
    await page.screenshot({ path: dir + '/mobile-before.png', fullPage: true });
    const transforms = await page
      .locator('.moving-angle')
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).transform));
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="جمع الزوايا"]')?.value === '100',
    );
    await page.waitForTimeout(1950);
    const after = await page
      .locator('.moving-angle')
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).transform));
    assert.notDeepEqual(transforms, after);
    await page.screenshot({ path: dir + '/mobile-proof.png', fullPage: true });
    await practiceTab.click();
    assert(
      (await page.getByRole('button', { name: 'ابدأ التدريب', exact: true }).boundingBox()).y < 844,
    );
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: dir + '/mobile-practice.png', fullPage: true });
    assert.deepEqual(errors, []);
  });
  await writeFile(
    dir + '/summary.json',
    JSON.stringify(
      { date: new Date().toISOString(), base, passed, errors, realHttps: hosted },
      null,
      2,
    ),
  );
  console.log(`Completed ${passed} learning journey regression checks.`);
} catch (e) {
  console.error('FAIL ' + stage + ': ' + e.message);
  await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (enrolled) await call('/api/account', undefined, 'DELETE');
  await browser.close();
}
