// Playwright test to verify the WristLab Arcade application
import { test, expect } from '@playwright/test';

test('WristLab Arcade loads and shows 20 games', async ({ page }) => {
  // Navigate directly to the arcade route
  await page.goto('http://127.0.0.1:8080/#/arcade');

  // Verify the page title
  expect(await page.title()).toContain('WristLab');

  // Wait for the game cards to render
  await page.waitForSelector('.game-card', { timeout: 10000 });

  // Count game cards
  const gameCards = page.locator('.game-card');
  const count = await gameCards.count();
  expect(count).toBe(20);

  // Verify a few known game cards are present by title text
  await expect(gameCards.nth(0)).toContainText('Neon Serpent');
  await expect(gameCards.nth(1)).toContainText('Pulse Pong');

  // Verify navigation to the dashboard route works
  await page.locator('a[href="#/dashboard"]').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('main')).toBeVisible();
});

test('Hallmark Arcade theme layer is applied to the arcade route', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/#/arcade');
  await page.waitForSelector('.game-card');

  // The theme is scoped to the arcade route, so the route flag must be set.
  await expect(page.locator('body')).toHaveAttribute('data-route', 'arcade');

  // Both Hallmark stylesheets must actually be in the cascade.
  const themeSheets = await page.evaluate(() =>
    [...document.styleSheets]
      .map(sheet => sheet.href || '')
      .filter(href => href.includes('/themes/arcade/'))
  );
  expect(themeSheets.some(href => href.endsWith('tokens.css'))).toBe(true);
  expect(themeSheets.some(href => href.endsWith('arcade.css'))).toBe(true);

  // Display type switches to Bungee and the cards take the 2px cabinet edge.
  const displayFont = await page.locator('.page-head h1').evaluate(el => getComputedStyle(el).fontFamily);
  expect(displayFont.toLowerCase()).toContain('bungee');

  const cardBorder = await page.locator('.game-card').first().evaluate(el => getComputedStyle(el).borderTopWidth);
  expect(cardBorder).toBe('2px');

  const featuredShadow = await page.locator('.featured').evaluate(el => getComputedStyle(el).boxShadow);
  expect(featuredShadow).toContain('8px');

  // The Shell on other routes keeps its Console skin (no Bungee once we leave).
  await page.locator('a[href="#/dashboard"]').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('body')).toHaveAttribute('data-route', 'dashboard');
  const dashboardFont = await page.locator('.screen-title h1').evaluate(el => getComputedStyle(el).fontFamily);
  expect(dashboardFont.toLowerCase()).not.toContain('bungee');
});

test('Does not serve dotfiles or expose CORS', async ({ request }) => {
  const dotfile = await request.get('http://127.0.0.1:8080/.git/config');
  expect(dotfile.status()).toBe(404);

  const encoded = await request.get('http://127.0.0.1:8080/%2egit/config');
  expect(encoded.status()).toBe(404);

  const index = await request.get('http://127.0.0.1:8080/index.html');
  expect(index.headers()['access-control-allow-origin']).toBeUndefined();
});
