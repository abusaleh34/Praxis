import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base = process.env.PRAXIS_TEST_URL ?? 'http://127.0.0.1:3002';
const host = new URL(base).hostname;
assert(['localhost', '127.0.0.1', 'praxis-production-1c78.up.railway.app'].includes(host));
const dir = `test-results/review-${host.endsWith('.app') ? 'hosted' : 'local'}`;
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
  stage = 'entry',
  passed = 0;
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
const state = () => call('/api/mentor?id=' + new URL(page.url()).searchParams.get('batch'));
const start = async () => {
  await page.getByRole('button', { name: 'ابدأ التدريب', exact: true }).click();
  await page.getByRole('radiogroup').waitFor();
};
try {
  await page.goto('/mentor?skill=rectangle&view=learn');
  if (new URL(page.url()).pathname === '/preview') {
    assert(process.env.PRAXIS_PREVIEW_PASSWORD, 'Preview credential required');
    await page.locator('input[type=password]').fill(process.env.PRAXIS_PREVIEW_PASSWORD);
    await page.locator('button[type=submit]').click();
  }
  await page.locator('.mentor-lab').waitFor();
  await check('Imported 20×10 perimeter, large and decimal dimensions survive reload', async () => {
    await page.locator('.photo-question summary').click();
    await page.locator('textarea').fill('مستطيل طوله ٢٠ سم وعرضه ١٠ سم، ما محيطه؟');
    await page.getByRole('button', { name: 'راجع نوع السؤال والقيم' }).click();
    await page.locator('.photo-confirm input[type=checkbox]').check();
    await page.getByRole('button', { name: 'افتح الشرح بقيم سؤالي' }).click();
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    assert((await page.locator('.lab-formula').innerText()).includes('60 سم'));
    await page.reload();
    await page.locator('.mentor-lab').waitFor();
    assert((await page.locator('.lab-formula').innerText()).includes('60 سم'));
    for (const [a, b, result] of [
      [1000, 500, 500000],
      [20.5, 10.25, 210.125],
    ]) {
      await page.goto(`/mentor?skill=rectangle&a=${a}&b=${b}&target=area&step=2`);
      await page.locator('.mentor-lab').waitFor();
      assert((await page.locator('.lab-formula').innerText()).includes(String(result)));
      assert((await page.locator('.rectangle-proof rect').count()) < 10, 'bounded grid DOM');
    }
    await page.screenshot({ path: dir + '/dimensions.png', fullPage: true });
  });
  await check('Science instructions and shortcuts match distance and mass', async () => {
    for (const [skill, result, unit] of [
      ['physics', 20, 'متر'],
      ['chemistry', 36, 'غ'],
    ]) {
      await page.goto(`/mentor?skill=${skill}&step=2`);
      await page.locator('.mentor-lab').waitFor();
      assert((await page.locator('.lab-formula').innerText()).includes(`${result} ${unit}`));
      await page.locator('.lesson-outline summary').click();
      assert(
        (await page.locator('.lesson-steps').innerText()).includes('نضرب') ||
          (await page.locator('.lesson-steps').innerText()).includes('اضرب'),
      );
      assert((await page.locator('.fast-strategy').innerText()).includes('اضرب'));
      assert(!(await page.locator('.lesson-steps').innerText()).includes('اقسم'));
    }
    await page.screenshot({ path: dir + '/chemistry.png', fullPage: true });
  });
  await call('/api/enroll', { consent: true, source: 'mentor_e2e' });
  enrolled = true;
  await check('All 15 library skills launch the matching mentor before a pretest', async () => {
    await page.goto('/library');
    await page.locator('.skill-card').first().waitFor();
    const links = await page
      .locator('.skill-card a')
      .evaluateAll((es) => es.map((e) => e.getAttribute('href')));
    assert.equal(links.length, 15);
    for (const href of links) {
      await page.goto('/library');
      await page.locator(`.skill-card a[href="${href}"]`).click();
      await start();
      const s = await state();
      assert.equal(s.question.lesson, new URL(href, base).searchParams.get('skill'));
    }
  });
  await check('Library still opens verbal practice after a completed pretest', async () => {
    const bank = new Map(
      JSON.parse(await readFile('content/questions.json', 'utf8')).map((q) => [q.id, q]),
    );
    const pre = await call('/api/sessions', { kind: 'pre' });
    let s = await call('/api/sessions/' + pre.id);
    while (!s.completed) {
      const q = bank.get(s.question.id);
      await call(`/api/sessions/${pre.id}/answer`, {
        questionId: q.id,
        choice: s.question.choices.indexOf(q.choices[q.answerIndex]),
        elapsedMs: 1500,
      });
      s = await call('/api/sessions/' + pre.id);
    }
    await page.goto('/library');
    await page.locator('.skill-card a[href*="skill=analogy"]').click();
    await start();
    assert.equal((await state()).question.lesson, 'analogy');
  });
  await check(
    'Question timer pauses in learning and review, preserves choice and resumes',
    async () => {
      await page.goto('/mentor?skill=triangle&view=practice');
      await start();
      const before = await state();
      await page.getByRole('radio').first().check();
      await page.waitForTimeout(2200);
      await tab('افهم');
      const elapsed = () =>
        page.evaluate(
          (id) => Number(sessionStorage.getItem('praxis-time:' + id)),
          before.question.id,
        );
      const paused = await elapsed();
      await page.waitForTimeout(3100);
      await tab('راجع');
      await page.locator('.session-history').waitFor();
      assert.equal(await page.getByRole('radiogroup').count(), 0);
      await page.waitForTimeout(1800);
      assert(Math.abs((await elapsed()) - paused) < 100, 'reading/review must not count');
      await tab('جرّب');
      await page.getByRole('radiogroup').waitFor();
      assert(await page.getByRole('radio').first().isChecked());
      await page.waitForTimeout(1600);
      assert((await elapsed()) - paused > 1000, 'resumed solving counts');
      assert.equal((await state()).question.id, before.question.id);
      await page.reload();
      await page.getByRole('radiogroup').waitFor();
      assert((await elapsed()) >= paused, 'reload preserves time');
    },
  );
  let completedId;
  await check(
    'Triangle progression, exterior shortcut and same-route explanation links',
    async () => {
      const bridges = [];
      for (let i = 0; i < 3; i++) {
        const s = await state(),
          q = s.question;
        completedId = s.id;
        bridges.push(await page.locator('.problem-bridge').innerText());
        const ns = q.prompt.match(/\d+/g).map(Number);
        const answer = i === 0 ? 180 - ns[0] - ns[1] : i === 1 ? (180 - ns[0]) / 2 : ns[0] + ns[1];
        await page
          .getByRole('radio')
          .nth(q.choices.indexOf(String(answer)))
          .check();
        await page.getByRole('button', { name: 'تحقق من الإجابة', exact: true }).click();
        await page.getByText('أحسنت، إجابتك صحيحة.').waitFor();
        await page
          .getByRole('button', { name: i === 2 ? 'اعرض النتيجة' : 'السؤال التالي', exact: true })
          .click();
        if (i < 2)
          await page.waitForFunction(
            (i) =>
              document
                .querySelector('.exercise-meta')
                ?.textContent.includes(`السؤال ${i + 2} من 3`),
            i,
          );
      }
      assert.equal(new Set(bridges).size, 3);
      await page.locator('.mentor-results').waitFor();
      const cards = page.locator('.result-card');
      assert((await cards.nth(2).innerText()).includes('المجموع هو الزاوية الخارجية'));
      assert((await cards.nth(1).locator('a').getAttribute('href')).includes('skill=isosceles'));
      const href = await cards.nth(2).locator('a').getAttribute('href');
      await cards.nth(2).locator('a').click();
      await page.locator('.mentor-lab').waitFor();
      assert.equal(new URL(page.url()).searchParams.get('skill'), 'exterior');
      assert.equal(await page.locator('.lesson-picker select').inputValue(), 'exterior');
      assert(await page.locator('.mentor-lab').isVisible());
      // Same skill and same pathname must also react to a changed view.
      await page.goto(`/mentor?skill=triangle&batch=${completedId}&view=practice`);
      await page.locator('.result-card').first().locator('a').click();
      await page.locator('.mentor-lab').waitFor({ state: 'visible' });
      assert(await page.locator('.mentor-lab').isVisible());
      assert.equal(new URL(page.url()).searchParams.get('view'), 'learn');
      await tab('راجع');
      await page.locator('.session-history').waitFor();
      await page.locator(`.session-history a[href*="${completedId}"]`).click();
      await page.locator('.mentor-results').waitFor();
      await page.screenshot({ path: dir + '/triangle-results.png', fullPage: true });
      assert(href.includes('view=learn'));
    },
  );
  await check(
    'Review refreshes after completion and can open another batch in the same lesson',
    async () => {
      await page.getByRole('button', { name: 'تدريب جديد', exact: true }).click();
      await page.getByRole('radiogroup').waitFor();
      const freshId = (await state()).id;
      assert.notEqual(freshId, completedId);
      await tab('راجع');
      await page.locator(`.session-history a[href*="${freshId}"]`).waitFor();
      await page.locator(`.session-history a[href*="${completedId}"]`).click();
      await page.locator('.mentor-results').waitFor();
      assert.equal((await state()).id, completedId);
    },
  );
  await check('Timed mode keeps explanations private and wall-clock deadline running', async () => {
    await page.goto('/challenge?mode=exam');
    await start();
    const before = await state();
    assert(!before.question.bridge && !before.question.fast && !before.question.explanationHref);
    assert.equal(await page.locator('.problem-bridge').count(), 0);
    await page.goto('/mentor?skill=triangle&view=learn');
    await page.waitForTimeout(2100);
    await page.goto(`/challenge?mode=exam&batch=${before.id}`);
    await page.getByRole('radiogroup').waitFor();
    assert.equal((await state()).deadline, before.deadline);
  });
  await check(
    'Mobile review and large drawings fit the viewport without browser errors',
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of [
        '/library',
        '/mentor?skill=rectangle&a=1000&b=500&step=2',
        '/mentor?view=review',
      ]) {
        await page.goto(route);
        await page
          .locator(
            route === '/library'
              ? '.skill-card'
              : route.includes('view=review')
                ? '.session-history'
                : '.mentor-lab',
          )
          .first()
          .waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: dir + '/mobile-review.png', fullPage: true });
    },
  );
  await writeFile(
    dir + '/summary.json',
    JSON.stringify({ base, passed, errors, date: new Date().toISOString() }, null, 2),
  );
} catch (e) {
  console.error('FAIL ' + stage + ': ' + e.stack);
  process.exitCode = 1;
  await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
} finally {
  if (enrolled) await call('/api/account', undefined, 'DELETE');
  await browser.close();
}
