import { test, expect } from '@playwright/test';

test.describe('Todo Creation', () => {
  test('should authenticate and create todo in inbox', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'auth-test-1-initial.png' });
    
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123';
    
    // First, try logging in with existing seed user
    const loginEmailInput = page.locator('input[type="email"]').or(page.locator('input[placeholder*="email"]'));
    const loginPasswordInput = page.locator('input[type="password"]').first(); // Get first password field
    
    if (await loginEmailInput.isVisible({ timeout: 3000 })) {
      console.log('Found auth form, trying existing seed user first...');
      
      // Try with seed user credentials
      await loginEmailInput.fill('dmn322@fosforescent.com');
      await loginPasswordInput.fill('Dent4567');
      
      const loginButton = page.getByRole('button', { name: /sign in/i }).or(page.getByRole('button', { name: /login/i }));
      if (await loginButton.isVisible({ timeout: 2000 })) {
        await loginButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
      
      // Check if login was successful
      const mainUI = page.locator('nav').or(page.locator('[data-testid="main-app"]')).or(page.locator('button').filter({ hasText: /inbox|queue|settings/i }));
      const loginSuccessful = await mainUI.isVisible({ timeout: 3000 });
      console.log('Seed user login successful:', loginSuccessful);
      
      // If seed user login failed, try registration
      if (!loginSuccessful) {
        console.log('Seed user login failed, trying registration...');
        
        const registerTab = page.getByRole('tab', { name: /register/i });
        if (await registerTab.isVisible({ timeout: 2000 })) {
          await registerTab.click();
          await page.waitForTimeout(1000);
          
          // Fill registration form
          const registerEmail = page.locator('input[type="email"]');
          const registerPassword = page.locator('#register-password').or(page.locator('input[placeholder*="Create a password"]'));
          const confirmPassword = page.locator('#confirm-password').or(page.locator('input[placeholder*="Confirm"]'));
          
          await registerEmail.fill(testEmail);
          await registerPassword.fill(testPassword);
          if (await confirmPassword.isVisible({ timeout: 1000 })) {
            await confirmPassword.fill(testPassword);
          }
          
          // Handle terms checkbox
          const termsCheckbox = page.locator('input[type="checkbox"]').first();
          if (await termsCheckbox.isVisible({ timeout: 2000 })) {
            await termsCheckbox.click({ force: true });
          }
          
          const registerButton = page.getByRole('button', { name: /create account/i }).or(page.getByRole('button', { name: /register/i }));
          if (await registerButton.isVisible({ timeout: 2000 })) {
            await registerButton.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);
          }
        }
      }
    }
    
    // Navigate to Inbox page where todo input should be
    const inboxButton = page.getByRole('button', { name: /inbox/i })
      .or(page.locator('button').filter({ hasText: /inbox/i }))
      .or(page.locator('[href*="inbox"]'))
      .or(page.locator('a').filter({ hasText: /inbox/i }));
    
    if (await inboxButton.isVisible({ timeout: 3000 })) {
      console.log('Found inbox button, clicking...');
      await inboxButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'auth-test-4-inbox-page.png' });
    } else {
      console.log('Inbox button not found, trying to navigate via URL...');
      await page.goto('/inbox');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }
    
    // Now look for todo input - it should be visible if we're authenticated
    // Try different selectors to find the todo input
    const todoInput = page.locator('input[placeholder*="todo"]')
      .or(page.locator('input[placeholder*="Add a new todo"]'))
      .or(page.locator('input[placeholder*="task"]'))
      .or(page.locator('form input[type="text"]'));
    
    console.log('Looking for todo input...');
    const todoInputVisible = await todoInput.isVisible({ timeout: 5000 });
    console.log('Todo input visible:', todoInputVisible);
    
    if (todoInputVisible) {
      // Test creating a todo
      const todoText = 'E2E Test Todo Item';
      await todoInput.fill(todoText);
      
      const submitButton = page.locator('button[type="submit"]')
        .or(page.getByRole('button', { name: /Add Todo/i }))
        .or(page.getByRole('button', { name: /Send/i }));
      
      if (await submitButton.isVisible({ timeout: 2000 })) {
        await submitButton.click();
        
        // Wait for todo to appear
        await page.waitForTimeout(2000);
        
        // Look for the todo in the page
        const todoItem = page.locator('div', { hasText: todoText })
          .or(page.locator('[data-testid*="todo"]', { hasText: todoText }));
        
        await page.screenshot({ path: 'auth-test-4-after-todo-creation.png' });
        
        // Check if todo appears
        const todoVisible = await todoItem.isVisible({ timeout: 3000 });
        console.log('Todo item visible after creation:', todoVisible);
        
        // Debug: log page content to see what's actually there
        const pageContent = await page.locator('body').textContent();
        console.log('Page content after todo creation:', pageContent?.substring(0, 1000));
        
        // Check if our todo text appears anywhere on the page
        const todoTextInPage = pageContent?.includes(todoText);
        console.log(`Does page contain "${todoText}":`, todoTextInPage);
        
        // REQUIRE that the todo appears in the UI - this test should fail if it doesn't
        await expect(todoItem).toBeVisible();
        console.log('SUCCESS: Todo was created and is visible!');
      } else {
        console.log('ERROR: No submit button found');
        await page.screenshot({ path: 'auth-test-error-no-submit.png' });
      }
    } else {
      console.log('ERROR: Todo input not found - authentication may have failed');
      await page.screenshot({ path: 'auth-test-error-no-input.png' });
      
      // Log what's actually on the page
      const pageContent = await page.locator('body').textContent();
      console.log('Page content:', pageContent?.substring(0, 500));
      
      // This test should fail if we can't find the todo input
      await expect(todoInput).toBeVisible();
    }
  });
});