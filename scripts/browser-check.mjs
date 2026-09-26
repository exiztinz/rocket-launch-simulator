import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from './serve.mjs';

await fs.mkdir('.artifacts', { recursive: true });
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    channel:
      process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.launchAtlasReady, { timeout: 30000 });
  await page.screenshot({ path: '.artifacts/desktop-ready.png', fullPage: true });
  assert.equal(await page.locator('#appError').isVisible(), false);
  assert.equal(
    await page.locator('#sim3dCanvas').evaluate((el) => getComputedStyle(el).touchAction),
    'pan-y'
  );
  assert.ok((await page.locator('#telemetryAcceleration').innerText()).endsWith('m/s\u00b2'));
  assert.ok(!(await page.locator('body').innerText()).includes('m/s?'));

  async function seek(time) {
    await page.locator('#timeline').evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, time);
    await page.waitForTimeout(100);
  }

  for (const preset of ['saturn-v-apollo-11', 'space-shuttle-sts-1', 'falcon-9-starlink']) {
    await page.selectOption('#presetSelect', preset);
    for (const t of [0, 80, 200, 600]) {
      await seek(t);
      assert.match(await page.locator('#telemetryAltitude').innerText(), /\d/);
      await page.screenshot({ path: `.artifacts/${preset}-${t}.png` });
    }
    await page.selectOption('#cameraSelect', 'orbit');
    await page.screenshot({ path: `.artifacts/${preset}-orbit.png` });
    await page.selectOption('#cameraSelect', 'follow');
    await page.click('#resetButton');
    assert.equal(await page.locator('#countdownLabel').innerText(), 'READY');
    assert.equal(await page.locator('#telemetryAirspeed').innerText(), '0 m/s');
  }

  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [320, 568]
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: document.querySelector('#sim3dCanvas').getBoundingClientRect().toJSON(),
      clipped: [...document.querySelectorAll('button,select,.telemetry-item,.chart-card')]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => el.id || el.className)
    }));
    assert.ok(
      dimensions.scrollWidth <= width,
      `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`
    );
    assert.deepEqual(dimensions.clipped, [], `Clipped controls at ${width}`);
    assert.ok(dimensions.canvas.height >= 350);
    await page.screenshot({ path: `.artifacts/layout-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.click('#launchButton');
  await page.waitForTimeout(3600);
  assert.equal(await page.locator('#countdownLabel').innerText(), 'POWERED');
  await page.click('#pauseButton');
  const paused = await page.locator('#timeline').inputValue();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator('#timeline').inputValue(),
    paused,
    'Pause must freeze the flight clock'
  );
  await seek(400);
  await seek(25);
  assert.equal(await page.locator('#missionClock').innerText(), 'T+ 00:25');
  for (const mode of ['ground', 'orbit', 'free', 'follow'])
    await page.selectOption('#cameraSelect', mode);
  for (const quality of ['low', 'high', 'medium'])
    await page.selectOption('#qualitySelect', quality);
  await page.check('#reducedMotionToggle');
  await page.click('#resetButton');
  await page.screenshot({ path: '.artifacts/final-desktop.png', fullPage: true });
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
  console.log(
    'PASS: all missions, playback, scrubbing, camera modes, quality levels, and 6 responsive sizes.'
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
