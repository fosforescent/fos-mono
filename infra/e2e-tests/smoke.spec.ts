import { test, expect } from '@playwright/test';

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
});