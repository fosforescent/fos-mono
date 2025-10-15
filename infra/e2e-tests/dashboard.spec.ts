import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Messaging inbox experience', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows inbox layout by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /inbox/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search messages or groups/i)).toBeVisible();
    await expect(page.getByTestId('inbox-refresh')).toBeVisible();
  });

  test('opens navigation menu and lists primary destinations', async ({ page }) => {
    await page.getByLabel('Open navigation menu').click();

    await expect(page.getByRole('link', { name: /inbox/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /groups/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/account/i, { exact: false })).toBeVisible();
  });

  test('navigates to groups directory from the menu', async ({ page }) => {
    await page.getByLabel('Open navigation menu').click();
    await page.getByRole('link', { name: /groups/i }).click();

    await expect(page).toHaveURL(/\/groups/);
    await expect(page.getByRole('heading', { name: /groups & direct messages/i })).toBeVisible();
  });

  test('supports mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.getByLabel('Open navigation menu').click();
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });
});
