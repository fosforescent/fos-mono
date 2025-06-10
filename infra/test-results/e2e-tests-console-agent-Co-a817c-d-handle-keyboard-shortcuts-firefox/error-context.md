# Test info

- Name: Console Agent >> should handle keyboard shortcuts
- Location: /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/console-agent.spec.ts:168:7

# Error details

```
Error: page.goto: NS_ERROR_CONNECTION_REFUSED
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

    at loginWithTestUser (/home/dmn/main/code/fos/fos-mono/infra/e2e-tests/helpers/auth.ts:10:14)
    at /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/console-agent.spec.ts:7:28
```

# Page snapshot

```yaml
- heading "Unable to connect" [level=1]
- paragraph: Firefox can’t establish a connection to the server at localhost:5173.
- paragraph
- list:
  - listitem: The site could be temporarily unavailable or too busy. Try again in a few moments.
  - listitem: If you are unable to load any pages, check your computer’s network connection.
  - listitem: If your computer or network is protected by a firewall or proxy, make sure that Nightly is permitted to access the web.
- button "Try Again"
```

# Test source

```ts
   1 | import { Page } from '@playwright/test';
   2 |
   3 | export async function login(page: Page, options: { isAdmin?: boolean } = {}) {
   4 |   const userType = options.isAdmin ? 'admin' : 'user';
   5 |   return await loginWithTestUser(page, userType);
   6 | }
   7 |
   8 | export async function loginWithTestUser(page: Page, userType: 'admin' | 'user' = 'user') {
   9 |   // Navigate to the app
>  10 |   await page.goto('/');
      |              ^ Error: page.goto: NS_ERROR_CONNECTION_REFUSED
   11 |   await page.waitForLoadState('networkidle');
   12 |
   13 |   // Check if we're already logged in by looking for authenticated content
   14 |   const hasAuthenticatedContent = await page.locator('[data-testid="authenticated-content"]').isVisible({ timeout: 2000 }).catch(() => false);
   15 |   
   16 |   if (hasAuthenticatedContent) {
   17 |     // Already logged in
   18 |     return;
   19 |   }
   20 |
   21 |   // Use seed users based on userType
   22 |   const credentials = userType === 'admin' 
   23 |     ? { email: 'admin@fosforescent.com', password: 'admin123' }
   24 |     : { email: 'user1@fosforescent.com', password: 'user123' };
   25 |
   26 |   await loginWithCredentials(page, credentials.email, credentials.password);
   27 | }
   28 |
   29 | export async function loginWithCredentials(page: Page, email: string, password: string) {
   30 |   console.log('Logging in with:', email);
   31 |   
   32 |   // Make sure we're on the login tab
   33 |   const signInTab = page.getByRole('tab', { name: /sign in/i });
   34 |   if (await signInTab.isVisible({ timeout: 2000 })) {
   35 |     await signInTab.click();
   36 |     await page.waitForTimeout(500);
   37 |   }
   38 |
   39 |   // Fill login form
   40 |   await page.locator('#username').fill(email);
   41 |   await page.locator('#password').fill(password);
   42 |   
   43 |   // Submit login
   44 |   const signInButton = page.getByRole('button', { name: /sign in/i });
   45 |   await signInButton.click();
   46 |   
   47 |   // Wait for login to process
   48 |   await page.waitForLoadState('networkidle');
   49 |   await page.waitForTimeout(2000);
   50 |   
   51 |   // Check if login was successful by looking for authenticated UI
   52 |   const isLoggedIn = await page.locator('[data-testid="authenticated-content"]').or(
   53 |     page.locator('text=Dashboard')
   54 |   ).isVisible({ timeout: 5000 }).catch(() => false);
   55 |   
   56 |   if (!isLoggedIn) {
   57 |     console.log('Login may have failed, checking page content...');
   58 |     const pageContent = await page.locator('body').textContent();
   59 |     console.log('Page content after login attempt:', pageContent?.substring(0, 300));
   60 |   } else {
   61 |     console.log('Login successful!');
   62 |   }
   63 | }
   64 |
   65 | export async function registerTestUser(page: Page) {
   66 |   // Click on register tab
   67 |   console.log('Clicking register tab...');
   68 |   await page.getByRole('tab', { name: /register/i }).click();
   69 |   
   70 |   // Fill registration form with specific selectors
   71 |   const testEmail = `test-${Date.now()}@example.com`;
   72 |   const testPassword = 'TestPassword123'; // Updated to meet backend requirements
   73 |   
   74 |   console.log('Filling registration form with:', testEmail, testPassword);
   75 |   await page.locator('#register-email').fill(testEmail);
   76 |   await page.locator('#register-password').fill(testPassword);
   77 |   await page.locator('#confirm-password').fill(testPassword);
   78 |   await page.locator('#accept-terms').check();
   79 |   
   80 |   // Listen for network requests to see what's happening
   81 |   page.on('request', request => {
   82 |     if (request.url().includes('/auth/')) {
   83 |       console.log('Auth request:', request.method(), request.url());
   84 |     }
   85 |   });
   86 |   
   87 |   page.on('response', async response => {
   88 |     if (response.url().includes('/auth/register')) {
   89 |       const responseText = await response.text().catch(() => 'Could not read response');
   90 |       console.log('Registration response:', response.status(), response.statusText(), responseText);
   91 |     }
   92 |   });
   93 |   
   94 |   page.on('response', async response => {
   95 |     if (response.url().includes('/auth/login')) {
   96 |       const responseText = await response.text().catch(() => 'Could not read response');
   97 |       console.log('Login response:', response.status(), response.statusText(), responseText);
   98 |     }
   99 |   });
  100 |   
  101 |   // Submit registration
  102 |   console.log('Submitting registration...');
  103 |   const createAccountButton = page.getByRole('button', { name: /create account/i });
  104 |   console.log('Create account button visible:', await createAccountButton.isVisible());
  105 |   await createAccountButton.click();
  106 |   
  107 |   // Wait for registration success
  108 |   await page.waitForLoadState('networkidle');
  109 |   await page.waitForTimeout(3000);
  110 |   
```