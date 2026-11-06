// Playwright test to verify every registered game loads and actually runs
import { test, expect } from '@playwright/test';
import fs from 'fs';

const registry = fs.readFileSync('games/registry.js', 'utf8');
const games = [...registry.matchAll(/file:\s*'([^']+)'/g)].map(m => m[1]);

for (const file of games) {
  test(`game plays: ${file}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('response', res => {
      if (res.status() >= 400) errors.push(`response: ${res.status()} ${res.url()}`);
    });

    await page.goto(`http://127.0.0.1:8080/${file}`);
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Start the run from the engine's ready overlay.
    await page.locator('#wgStart').click();
    await page.waitForTimeout(250);

    // Exercise the shared input model: keyboard, pointer and action key.
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
    }
    await page.mouse.click(520, 360);
    await page.waitForTimeout(700);

    // We must have left the ready screen. A short-lived game may already show
    // its game-over card here, which is valid — the start button must be gone.
    const startButtons = await page.locator('#wgStart').count();
    expect(startButtons, `still on the ready screen in ${file}`).toBe(0);

    expect(errors, `Errors in ${file}:\n${errors.join('\n')}`).toEqual([]);
  });
}
