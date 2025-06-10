# Test info

- Name: Todo Creation >> should authenticate and create todo in inbox
- Location: /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/todo-creation.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

    at /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/todo-creation.spec.ts:5:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Todo Creation', () => {
   4 |   test('should authenticate and create todo in inbox', async ({ page }) => {
>  5 |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
   6 |     await page.waitForLoadState('networkidle');
   7 |     
   8 |     // Take screenshot of initial state
   9 |     await page.screenshot({ path: 'auth-test-1-initial.png' });
   10 |     
   11 |     const testEmail = `test-${Date.now()}@example.com`;
   12 |     const testPassword = 'TestPassword123';
   13 |     
   14 |     // First, try logging in with existing seed user
   15 |     const loginEmailInput = page.locator('input[type="email"]').or(page.locator('input[placeholder*="email"]'));
   16 |     const loginPasswordInput = page.locator('input[type="password"]').first(); // Get first password field
   17 |     
   18 |     if (await loginEmailInput.isVisible({ timeout: 3000 })) {
   19 |       console.log('Found auth form, trying existing seed user first...');
   20 |       
   21 |       // Try with seed user credentials
   22 |       await loginEmailInput.fill('dmn322@fosforescent.com');
   23 |       await loginPasswordInput.fill('Dent4567');
   24 |       
   25 |       const loginButton = page.getByRole('button', { name: /sign in/i }).or(page.getByRole('button', { name: /login/i }));
   26 |       if (await loginButton.isVisible({ timeout: 2000 })) {
   27 |         await loginButton.click();
   28 |         await page.waitForLoadState('networkidle');
   29 |         await page.waitForTimeout(2000);
   30 |       }
   31 |       
   32 |       // Check if login was successful
   33 |       const mainUI = page.locator('nav').or(page.locator('[data-testid="main-app"]')).or(page.locator('button').filter({ hasText: /inbox|queue|settings/i }));
   34 |       const loginSuccessful = await mainUI.isVisible({ timeout: 3000 });
   35 |       console.log('Seed user login successful:', loginSuccessful);
   36 |       
   37 |       // If seed user login failed, try registration
   38 |       if (!loginSuccessful) {
   39 |         console.log('Seed user login failed, trying registration...');
   40 |         
   41 |         const registerTab = page.getByRole('tab', { name: /register/i });
   42 |         if (await registerTab.isVisible({ timeout: 2000 })) {
   43 |           await registerTab.click();
   44 |           await page.waitForTimeout(1000);
   45 |           
   46 |           // Fill registration form
   47 |           const registerEmail = page.locator('input[type="email"]');
   48 |           const registerPassword = page.locator('#register-password').or(page.locator('input[placeholder*="Create a password"]'));
   49 |           const confirmPassword = page.locator('#confirm-password').or(page.locator('input[placeholder*="Confirm"]'));
   50 |           
   51 |           await registerEmail.fill(testEmail);
   52 |           await registerPassword.fill(testPassword);
   53 |           if (await confirmPassword.isVisible({ timeout: 1000 })) {
   54 |             await confirmPassword.fill(testPassword);
   55 |           }
   56 |           
   57 |           // Handle terms checkbox
   58 |           const termsCheckbox = page.locator('input[type="checkbox"]').first();
   59 |           if (await termsCheckbox.isVisible({ timeout: 2000 })) {
   60 |             await termsCheckbox.click({ force: true });
   61 |           }
   62 |           
   63 |           const registerButton = page.getByRole('button', { name: /create account/i }).or(page.getByRole('button', { name: /register/i }));
   64 |           if (await registerButton.isVisible({ timeout: 2000 })) {
   65 |             await registerButton.click();
   66 |             await page.waitForLoadState('networkidle');
   67 |             await page.waitForTimeout(3000);
   68 |           }
   69 |         }
   70 |       }
   71 |     }
   72 |     
   73 |     // Navigate to Inbox page where todo input should be
   74 |     const inboxButton = page.getByRole('button', { name: /inbox/i })
   75 |       .or(page.locator('button').filter({ hasText: /inbox/i }))
   76 |       .or(page.locator('[href*="inbox"]'))
   77 |       .or(page.locator('a').filter({ hasText: /inbox/i }));
   78 |     
   79 |     if (await inboxButton.isVisible({ timeout: 3000 })) {
   80 |       console.log('Found inbox button, clicking...');
   81 |       await inboxButton.click();
   82 |       await page.waitForLoadState('networkidle');
   83 |       await page.waitForTimeout(1000);
   84 |       await page.screenshot({ path: 'auth-test-4-inbox-page.png' });
   85 |     } else {
   86 |       console.log('Inbox button not found, trying to navigate via URL...');
   87 |       await page.goto('/inbox');
   88 |       await page.waitForLoadState('networkidle');
   89 |       await page.waitForTimeout(1000);
   90 |     }
   91 |     
   92 |     // Now look for todo input - it should be visible if we're authenticated
   93 |     // Try different selectors to find the todo input
   94 |     const todoInput = page.locator('input[placeholder*="todo"]')
   95 |       .or(page.locator('input[placeholder*="Add a new todo"]'))
   96 |       .or(page.locator('input[placeholder*="task"]'))
   97 |       .or(page.locator('form input[type="text"]'));
   98 |     
   99 |     console.log('Looking for todo input...');
  100 |     const todoInputVisible = await todoInput.isVisible({ timeout: 5000 });
  101 |     console.log('Todo input visible:', todoInputVisible);
  102 |     
  103 |     if (todoInputVisible) {
  104 |       // Test creating a todo
  105 |       const todoText = 'E2E Test Todo Item';
```