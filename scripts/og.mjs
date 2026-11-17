// Renders scripts/og.html to the portal's 1200x630 share banner (JPEG).
// Uses the Playwright install of apps/applytrack, so the portal itself needs no node_modules:
//   node apps/portal/scripts/og.mjs apps/portal/site/img/og-YYYYMMDD.jpg   (run from the project root)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../applytrack/package.json'));
const { chromium } = require('@playwright/test');

const out = resolve(process.argv[2] || join(here, '../site/img/og.jpg'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(here, 'og.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
await browser.close();
console.log('wrote', out);
