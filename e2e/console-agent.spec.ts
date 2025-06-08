import { test, expect } from '@playwright/test';
import { loginWithTestUser } from './helpers/auth';

test.describe('Console Agent', () => {
  test.beforeEach(async ({ page }) => {
    // Login with a test user before each test
    await loginWithTestUser(page, 'user');
  });

  test('should navigate to Console Agent page', async ({ page }) => {
    // Open the hamburger menu
    await page.getByRole('button', { name: /menu/i }).or(page.locator('[data-testid="hamburger-menu"]')).click();
    
    // Click Console Agent link
    await page.getByRole('link', { name: /console agent/i }).click();
    
    // Should be on the console agent page
    await expect(page).toHaveURL(/\/console/);
    
    // Should see the Console Agent title and description
    await expect(page.getByRole('heading', { name: /console agent/i })).toBeVisible();
    await expect(page.getByText(/AI-powered assistant.*MCP servers/i)).toBeVisible();
  });

  test('should display welcome message', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Should see welcome message when no messages exist
    await expect(page.getByText(/Welcome to Console Agent/i)).toBeVisible();
    await expect(page.getByText(/Ask me to help you with any task/i)).toBeVisible();
  });

  test('should allow user to send a message', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Find the message input textarea
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await expect(messageInput).toBeVisible();
    
    // Type a test message
    const testMessage = 'Read a file from the system';
    await messageInput.fill(testMessage);
    
    // Find and click the send button
    const sendButton = page.getByRole('button', { name: /send/i }).or(page.locator('[data-testid="send-button"]'));
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeEnabled();
    
    // Send the message
    await sendButton.click();
    
    // Should see the user message appear
    await expect(page.getByText(testMessage)).toBeVisible();
    
    // Should see agent thinking message
    await expect(page.getByText(/Analyzing your request.*finding relevant tools/i)).toBeVisible();
  });

  test('should show tool bids for file operations', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Send a message requesting file operations
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await messageInput.fill('I need to read the contents of a configuration file');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();
    
    // Wait for the response to appear
    await page.waitForTimeout(3000);
    
    // Should see available tools section
    await expect(page.getByText(/Available Tools/i)).toBeVisible();
    
    // Should see file-related tools with token costs
    await expect(page.getByText(/read_file/i)).toBeVisible();
    await expect(page.getByText(/File System Tools/i)).toBeVisible();
    
    // Should see token cost badges
    await expect(page.locator('[data-testid="token-cost"]').or(page.getByText(/\d+ tokens?/i)).first()).toBeVisible();
    
    // Should see "Use" buttons for tools
    await expect(page.getByRole('button', { name: /use/i })).toBeVisible();
  });

  test('should execute a tool and show results', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Send a message
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await messageInput.fill('List files in a directory');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();
    
    // Wait for tool bids to appear
    await page.waitForTimeout(3000);
    
    // Click on a "Use" button for a tool
    const useButton = page.getByRole('button', { name: /use/i }).first();
    if (await useButton.isVisible({ timeout: 5000 })) {
      await useButton.click();
      
      // Wait for tool execution
      await page.waitForTimeout(3000);
      
      // Should see execution success message
      await expect(page.getByText(/Successfully executed/i).or(page.getByText(/Task completed/i))).toBeVisible();
      
      // Should see tool result section
      await expect(page.getByText(/Tool Result/i)).toBeVisible();
    }
  });

  test('should display token costs correctly', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Send a message that would trigger expensive tools
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await messageInput.fill('Search the web for information');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should see web search tools with higher token costs
    await expect(page.getByText(/web_search/i)).toBeVisible();
    await expect(page.getByText(/Web Search API/i)).toBeVisible();
    
    // Should show higher token cost for web search (5 tokens according to seed)
    await expect(page.getByText(/5.*tokens?/i)).toBeVisible();
  });

  test('should show chat history with timestamps', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Send first message
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await messageInput.fill('First test message');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();
    
    await page.waitForTimeout(2000);
    
    // Send second message
    await messageInput.fill('Second test message');
    await sendButton.click();
    
    await page.waitForTimeout(2000);
    
    // Should see both messages in chat history
    await expect(page.getByText('First test message')).toBeVisible();
    await expect(page.getByText('Second test message')).toBeVisible();
    
    // Should see timestamps (looking for time pattern like HH:mm:ss)
    await expect(page.locator('text=/\\d{2}:\\d{2}:\\d{2}/')).toBeVisible();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Focus on message input
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await messageInput.click();
    
    // Type a message
    await messageInput.fill('Test message with Enter key');
    
    // Press Enter to send (should work instead of requiring button click)
    await messageInput.press('Enter');
    
    // Should see the message appear
    await expect(page.getByText('Test message with Enter key')).toBeVisible();
    
    // Test Shift+Enter for new line
    await messageInput.fill('Line 1');
    await messageInput.press('Shift+Enter');
    await messageInput.type('Line 2');
    
    // Should see multiline text in input
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('Line 1\nLine 2');
  });
});

test.describe('Console Agent - Admin Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin for admin-specific tests
    await loginWithTestUser(page, 'admin');
  });

  test('admin should have access to expensive tools', async ({ page }) => {
    // Navigate to console agent
    await page.goto('/console');
    
    // Send a message that would trigger database tools (admin-only in seed)
    const messageInput = page.getByPlaceholder(/Describe what you'd like to accomplish/i);
    await messageInput.fill('Execute a database query');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should see database tools available
    await expect(page.getByText(/execute_query/i)).toBeVisible();
    await expect(page.getByText(/Database Tools/i)).toBeVisible();
    
    // Should show high token cost for database operations (10 tokens according to seed)
    await expect(page.getByText(/10.*tokens?/i)).toBeVisible();
  });

  test('admin should have higher token balance', async ({ page }) => {
    // Navigate to tokens page to check balance
    await page.goto('/tokens');
    
    // Should see high token balance for admin (10000 tokens according to seed)
    await expect(page.getByText(/10,?000/)).toBeVisible();
  });
});