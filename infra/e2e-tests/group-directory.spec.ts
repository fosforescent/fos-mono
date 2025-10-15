import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Group directory experience', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/groups');
  });

  test('renders my conversations and public groups sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /groups & direct messages/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /my conversations/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /public groups/i })).toBeVisible();
  });

  test('searches for users to start a direct message', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search users by name/i);
    await searchInput.fill('Alice');
    await page.waitForTimeout(1000);

    const startButtons = page.getByRole('button', { name: /start dm/i });
    await expect(startButtons.first()).toBeVisible();
  });
});
