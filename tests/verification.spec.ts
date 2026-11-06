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
