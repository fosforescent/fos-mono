import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Messaging actions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/inbox');
  });

  test('composer stays disabled until a conversation is selected', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: /^send$/i });
    await expect(sendButton).toBeDisabled();

    await page.getByLabel('Open navigation menu').click();
    await page.getByRole('link', { name: /groups/i }).click();

    const openButtons = page.getByRole('button', { name: /open in inbox/i });
    if (await openButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await openButtons.first().click();
      await expect(page).toHaveURL(/\/inbox/);
      await expect(sendButton).not.toBeDisabled();
    }
  });

  test('opens settings from navigation menu', async ({ page }) => {
    await page.getByLabel('Open navigation menu').click();
    await page.getByRole('link', { name: /settings/i }).click();

    await expect(page.getByRole('tab', { name: /settings/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /premium/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /password/i })).toBeVisible();
  });
});
