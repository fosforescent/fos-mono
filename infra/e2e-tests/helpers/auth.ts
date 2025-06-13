import { Page } from '@playwright/test';

export async function login(page: Page, options: { isAdmin?: boolean } = {}) {
  const userType = options.isAdmin ? 'admin' : 'user';
  return await loginWithTestUser(page, userType);
}

export async function loginWithTestUser(page: Page, userType: 'admin' | 'user' = 'user') {
  // Navigate to the app
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if we're already logged in by looking for authenticated content
  const hasAuthenticatedContent = await page.locator('[data-testid="authenticated-content"]').isVisible({ timeout: 2000 }).catch(() => false);
  
  if (hasAuthenticatedContent) {
    // Already logged in
    return;
  }

  // Use seed users based on userType
  const credentials = userType === 'admin' 
    ? { email: 'admin@fosforescent.com', password: 'admin123' }
    : { email: 'user1@fosforescent.com', password: 'user123' };

  await loginWithCredentials(page, credentials.email, credentials.password);
}

export async function loginWithCredentials(page: Page, email: string, password: string) {
  console.log('Logging in with:', email);
  
  // Make sure we're on the login tab
  const signInTab = page.getByRole('tab', { name: /sign in/i });
  if (await signInTab.isVisible({ timeout: 2000 })) {
    await signInTab.click();
    await page.waitForTimeout(500);
  }

  // Fill login form
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  
  // Submit login
  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.click();
  
  // Wait for login to process
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Check if login was successful by looking for authenticated UI
  const isLoggedIn = await page.locator('[data-testid="authenticated-content"]').or(
    page.locator('text=Dashboard')
  ).isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!isLoggedIn) {
    console.log('Login may have failed, checking page content...');
    const pageContent = await page.locator('body').textContent();
    console.log('Page content after login attempt:', pageContent?.substring(0, 300));
  } else {
    console.log('Login successful!');
  }
}

export async function registerTestUser(page: Page) {
  // Click on register tab
  console.log('Clicking register tab...');
  await page.getByRole('tab', { name: /register/i }).click();
  
  // Fill registration form with specific selectors
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123'; // Updated to meet backend requirements
  
  console.log('Filling registration form with:', testEmail, testPassword);
  await page.locator('#register-email').fill(testEmail);
  await page.locator('#register-password').fill(testPassword);
  await page.locator('#confirm-password').fill(testPassword);
  await page.locator('#accept-terms').check();
  
  // Listen for network requests to see what's happening
  page.on('request', request => {
    if (request.url().includes('/auth/')) {
      console.log('Auth request:', request.method(), request.url());
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/auth/register')) {
      const responseText = await response.text().catch(() => 'Could not read response');
      console.log('Registration response:', response.status(), response.statusText(), responseText);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/auth/login')) {
      const responseText = await response.text().catch(() => 'Could not read response');
      console.log('Login response:', response.status(), response.statusText(), responseText);
    }
  });
  
  // Submit registration
  console.log('Submitting registration...');
  const createAccountButton = page.getByRole('button', { name: /create account/i });
  console.log('Create account button visible:', await createAccountButton.isVisible());
  await createAccountButton.click();
  
  // Wait for registration success
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Check if registration automatically logged us in
  console.log('Checking if registration auto-logged in...');
  const hasAuthenticatedContent = await page.locator('form input[placeholder*="todo"]').isVisible({ timeout: 5000 }).catch(() => false);
  
  if (hasAuthenticatedContent) {
    console.log('Registration auto-logged in successfully!');
    return;
  }
  
  console.log('Registration did not auto-login, attempting manual login...');
  
  // Check if we're still on the registration success page or if we need to navigate
  const pageContent = await page.locator('body').textContent();
  console.log('Page content after registration:', pageContent?.substring(0, 300));
  
  // Try to find sign-in tab and switch to it
  const signInTab = page.getByRole('tab', { name: 'Sign In' });
  if (await signInTab.isVisible({ timeout: 2000 })) {
    await signInTab.click();
    await page.waitForTimeout(1000);
  }
  
  // Fill login form
  await page.locator('#login-email').fill(testEmail);
  await page.locator('#login-password').fill(testPassword);
  
  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.click();
  
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Check final authentication status
  const finalAuthStatus = await page.locator('form input[placeholder*="todo"]').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Final authentication status:', finalAuthStatus);
  
  if (!finalAuthStatus) {
    const finalPageContent = await page.locator('body').textContent();
    console.log('Authentication failed. Final page content:', finalPageContent?.substring(0, 300));
  }
}

export async function navigateToQueueView(page: Page) {
  // Look for navigation to queue view
  const queueButton = page.getByRole('button', { name: /queue/i })
    .or(page.locator('button', { hasText: /queue/i }))
    .or(page.locator('[data-testid="queue-button"]'));
  
  if (await queueButton.isVisible({ timeout: 2000 })) {
    await queueButton.click();
    await page.waitForLoadState('networkidle');
  }
  
  // Alternative: look for view switcher or navigation menu
  const viewSwitcher = page.locator('[data-testid="view-switcher"]')
    .or(page.locator('select'))
    .or(page.locator('.view-toggle'));
  
  if (await viewSwitcher.isVisible({ timeout: 2000 })) {
    await viewSwitcher.click();
    const queueOption = page.getByText('Queue').or(page.getByText('queue'));
    if (await queueOption.isVisible()) {
      await queueOption.click();
    }
  }
}