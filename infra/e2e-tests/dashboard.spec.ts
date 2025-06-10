import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard Navigation and Core Features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display main dashboard components', async ({ page }) => {
    // Check main dashboard structure
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    
    // Check for navigation elements
    await expect(page.locator('[data-testid="hamburger-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-buttons"]')).toBeVisible();
    
    // Check for main content areas
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });

  test('should navigate between different dashboard views', async ({ page }) => {
    // Test navigation to different views
    const viewButtons = [
      'browse-view',
      'focus-view', 
      'query-view',
      'queue-view',
      'reports-view'
    ];

    for (const viewButton of viewButtons) {
      await page.click(`[data-testid="${viewButton}"]`);
      await expect(page.locator(`[data-testid="${viewButton}-content"]`)).toBeVisible();
    }
  });

  test('should open and navigate hamburger menu', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    
    // Check menu items
    await expect(page.locator('[data-testid="menu-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-account"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-help"]')).toBeVisible();
  });
});

test.describe('MCP Server Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to MCP management
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-mcp-servers"]');
  });

  test('should display MCP server list', async ({ page }) => {
    await expect(page.locator('[data-testid="mcp-server-manager"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-list"]')).toBeVisible();
  });

  test('should open MCP server creation form', async ({ page }) => {
    await page.click('[data-testid="add-mcp-server"]');
    
    await expect(page.locator('[data-testid="mcp-server-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-endpoint-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-public-checkbox"]')).toBeVisible();
  });

  test('should create a new MCP server', async ({ page }) => {
    await page.click('[data-testid="add-mcp-server"]');
    
    // Fill form
    await page.fill('[data-testid="server-name-input"]', 'Test Server');
    await page.fill('[data-testid="server-description-input"]', 'Test description');
    await page.fill('[data-testid="server-endpoint-input"]', 'ws://localhost:3001');
    
    // Check public option
    await page.check('[data-testid="server-public-checkbox"]');
    
    await page.click('[data-testid="save-server-button"]');
    
    // Verify server appears in list
    await expect(page.locator('[data-testid="server-Test Server"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-Test Server"] [data-testid="public-badge"]')).toBeVisible();
  });

  test('should edit existing MCP server', async ({ page }) => {
    // Assume there's at least one server
    await page.click('[data-testid="server-actions"]:first-child');
    await page.click('[data-testid="edit-server"]');
    
    await expect(page.locator('[data-testid="mcp-server-form"]')).toBeVisible();
    
    // Update name
    await page.fill('[data-testid="server-name-input"]', 'Updated Test Server');
    await page.click('[data-testid="save-server-button"]');
    
    // Verify update
    await expect(page.locator('[data-testid="server-Updated Test Server"]')).toBeVisible();
  });
});

test.describe('Console Agent Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to console
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-console"]');
  });

  test('should display console agent interface', async ({ page }) => {
    await expect(page.locator('[data-testid="console-agent"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-mode-selector"]')).toBeVisible();
  });

  test('should switch between agent modes', async ({ page }) => {
    const modes = ['auto', 'confirm', 'prompt'];
    
    for (const mode of modes) {
      await page.click('[data-testid="agent-mode-selector"]');
      await page.click(`[data-testid="mode-${mode}"]`);
      
      await expect(page.locator(`[data-testid="active-mode-${mode}"]`)).toBeVisible();
    }
  });

  test('should send message to agent', async ({ page }) => {
    await page.fill('[data-testid="agent-chat-input"]', 'Hello, can you help me with a task?');
    await page.click('[data-testid="send-message-button"]');
    
    // Wait for response
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 10000 });
  });

  test('should display tool options in prompt mode', async ({ page }) => {
    // Set to prompt mode
    await page.click('[data-testid="agent-mode-selector"]');
    await page.click('[data-testid="mode-prompt"]');
    
    await page.fill('[data-testid="agent-chat-input"]', 'I need to process some data');
    await page.click('[data-testid="send-message-button"]');
    
    // Should show tool options
    await expect(page.locator('[data-testid="tool-options"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tool-option"]:first-child')).toBeVisible();
  });
});

test.describe('Token Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to token management
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tokens"]');
  });

  test('should display token balance and history', async ({ page }) => {
    await expect(page.locator('[data-testid="token-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-history"]')).toBeVisible();
  });

  test('should open token purchase dialog', async ({ page }) => {
    await page.click('[data-testid="purchase-tokens-button"]');
    
    await expect(page.locator('[data-testid="token-purchase-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-amount-selector"]')).toBeVisible();
  });

  test('should display API token management', async ({ page }) => {
    await page.click('[data-testid="api-tokens-tab"]');
    
    await expect(page.locator('[data-testid="api-token-manager"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-api-token"]')).toBeVisible();
  });

  test('should create new API token', async ({ page }) => {
    await page.click('[data-testid="api-tokens-tab"]');
    await page.click('[data-testid="create-api-token"]');
    
    await page.fill('[data-testid="token-name-input"]', 'Test API Token');
    await page.click('[data-testid="create-token-button"]');
    
    // Should show token creation success
    await expect(page.locator('[data-testid="token-created-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-token-value"]')).toBeVisible();
  });
});

test.describe('Tool Usage and Bidding', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to tools section
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tools"]');
  });

  test('should display tool usage history', async ({ page }) => {
    await expect(page.locator('[data-testid="tool-usage-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-table"]')).toBeVisible();
  });

  test('should display tool pricing manager', async ({ page }) => {
    await page.click('[data-testid="pricing-tab"]');
    
    await expect(page.locator('[data-testid="tool-pricing-manager"]')).toBeVisible();
    await expect(page.locator('[data-testid="pricing-table"]')).toBeVisible();
  });

  test('should show bid history', async ({ page }) => {
    await page.click('[data-testid="bids-tab"]');
    
    await expect(page.locator('[data-testid="bid-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="bid-table"]')).toBeVisible();
  });
});

test.describe('Settings and Account Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to settings
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
  });

  test('should display settings tabs', async ({ page }) => {
    await expect(page.locator('[data-testid="settings-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-premium"]')).toBeVisible();
  });

  test('should update email settings', async ({ page }) => {
    await page.click('[data-testid="settings-email"]');
    
    await expect(page.locator('[data-testid="email-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-notifications-toggle"]')).toBeVisible();
    
    // Toggle notifications
    await page.click('[data-testid="email-notifications-toggle"]');
    await page.click('[data-testid="save-email-settings"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
  });

  test('should display subscription management', async ({ page }) => {
    await page.click('[data-testid="settings-premium"]');
    
    await expect(page.locator('[data-testid="subscription-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();
  });

  test('should open subscription upgrade dialog', async ({ page }) => {
    await page.click('[data-testid="settings-premium"]');
    await page.click('[data-testid="upgrade-subscription"]');
    
    await expect(page.locator('[data-testid="subscription-plans"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-options"]')).toBeVisible();
  });
});

test.describe('Admin Dashboard (for admin users)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user - this would need admin credentials
    await login(page, { isAdmin: true });
    // Navigate to admin dashboard
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-admin"]');
  });

  test('should display admin dashboard', async ({ page }) => {
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-user-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-mcp-management"]')).toBeVisible();
  });

  test('should manage user accounts', async ({ page }) => {
    await page.click('[data-testid="admin-user-management"]');
    
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-search"]')).toBeVisible();
  });

  test('should approve pending MCP servers', async ({ page }) => {
    await page.click('[data-testid="admin-mcp-management"]');
    
    await expect(page.locator('[data-testid="pending-servers"]')).toBeVisible();
    
    // Approve a server if any pending
    const firstPending = page.locator('[data-testid="pending-server"]:first-child');
    if (await firstPending.isVisible()) {
      await firstPending.locator('[data-testid="approve-server"]').click();
      await expect(page.locator('[data-testid="server-approved"]')).toBeVisible();
    }
  });
});

test.describe('Responsive Design and Mobile', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    // Check mobile-specific elements
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    
    // Verify responsive layout
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="hamburger-menu"]')).toBeVisible();
  });
});

test.describe('Performance and Loading States', () => {
  test('should handle loading states gracefully', async ({ page }) => {
    await login(page);
    
    // Navigate to a data-heavy section
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tools"]');
    
    // Should show loading state initially
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // Then show content
    await expect(page.locator('[data-testid="tool-usage-history"]')).toBeVisible({ timeout: 10000 });
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await login(page);
    
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tools"]');
    
    // Should show error state
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});