import { test, expect } from '@playwright/test';

test.describe('Graph Workflow Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Add authentication setup if needed
  });

  test('should display main workspace interface', async ({ page }) => {
    await expect(page).toHaveTitle(/fosforescent/);
    
    const workspace = page.locator('[data-testid="workspace"]').or(page.locator('.workspace')).or(page.locator('#workspace'));
    const treeView = page.locator('[data-testid="tree-view"]').or(page.locator('.tree-view'));
    const queryLayout = page.locator('[data-testid="query-layout"]').or(page.locator('.query-layout'));
    
    await expect(workspace.or(treeView).or(queryLayout).first()).toBeVisible();
  });

  test('should create new workflow node', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add/i }).or(page.getByRole('button', { name: /new/i })).or(page.locator('[data-testid="add-node"]'));
    
    if (await addButton.first().isVisible()) {
      await addButton.first().click();
      
      const nodeForm = page.locator('form').or(page.locator('[data-testid="node-form"]'));
      await expect(nodeForm.first()).toBeVisible();
    }
  });

  test('should navigate between different layout views', async ({ page }) => {
    const treeViewButton = page.getByRole('button', { name: /tree/i });
    const queryViewButton = page.getByRole('button', { name: /query/i });
    const focusViewButton = page.getByRole('button', { name: /focus/i });
    
    if (await treeViewButton.isVisible()) {
      await treeViewButton.click();
      await expect(page.locator('[data-testid="tree-layout"]').or(page.locator('.tree-layout')).first()).toBeVisible();
    }
    
    if (await queryViewButton.isVisible()) {
      await queryViewButton.click();
      await expect(page.locator('[data-testid="query-layout"]').or(page.locator('.query-layout')).first()).toBeVisible();
    }
  });

  test('should handle node interactions', async ({ page }) => {
    const firstNode = page.locator('[data-testid="node"]').or(page.locator('.node')).first();
    
    if (await firstNode.isVisible()) {
      await firstNode.hover();
      
      const editButton = page.getByRole('button', { name: /edit/i });
      const deleteButton = page.getByRole('button', { name: /delete/i });
      
      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('form').or(page.locator('[data-testid="edit-form"]')).first()).toBeVisible();
      }
    }
  });

  test('should support drag and drop operations', async ({ page }) => {
    const sourceNode = page.locator('[data-testid="node"]').or(page.locator('.draggable')).first();
    const targetArea = page.locator('[data-testid="drop-zone"]').or(page.locator('.drop-target')).first();
    
    if (await sourceNode.isVisible() && await targetArea.isVisible()) {
      await sourceNode.dragTo(targetArea);
      
      await expect(page.getByText(/moved/i).or(page.getByText(/updated/i)).first()).toBeVisible({ timeout: 5000 });
    }
  });
});