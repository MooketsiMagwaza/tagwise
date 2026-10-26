// Captures real screenshots of the running app, in light and dark, for the
// public page and the README. Uses the Microsoft Edge (or Chrome) already
// installed on the machine through playwright-core; nothing is downloaded.
//
//   npm run dev                       # in one terminal
//   npm run screenshots               # in another (BASE_URL defaults to :5280)
//   npm run screenshots -- scan,count # only some of them
//
// Each capture is written twice: <name>-<theme>.webp for the public page
// (smaller) and <name>-<theme>.jpg for the README and the docs site's
// mirror. Desktop captures are 1440 x 900; phone captures are 390 x 844 at
// 2x (780 x 1688 pixels). Every capture starts from a fresh browser
// profile, so it shows the seeded sample workspace. The public page's own
// captures come last, because its hero shows the app captures above.

import { chromium } from 'playwright-core';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5280';
const OUT = 'public/screens';
const CHANNEL = process.env.BROWSER_CHANNEL ?? 'msedge';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** name, path, viewport, and an optional step to run before the capture. */
const SHOTS = [
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
  {
    name: 'sites',
    path: '/app/sites',
    size: 'desktop',
    settle: 2000,
    // The basemap loads over the network; wait until the map says it is done.
    before: async (page) => {
      await page.waitForFunction(() => !document.body.innerText.includes('Loading the map'), null, { timeout: 25000 }).catch(() => {});
    },
  },
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
  { name: 'landing', path: '/', size: 'desktop', settle: 1500 },
  { name: 'phone-landing', path: '/', size: 'phone', settle: 1500 },
];

const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
// Quality chosen so every file stays under about 150 KB.
const QUALITY = { desktop: { webp: 80, jpeg: 80 }, phone: { webp: 72, jpeg: 68 } };

/** Runs in the page: re-encodes a base64 PNG with the browser's encoders. */
/* global atob, btoa, Blob, createImageBitmap, OffscreenCanvas */
async function encode({ b64, type, quality }) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const out = new Uint8Array(await (await canvas.convertToBlob({ type, quality })).arrayBuffer());
  let s = '';
  for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(s);
}

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
    // Playwright's PNG honours the 2x phone pixel ratio (a raw DevTools
    // capture does not); the browser then encodes it as WebP and JPEG.
    const png = (await page.screenshot({ type: 'png' })).toString('base64');
    const sizes = [];
    for (const [type, ext, key] of [['image/webp', 'webp', 'webp'], ['image/jpeg', 'jpg', 'jpeg']]) {
      const data = await page.evaluate(encode, { b64: png, type, quality: QUALITY[shot.size][key] / 100 });
      const file = `${OUT}/${shot.name}-${theme}.${ext}`;
      writeFileSync(file, Buffer.from(data, 'base64'));
      sizes.push(`${ext} ${Math.round(statSync(file).size / 1024)} KB`);
    }
    await context.close();
    count += 1;
    console.log('saved', `${OUT}/${shot.name}-${theme}`, sizes.join(', '));
  }
}
await browser.close();
console.log(`${count} screenshots (WebP and JPEG) in ${OUT}`);
