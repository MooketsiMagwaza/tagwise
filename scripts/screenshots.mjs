// Captures real screenshots of the running app, in light and dark, for the
// landing page and the README. Uses the Microsoft Edge (or Chrome) already
// installed on the machine through playwright-core; nothing is downloaded.
//
//   npm run dev                       # in one terminal
//   npm run screenshots               # in another (BASE_URL defaults to :5280)
//
// Every capture starts from a fresh browser profile, so it shows the
// seeded sample workspace.

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5280';
const OUT = 'public/screens';
const CHANNEL = process.env.BROWSER_CHANNEL ?? 'msedge';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** name, path, viewport, and an optional step to run before the capture. */
const SHOTS = [
  { name: 'landing', path: '/', size: 'desktop', settle: 1500 },
  { name: 'phone-landing', path: '/', size: 'phone', settle: 1500 },
  { name: 'dashboard', path: '/app', size: 'desktop' },
  { name: 'register', path: '/app/assets', size: 'desktop' },
  { name: 'asset', path: '/app/assets/MCT-00040', size: 'desktop' },
  {
    name: 'scan',
    path: '/app/scan',
    size: 'desktop',
    before: async (page) => {
      await page.getByRole('button', { name: /MCT-00001 \(asset\)/ }).click();
      await wait(400);
    },
  },
  {
    name: 'import',
    path: '/app/import',
    size: 'desktop',
    before: async (page) => {
      await page.getByRole('button', { name: 'Use the practice register' }).click();
      await page.getByRole('button', { name: 'Check the rows' }).click({ timeout: 20000 });
      await page.getByRole('button', { name: /^Problems/ }).click();
      await wait(300);
    },
  },
  { name: 'count', path: '/app/counts/count-mochudi-t3', size: 'desktop' },
  { name: 'sites', path: '/app/sites', size: 'desktop', settle: 6000 },
  { name: 'labels', path: '/app/labels?ids=MCT-00001,MCT-00002,MCT-00003,MCT-00004,MCT-00005,MCT-00006,MCT-00007', size: 'desktop' },
  { name: 'people', path: '/app/settings/people', size: 'desktop' },
  { name: 'phone-home', path: '/app', size: 'phone' },
  { name: 'phone-register', path: '/app/assets', size: 'phone' },
  {
    name: 'phone-scan',
    path: '/app/scan',
    size: 'phone',
    keepScroll: true,
    before: async (page) => {
      await page.getByRole('button', { name: /MCT-00002 \(asset\)/ }).click();
      await wait(300);
    },
  },
];

const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// Software WebGL, so the map draws in a headless browser.
const browser = await chromium.launch({ channel: CHANNEL, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
let count = 0;
for (const theme of ['light', 'dark']) {
  for (const shot of SHOTS.filter((x) => !ONLY || ONLY.includes(x.name))) {
    const context = await browser.newContext({ ...SIZES[shot.size], colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript((t) => {
      localStorage.setItem('tagwise.appearance', JSON.stringify({ theme: t, density: 'comfortable', motion: 'reduce' }));
    }, theme);
    const page = await context.newPage();
    await page.goto(BASE + shot.path, { waitUntil: 'networkidle' });
    await page.waitForSelector('main, h1', { timeout: 20000 });
    await wait(1200);
    if (shot.before) await shot.before(page);
    if (shot.settle) await wait(shot.settle);
    if (!shot.keepScroll) await page.evaluate(() => window.scrollTo(0, 0));
    await wait(200);
    const file = `${OUT}/${shot.name}-${theme}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    await context.close();
    count += 1;
    console.log('saved', file);
  }
}
await browser.close();
console.log(`${count} screenshots in ${OUT}`);
