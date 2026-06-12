#!/usr/bin/env node
// Full-page website screenshot via puppeteer-core + the locally installed Chrome.
// Handles lazy-loading (auto-scroll) and strips cookie/consent overlays before capture.
//
// Usage:
//   node webshot.js <url> <name> [--out=DIR] [--width=1512] [--no-scroll] [--keep-overlays] [--wait=2500]
//
// Output: <DIR>/<name>_full.png  (DIR defaults to ./captures)
// Prints: "<name> <width>x<height> -> <path>" — use the height to decide splitting
// (see split-image.js; split anything taller than ~8000px before sending to Figma).
//
// Chrome path: autodetected for Windows/macOS/Linux; override with CHROME_PATH env var.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

if (positional.length < 2) {
  console.error('Usage: node webshot.js <url> <name> [--out=DIR] [--width=1512] [--no-scroll] [--keep-overlays] [--wait=ms]');
  process.exit(1);
}

const [url, name] = positional;
const outDir = flags.out || path.join(process.cwd(), 'captures');
const width = parseInt(flags.width || '1512', 10);
const settleMs = parseInt(flags.wait || '2500', 10);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 800;
      const timer = setInterval(() => {
        const before = window.scrollY;
        window.scrollBy(0, step);
        total += step;
        const doc = document.scrollingElement || document.documentElement;
        if (window.scrollY === before || total > 60000 || window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

(async () => {
  const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('Chrome not found - set CHROME_PATH env var to your Chrome/Chromium binary');
  fs.mkdirSync(outDir, { recursive: true });

  const tmp = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--hide-scrollbars', '--user-data-dir=' + path.join(tmp, 'pptrshots')],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
      console.error('goto warning: ' + e.message); // continue - page is often usable anyway
    }
    await new Promise((r) => setTimeout(r, settleMs));
    if (!flags['no-scroll']) {
      await autoScroll(page);
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!flags['keep-overlays']) {
      await page.evaluate(() => {
        const sel = '[class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i], [class*="gdpr" i], [id*="gdpr" i]';
        document.querySelectorAll(sel).forEach((el) => el.remove());
      });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 1200));
    const out = path.join(outDir, name + '_full.png');
    await page.screenshot({ path: out, fullPage: true });
    const dims = await page.evaluate(() => {
      const doc = document.scrollingElement || document.documentElement;
      return doc.scrollHeight;
    });
    console.log(name + ' ' + width + 'x' + dims + ' -> ' + out);
  } finally {
    await browser.close();
  }
})();
