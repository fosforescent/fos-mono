import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/auth';

const TODO_TEST_USER = {
  email: process.env.SMOKE_TEST_EMAIL || 'user1@fosforescent.com',
  password: process.env.SMOKE_TEST_PASSWORD || 'user123',
};

test.describe('Todo Creation', () => {
  test('should authenticate and create todo in inbox', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await loginWithCredentials(page, TODO_TEST_USER.email, TODO_TEST_USER.password);

    // Ensure we are on the inbox page where the todo input lives
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
