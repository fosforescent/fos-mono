# Test info

- Name: Application Smoke Tests >> should create new workflow node
- Location: /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/graph-workflow.spec.ts:22:7

# Error details

```
Error: page.goto: NS_ERROR_CONNECTION_REFUSED
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

    at /home/dmn/main/code/fos/fos-mono/infra/e2e-tests/graph-workflow.spec.ts:5:16
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
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Application Smoke Tests', () => {
   4 |   test.beforeEach(async ({ page }) => {
>  5 |     await page.goto('/');
     |                ^ Error: page.goto: NS_ERROR_CONNECTION_REFUSED
   6 |   });
   7 |
   8 |   test('should load the application successfully', async ({ page }) => {
   9 |     await expect(page).toHaveTitle(/fosforescent/);
  10 |     
  11 |     // Check that the main app loads without errors
  12 |     await expect(page.locator('body')).toBeVisible();
  13 |     
  14 |     // Should show either login form or main app interface
  15 |     const loginForm = page.locator('input[type="email"]');
  16 |     const appInterface = page.locator('nav').or(page.locator('[data-testid="main-app"]'));
  17 |     
  18 |     const hasLoginOrApp = await loginForm.isVisible() || await appInterface.isVisible();
  19 |     expect(hasLoginOrApp).toBe(true);
  20 |   });
  21 |
  22 |   test('should create new workflow node', async ({ page }) => {
  23 |     const addButton = page.getByRole('button', { name: /add/i }).or(page.getByRole('button', { name: /new/i })).or(page.locator('[data-testid="add-node"]'));
  24 |     
  25 |     if (await addButton.first().isVisible()) {
  26 |       await addButton.first().click();
  27 |       
  28 |       const nodeForm = page.locator('form').or(page.locator('[data-testid="node-form"]'));
  29 |       await expect(nodeForm.first()).toBeVisible();
  30 |     }
  31 |   });
  32 |
  33 |   test('should navigate between different layout views', async ({ page }) => {
  34 |     const treeViewButton = page.getByRole('button', { name: /tree/i });
  35 |     const queryViewButton = page.getByRole('button', { name: /query/i });
  36 |     const focusViewButton = page.getByRole('button', { name: /focus/i });
  37 |     
  38 |     if (await treeViewButton.isVisible()) {
  39 |       await treeViewButton.click();
  40 |       await expect(page.locator('[data-testid="tree-layout"]').or(page.locator('.tree-layout')).first()).toBeVisible();
  41 |     }
  42 |     
  43 |     if (await queryViewButton.isVisible()) {
  44 |       await queryViewButton.click();
  45 |       await expect(page.locator('[data-testid="query-layout"]').or(page.locator('.query-layout')).first()).toBeVisible();
  46 |     }
  47 |   });
  48 |
  49 |   test('should handle node interactions', async ({ page }) => {
  50 |     const firstNode = page.locator('[data-testid="node"]').or(page.locator('.node')).first();
  51 |     
  52 |     if (await firstNode.isVisible()) {
  53 |       await firstNode.hover();
  54 |       
  55 |       const editButton = page.getByRole('button', { name: /edit/i });
  56 |       const deleteButton = page.getByRole('button', { name: /delete/i });
  57 |       
  58 |       if (await editButton.isVisible()) {
  59 |         await editButton.click();
  60 |         await expect(page.locator('form').or(page.locator('[data-testid="edit-form"]')).first()).toBeVisible();
  61 |       }
  62 |     }
  63 |   });
  64 |
  65 |   test('should support drag and drop operations', async ({ page }) => {
  66 |     const sourceNode = page.locator('[data-testid="node"]').or(page.locator('.draggable')).first();
  67 |     const targetArea = page.locator('[data-testid="drop-zone"]').or(page.locator('.drop-target')).first();
  68 |     
  69 |     if (await sourceNode.isVisible() && await targetArea.isVisible()) {
  70 |       await sourceNode.dragTo(targetArea);
  71 |       
  72 |       await expect(page.getByText(/moved/i).or(page.getByText(/updated/i)).first()).toBeVisible({ timeout: 5000 });
  73 |     }
  74 |   });
  75 | });
```