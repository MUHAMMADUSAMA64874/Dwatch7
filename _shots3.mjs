import { chromium } from 'playwright';
const out = 'C:/Users/UsamaPC/AppData/Local/Temp/opencode/shots';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });

await page.goto('http://127.0.0.1:8080/#/dashboard');
await page.waitForTimeout(3200);
await page.screenshot({ path: `${out}/dash3d.png` });

const hasCanvas = await page.locator('.watch3d-canvas').count();
const route = await page.evaluate(() => document.body.dataset.route);
const accent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--accent'));

await page.locator('[data-view="sensors"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/dash3d-sensors.png` });

await page.goto('http://127.0.0.1:8080/#/arcade');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/arcade-amber.png` });
const arcadeAccent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--accent'));

console.log(JSON.stringify({ hasCanvas, route, accent: accent.trim(), arcadeAccent: arcadeAccent.trim(), logs }, null, 2));
await browser.close();
