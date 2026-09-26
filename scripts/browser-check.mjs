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
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    window.audioTestContexts = [];
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        this.probe = this.createAnalyser();
        this.probe.fftSize = 2048;
        window.audioTestContexts.push(this);
      }
      createDynamicsCompressor() {
        const node = super.createDynamicsCompressor();
        node.connect(this.probe);
        return node;
      }
    };
  });
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
    for (const t of [0, 80, 200, 550, 600, 680]) {
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
  assert.equal(
    await page.evaluate(() => window.audioTestContexts.length),
    0,
    'No audio before interaction'
  );
  async function audioLevel() {
    return page.evaluate(() => {
      const ctx = window.audioTestContexts[0];
      if (!ctx) return 0;
      const data = new Float32Array(ctx.probe.fftSize);
      ctx.probe.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    });
  }
  await page.click('#launchButton');
  await page.waitForTimeout(3600);
  assert.equal(await page.locator('#countdownLabel').innerText(), 'POWERED');
  assert.ok((await audioLevel()) > 0.001, 'Launch should produce audible output');
  await page.uncheck('#effectsToggle');
  await page.waitForTimeout(700);
  assert.ok((await audioLevel()) > 0.0001, 'Music plays independently of effects');
  await page.uncheck('#musicToggle');
  await page.waitForTimeout(900);
  assert.ok((await audioLevel()) < 0.0001, 'Both toggles mute the output');
  await page.check('#effectsToggle');
  await page.waitForTimeout(400);
  assert.ok((await audioLevel()) > 0.001, 'Engine effects play independently of music');
  await page.check('#musicToggle');
  await page.locator('#volumeControl').fill('0');
  await page.waitForTimeout(900);
  assert.ok((await audioLevel()) < 0.0001, 'Zero volume mutes all audio');
  await page.locator('#volumeControl').fill('55');
  await page.click('#pauseButton');
  const paused = await page.locator('#timeline').inputValue();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator('#timeline').inputValue(),
    paused,
    'Pause must freeze the flight clock'
  );
  assert.ok((await audioLevel()) < 0.0001, 'Pause silences the audio');
  await page.click('#pauseButton');
  await page.waitForTimeout(500);
  assert.ok((await audioLevel()) > 0.001, 'Resume restores audio');
  await seek(400);
  await seek(25);
  await page.waitForTimeout(300);
  assert.ok((await audioLevel()) < 0.0001, 'Scrubbing stays silent');
  assert.equal(await page.locator('#missionClock').innerText(), 'T+ 00:25');
  for (const mode of ['ground', 'orbit', 'free', 'follow'])
    await page.selectOption('#cameraSelect', mode);
  for (const quality of ['low', 'high', 'medium'])
    await page.selectOption('#qualitySelect', quality);
  await page.check('#reducedMotionToggle');
  await page.click('#resetButton');
  await page.click('#launchButton');
  await page.waitForTimeout(120);
  await page.click('#resetButton');
  await page.waitForTimeout(300);
  assert.ok((await audioLevel()) < 0.0001, 'Reset stops countdown and score');
  assert.equal(
    await page.evaluate(() => window.audioTestContexts.length),
    1,
    'Replay reuses one audio context'
  );
  await page.screenshot({ path: '.artifacts/final-desktop.png', fullPage: true });
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
  console.log(
    'PASS: all missions, playback, audio output and controls, scrubbing, camera modes, quality levels, and 6 responsive sizes.'
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
