# Test info

- Name: Authentication Flow >> should validate required fields on registration
- Location: /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/auth.spec.ts:30:7

# Error details

```
Error: page.goto: Could not connect to localhost: Connection refused
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

    at /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/auth.spec.ts:5:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Authentication Flow', () => {
   4 |   test.beforeEach(async ({ page }) => {
>  5 |     await page.goto('/');
     |                ^ Error: page.goto: Could not connect to localhost: Connection refused
   6 |   });
   7 |
   8 |   test('should display login form when not authenticated', async ({ page }) => {
   9 |     await expect(page).toHaveTitle(/fosforescent/);
  10 |     
  11 |     // Check for main heading (use exact match to avoid conflicts)
  12 |     await expect(page.getByRole('heading', { name: 'Fosforescent', exact: true })).toBeVisible();
  13 |     
  14 |     // Should be on login tab by default
  15 |     await expect(page.locator('#username')).toBeVisible();
  16 |     await expect(page.locator('#password')).toBeVisible();
  17 |   });
  18 |
  19 |   test('should show registration form', async ({ page }) => {
  20 |     // Click on register tab
  21 |     await page.getByRole('tab', { name: /register/i }).click();
  22 |     
  23 |     // Check that register form elements are visible
  24 |     await expect(page.locator('#register-email')).toBeVisible();
  25 |     await expect(page.locator('#register-password')).toBeVisible();
  26 |     await expect(page.locator('#confirm-password')).toBeVisible();
  27 |     await expect(page.locator('#accept-terms')).toBeVisible();
  28 |   });
  29 |
  30 |   test('should validate required fields on registration', async ({ page }) => {
  31 |     // Click on register tab
  32 |     await page.getByRole('tab', { name: /register/i }).click();
  33 |     
  34 |     // Try to submit without filling required fields
  35 |     const submitButton = page.getByRole('button', { name: /create account/i });
  36 |     await submitButton.click();
  37 |     
  38 |     // Form should still be visible (HTML5 validation prevents submission)
  39 |     await expect(page.locator('#register-email')).toBeVisible();
  40 |     await expect(page.locator('#register-password')).toBeVisible();
  41 |   });
  42 |
  43 |   test('should navigate between login and registration', async ({ page }) => {
  44 |     // Should start on login tab
  45 |     await expect(page.locator('#username')).toBeVisible();
  46 |     
  47 |     // Click on register tab
  48 |     await page.getByRole('tab', { name: /register/i }).click();
  49 |     await expect(page.locator('#register-email')).toBeVisible();
  50 |     
  51 |     // Click back to login tab
  52 |     await page.getByRole('tab', { name: /sign in/i }).click();
  53 |     await expect(page.locator('#username')).toBeVisible();
  54 |     await expect(page.locator('#password')).toBeVisible();
  55 |   });
  56 |
  57 |   test('should show forgot password flow', async ({ page }) => {
  58 |     // Should be on login tab by default, look for forgot password button
  59 |     const forgotPasswordButton = page.getByRole('button', { name: /forgot.*password/i });
  60 |     await expect(forgotPasswordButton).toBeVisible();
  61 |     
  62 |     // Click it (this might show a modal or navigate)
  63 |     await forgotPasswordButton.click();
  64 |     
  65 |     // For now, just verify the button exists and is clickable
  66 |     // Actual behavior depends on implementation
  67 |   });
  68 |
  69 |   test('should successfully login with valid credentials', async ({ page }) => {
  70 |     // Fill in the login form with test user credentials
  71 |     await page.fill('#username', 'user1@fosforescent.com');
  72 |     await page.fill('#password', 'user123');
  73 |     
  74 |     // Submit the form
  75 |     await page.getByRole('button', { name: /sign in/i }).click();
  76 |     
  77 |     // Should redirect/refresh to authenticated state
  78 |     // Wait for page to load and check for authenticated UI elements
  79 |     await page.waitForTimeout(3000); // Give time for login to process
  80 |     
  81 |     // Check if we're now authenticated - the AuthLanding should be gone
  82 |     // and we should see the main app interface instead
  83 |     await expect(page.getByRole('heading', { name: 'Fosforescent', exact: true })).not.toBeVisible();
  84 |     
  85 |     // Or check for toast success message
  86 |     // await expect(page.getByText(/welcome/i)).toBeVisible();
  87 |   });
  88 | });
```