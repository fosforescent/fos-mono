import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/auth';

test.describe('Global Comment Bus', () => {
  test('creates a global comment visible to other users', async ({ browser }) => {
    const commentText = `Global bus message ${Date.now()}`;

    const userOneContext = await browser.newContext();
    const userOnePage = await userOneContext.newPage();

    await loginWithCredentials(userOnePage, 'alice@fosforescent.com', 'alice123');
    await userOnePage.goto('/inbox');
    await userOnePage.waitForLoadState('networkidle');

    await userOnePage.getByTestId('queue-filter-trigger').click();
    await userOnePage.getByTestId('queue-filter-comments').click();

    await userOnePage.getByTestId('queue-expression-input').fill(commentText);
    await userOnePage.getByTestId('queue-expression-submit').click();

    const userOneComment = userOnePage
      .locator('[data-testid="expression-card-comment"]')
      .filter({ hasText: commentText });

    await expect(userOneComment).toBeVisible({ timeout: 10000 });

    // Give the app time to persist the change before switching users
    await userOnePage.waitForTimeout(2000);
    await userOneContext.close();

    const userTwoContext = await browser.newContext();
    const userTwoPage = await userTwoContext.newPage();

    await loginWithCredentials(userTwoPage, 'bob@fosforescent.com', 'bob123');
    await userTwoPage.goto('/inbox');
    await userTwoPage.waitForLoadState('networkidle');

    await userTwoPage.getByTestId('queue-filter-trigger').click();
    await userTwoPage.getByTestId('queue-filter-comments').click();

    const userTwoComment = userTwoPage
      .locator('[data-testid="expression-card-comment"]')
      .filter({ hasText: commentText });

    await expect(userTwoComment).toBeVisible({ timeout: 15000 });

    await userTwoContext.close();
  });
});
