import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: process.env.SMOKE_TEST_EMAIL || 'user1@fosforescent.com',
  password: process.env.SMOKE_TEST_PASSWORD || 'user123',
  name: 'Test User'
};

test.describe('Application Smoke Tests', () => {
  test('should load the application without errors', async ({ page }) => {
    await page.goto('/');

    // Basic smoke test - app loads and shows title
    await expect(page).toHaveTitle(/fosforescent/);

    // Check that the main app loads without errors
    await expect(page.locator('body')).toBeVisible();

    // Should show either login form or main app interface
    const loginForm = page.locator('input[type="email"]');
    const appInterface = page.locator('nav').or(page.locator('[data-testid="main-app"]'));

    const hasLoginOrApp = await loginForm.isVisible() || await appInterface.isVisible();
    expect(hasLoginOrApp).toBe(true);
  });

  test('should ensure test user exists and can login', async ({ page }) => {
    await page.goto('/');

    // Try to login with test credentials
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.waitForTimeout(500);

    await page.fill('#login-email', TEST_USER.email);
    await page.fill('#login-password', TEST_USER.password);

    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Check if login was successful (auth heading should disappear)
    const authHeadingStillVisible = await page.getByRole('heading', { name: 'Fosforescent', exact: true }).isVisible({ timeout: 1000 }).catch(() => false);

    if (authHeadingStillVisible) {
      // Login failed, user doesn't exist - register them
      console.log('Test user does not exist, registering...');

      await page.goto('/');
      await page.getByRole('tab', { name: /register/i }).click();
      await page.waitForTimeout(500);

      await page.fill('#register-email', TEST_USER.email);
      await page.fill('#register-password', TEST_USER.password);
      await page.fill('#confirm-password', TEST_USER.password);

      // Accept terms
      await page.locator('#accept-terms').check();

      // Submit registration
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForTimeout(3000);

      // Verify registration successful - should be logged in now
      await expect(page.getByRole('heading', { name: 'Fosforescent', exact: true })).not.toBeVisible();

      console.log('✅ Test user registered successfully');
    } else {
      console.log('✅ Test user login successful');
    }
  });
});