import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    await expect(page).toHaveTitle(/fosforescent/);
    
    // Check for main heading (use exact match to avoid conflicts)
    await expect(page.getByRole('heading', { name: 'Fosforescent', exact: true })).toBeVisible();
    
    // Click on Sign In tab to show login form
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.waitForTimeout(500);
    
    // Should show login form after clicking Sign In tab
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('should show registration form', async ({ page }) => {
    // Click on register tab
    await page.getByRole('tab', { name: /register/i }).click();
    
    // Check that register form elements are visible
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
    await expect(page.locator('#confirm-password')).toBeVisible();
    await expect(page.locator('#accept-terms')).toBeVisible();
  });

  test('should validate required fields on registration', async ({ page }) => {
    // Click on register tab
    await page.getByRole('tab', { name: /register/i }).click();
    
    // Try to submit without filling required fields
    const submitButton = page.getByRole('button', { name: /create account/i });
    await submitButton.click();
    
    // Form should still be visible (HTML5 validation prevents submission)
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
  });

  test('should navigate between login and registration', async ({ page }) => {
    // Click on Sign In tab first
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.waitForTimeout(500);
    
    // Should show login form
    await expect(page.locator('#login-email')).toBeVisible();
    
    // Click on register tab
    await page.getByRole('tab', { name: /register/i }).click();
    await expect(page.locator('#register-email')).toBeVisible();
    
    // Click back to login tab
    await page.getByRole('tab', { name: /sign in/i }).click();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('should show forgot password flow', async ({ page }) => {
    // Click on Sign In tab first
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.waitForTimeout(500);
    
    // Look for forgot password button
    const forgotPasswordButton = page.getByRole('button', { name: /forgot.*password/i });
    await expect(forgotPasswordButton).toBeVisible();
    
    // Click it (this might show a modal or navigate)
    await forgotPasswordButton.click();
    
    // For now, just verify the button exists and is clickable
    // Actual behavior depends on implementation
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Click on Sign In tab first
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.waitForTimeout(500);
    
    // Fill in the login form with test user credentials
    await page.fill('#login-email', 'user1@fosforescent.com');
    await page.fill('#login-password', 'user123');
    
    // Submit the form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect/refresh to authenticated state
    // Wait for page to load and check for authenticated UI elements
    await page.waitForTimeout(3000); // Give time for login to process
    
    // Check if we're now authenticated - the AuthLanding should be gone
    // and we should see the main app interface instead
    await expect(page.getByRole('heading', { name: 'Fosforescent', exact: true })).not.toBeVisible();
    
    // Or check for toast success message
    // await expect(page.getByText(/welcome/i)).toBeVisible();
  });
});