import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Subscription and Billing Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display subscription dashboard', async ({ page }) => {
    // Navigate to subscription settings
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');

    await expect(page.locator('[data-testid="subscription-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-info"]')).toBeVisible();
  });

  test('should show available subscription plans', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');
    
    await page.click('[data-testid="upgrade-subscription"]');
    
    await expect(page.locator('[data-testid="subscription-plans"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-basic"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-pro"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-enterprise"]')).toBeVisible();
  });

  test('should handle subscription upgrade flow', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');
    
    await page.click('[data-testid="upgrade-subscription"]');
    await page.click('[data-testid="select-plan-pro"]');
    
    // Should redirect to Stripe checkout or show payment form
    await expect(page.locator('[data-testid="checkout-form"]').or(
      page.locator('[data-testid="stripe-checkout"]')
    )).toBeVisible({ timeout: 10000 });
  });

  test('should display token balance and purchase options', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tokens"]');
    
    await expect(page.locator('[data-testid="token-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-balance-amount"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="purchase-tokens-button"]')).toBeVisible();
  });

  test('should open token purchase dialog', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tokens"]');
    await page.click('[data-testid="purchase-tokens-button"]');
    
    await expect(page.locator('[data-testid="token-purchase-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-amount-100"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-amount-500"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-amount-1000"]')).toBeVisible();
  });

  test('should show token pricing and proceed to checkout', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tokens"]');
    await page.click('[data-testid="purchase-tokens-button"]');
    
    // Select token amount
    await page.click('[data-testid="token-amount-500"]');
    
    // Should show pricing
    await expect(page.locator('[data-testid="token-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-cost"]')).toContainText(/\$\d+/);
    
    await page.click('[data-testid="proceed-to-checkout"]');
    
    // Should redirect to Stripe checkout
    await expect(page.locator('[data-testid="stripe-checkout"]').or(
      page.locator('[data-testid="payment-form"]')
    )).toBeVisible({ timeout: 10000 });
  });

  test('should display token usage history', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tokens"]');
    await page.click('[data-testid="usage-history-tab"]');
    
    await expect(page.locator('[data-testid="token-usage-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-table"]')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('[data-testid="usage-table"] th:has-text("Date")')).toBeVisible();
    await expect(page.locator('[data-testid="usage-table"] th:has-text("Tool")')).toBeVisible();
    await expect(page.locator('[data-testid="usage-table"] th:has-text("Tokens Used")')).toBeVisible();
    await expect(page.locator('[data-testid="usage-table"] th:has-text("Cost")')).toBeVisible();
  });

  test('should filter token usage by date range', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tokens"]');
    await page.click('[data-testid="usage-history-tab"]');
    
    // Apply date filter
    await page.click('[data-testid="date-filter"]');
    await page.click('[data-testid="filter-last-30-days"]');
    
    // Table should update
    await expect(page.locator('[data-testid="usage-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-applied"]')).toBeVisible();
  });

  test('should display billing history', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');
    await page.click('[data-testid="billing-history-tab"]');
    
    await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-table"]')).toBeVisible();
    
    // Check for billing entries or empty state
    const hasEntries = await page.locator('[data-testid="billing-entry"]').count();
    if (hasEntries > 0) {
      await expect(page.locator('[data-testid="billing-entry"]:first-child')).toBeVisible();
      await expect(page.locator('[data-testid="billing-amount"]')).toBeVisible();
      await expect(page.locator('[data-testid="billing-date"]')).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="no-billing-history"]')).toBeVisible();
    }
  });

  test('should handle subscription cancellation', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');
    
    // Only test if user has an active subscription
    const hasCancelButton = await page.locator('[data-testid="cancel-subscription"]').isVisible();
    
    if (hasCancelButton) {
      await page.click('[data-testid="cancel-subscription"]');
      
      // Should show confirmation dialog
      await expect(page.locator('[data-testid="cancel-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-warning"]')).toBeVisible();
      
      // Test the confirmation flow (but don't actually cancel)
      await expect(page.locator('[data-testid="confirm-cancel"]')).toBeVisible();
      await expect(page.locator('[data-testid="keep-subscription"]')).toBeVisible();
      
      // Click keep subscription to avoid actually canceling
      await page.click('[data-testid="keep-subscription"]');
      
      // Dialog should close
      await expect(page.locator('[data-testid="cancel-confirmation"]')).not.toBeVisible();
    }
  });

  test('should show payment method management', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');
    await page.click('[data-testid="payment-methods-tab"]');
    
    await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
    await expect(page.locator('[data-testid="add-payment-method"]')).toBeVisible();
    
    // Check for existing payment methods or empty state
    const hasPaymentMethods = await page.locator('[data-testid="payment-method"]').count();
    if (hasPaymentMethods > 0) {
      await expect(page.locator('[data-testid="payment-method"]:first-child')).toBeVisible();
      await expect(page.locator('[data-testid="payment-method-type"]')).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="no-payment-methods"]')).toBeVisible();
    }
  });

  test('should handle webhook event simulation (dev mode)', async ({ page }) => {
    // This test is for development/testing environments only
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    if (!isDev) {
      test.skip();
      return;
    }
    
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-settings"]');
    await page.click('[data-testid="settings-premium"]');
    
    // Look for dev testing tools
    const hasDevTools = await page.locator('[data-testid="dev-webhook-tools"]').isVisible();
    
    if (hasDevTools) {
      await page.click('[data-testid="dev-webhook-tools"]');
      
      // Test subscription webhook simulation
      await page.click('[data-testid="simulate-subscription-success"]');
      
      // Should show success notification
      await expect(page.locator('[data-testid="webhook-simulation-success"]')).toBeVisible();
      
      // Subscription status should update
      await expect(page.locator('[data-testid="subscription-status"]')).toContainText(/active|pro/i);
    }
  });
});

test.describe('Tool Pricing and Billing Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should show tool costs before execution', async ({ page }) => {
    // Navigate to console agent
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-console"]');
    
    // Set to prompt mode to see pricing
    await page.click('[data-testid="agent-mode-selector"]');
    await page.click('[data-testid="mode-prompt"]');
    
    await page.fill('[data-testid="agent-chat-input"]', 'Help me analyze some data');
    await page.click('[data-testid="send-message-button"]');
    
    // Should show tool options with pricing
    await expect(page.locator('[data-testid="tool-options"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tool-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-required"]')).toBeVisible();
  });

  test('should handle insufficient tokens gracefully', async ({ page }) => {
    // This test assumes the user has very low token balance
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-console"]');
    
    await page.fill('[data-testid="agent-chat-input"]', 'Run an expensive AI analysis');
    await page.click('[data-testid="send-message-button"]');
    
    // If insufficient tokens, should show purchase prompt
    const hasInsufficientTokens = await page.locator('[data-testid="insufficient-tokens"]').isVisible({ timeout: 5000 });
    
    if (hasInsufficientTokens) {
      await expect(page.locator('[data-testid="purchase-more-tokens"]')).toBeVisible();
      
      await page.click('[data-testid="purchase-more-tokens"]');
      
      // Should open token purchase dialog
      await expect(page.locator('[data-testid="token-purchase-dialog"]')).toBeVisible();
    }
  });

  test('should track tool usage costs', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tools"]');
    
    await expect(page.locator('[data-testid="tool-usage-history"]')).toBeVisible();
    
    // Check if there are usage entries
    const hasUsage = await page.locator('[data-testid="usage-entry"]').count();
    
    if (hasUsage > 0) {
      // Verify cost tracking
      await expect(page.locator('[data-testid="usage-cost"]')).toBeVisible();
      await expect(page.locator('[data-testid="tokens-consumed"]')).toBeVisible();
      
      // Check cost calculation
      const totalCost = await page.locator('[data-testid="total-usage-cost"]').textContent();
      expect(totalCost).toMatch(/\$\d+\.\d{2}/);
    }
  });

  test('should show monthly usage summary', async ({ page }) => {
    await page.click('[data-testid="hamburger-menu"]');
    await page.click('[data-testid="menu-tools"]');
    await page.click('[data-testid="monthly-summary-tab"]');
    
    await expect(page.locator('[data-testid="monthly-usage-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="monthly-total-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="monthly-token-usage"]')).toBeVisible();
    
    // Check breakdown by tool type
    await expect(page.locator('[data-testid="usage-by-tool"]')).toBeVisible();
  });
});