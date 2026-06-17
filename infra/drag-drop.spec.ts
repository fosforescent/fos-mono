import { test, expect } from '@playwright/test';

test.describe('Drag and Drop Debug', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('.expr-row', { timeout: 10000 });
  });

  test('should have draggable handles', async ({ page }) => {
    // First add an item so we have handles
    const addInput = page.locator('.expr-add-row .expr-input');
    if (await addInput.count() > 0) {
      await addInput.fill('Test Item');
      await addInput.press('Enter');
      await page.waitForTimeout(300);
    }

    // Find the drag handles
    const handles = page.locator('.expr-handle');
    const count = await handles.count();

    console.log(`Found ${count} drag handles`);
    expect(count).toBeGreaterThan(0);

    // Check the first handle
    const firstHandle = handles.first();
    await expect(firstHandle).toBeVisible();

    // Log handle properties
    const draggable = await firstHandle.getAttribute('draggable');
    console.log('Handle draggable attribute:', draggable);
  });

  test('should show rows before drag', async ({ page }) => {
    const rows = page.locator('.expr-row');
    const count = await rows.count();
    console.log(`Found ${count} rows before any drag operation`);

    // Get descriptions of all rows
    const inputs = page.locator('.expr-input');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const value = await inputs.nth(i).inputValue();
      console.log(`Row ${i}: "${value}"`);
    }

    expect(count).toBeGreaterThan(0);
  });

  test('debug drag operation step by step', async ({ page }) => {
    // Listen for console logs
    page.on('console', msg => {
      if (msg.text().includes('[makeDragHandle]') ||
          msg.text().includes('[DragDrop]') ||
          msg.text().includes('[executeDrop]') ||
          msg.text().includes('[moveNode')) {
        console.log('PAGE LOG:', msg.text());
      }
    });

    const rows = page.locator('.expr-row');
    const initialCount = await rows.count();
    console.log(`Initial row count: ${initialCount}`);

    if (initialCount < 2) {
      console.log('Need at least 2 rows for drag test, adding items...');

      // Find the add row input and add items
      const addInput = page.locator('.expr-add-row .expr-input');
      if (await addInput.count() > 0) {
        await addInput.fill('Test Item 1');
        await addInput.press('Enter');
        await page.waitForTimeout(500);

        await addInput.fill('Test Item 2');
        await addInput.press('Enter');
        await page.waitForTimeout(500);
      }
    }

    // Re-check row count
    const rowsAfterAdd = page.locator('.expr-row:not(.expr-add-row)');
    const countAfterAdd = await rowsAfterAdd.count();
    console.log(`Row count after adding: ${countAfterAdd}`);

    if (countAfterAdd < 2) {
      console.log('Still not enough rows, skipping drag test');
      return;
    }

    // Get the first and second row handles
    const handles = page.locator('.expr-handle');
    const firstHandle = handles.first();
    const secondRow = rowsAfterAdd.nth(1);

    // Log positions
    const handleBox = await firstHandle.boundingBox();
    const targetBox = await secondRow.boundingBox();
    console.log('Handle position:', handleBox);
    console.log('Target row position:', targetBox);

    // Perform drag
    console.log('Starting drag...');

    // Mouse down on handle
    await firstHandle.hover();
    await page.mouse.down();
    console.log('Mouse down on handle');

    await page.waitForTimeout(100);

    // Move to target
    if (targetBox) {
      await page.mouse.move(targetBox.x + 50, targetBox.y + targetBox.height / 2);
      console.log('Moved to target');
    }

    await page.waitForTimeout(100);

    // Drop
    await page.mouse.up();
    console.log('Mouse up (drop)');

    await page.waitForTimeout(500);

    // Check final state
    const finalRows = page.locator('.expr-row:not(.expr-add-row)');
    const finalCount = await finalRows.count();
    console.log(`Final row count: ${finalCount}`);

    // Get final descriptions
    const finalInputs = page.locator('.expr-input');
    const finalInputCount = await finalInputs.count();
    console.log('Final row values:');
    for (let i = 0; i < finalInputCount; i++) {
      const value = await finalInputs.nth(i).inputValue();
      console.log(`  Row ${i}: "${value}"`);
    }

    // The row count should be the same (not disappearing)
    expect(finalCount).toBe(countAfterAdd);
  });

  test('drag using Playwright dragTo', async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[') || text.includes('drag') || text.includes('Drop')) {
        console.log('PAGE:', text);
      }
    });

    // Add test items first
    const addInput = page.locator('.expr-add-row .expr-input');
    if (await addInput.count() > 0) {
      await addInput.fill('Drag Me');
      await addInput.press('Enter');
      await page.waitForTimeout(300);

      await addInput.fill('Drop Here');
      await addInput.press('Enter');
      await page.waitForTimeout(300);
    }

    const contentRows = page.locator('.expr-row:not(.expr-add-row)');
    const count = await contentRows.count();
    console.log(`Content rows: ${count}`);

    if (count >= 2) {
      const firstHandle = page.locator('.expr-handle').first();
      const secondRow = contentRows.nth(1);

      console.log('Attempting Playwright dragTo...');

      // Use Playwright's built-in drag
      await firstHandle.dragTo(secondRow);

      await page.waitForTimeout(500);

      const finalCount = await contentRows.count();
      console.log(`Final content rows: ${finalCount}`);

      expect(finalCount).toBe(count);
    }
  });

  test('verify move inside preserves both nodes', async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[renderTree]') || text.includes('[moveNode')) {
        console.log('PAGE:', text);
      }
    });

    // Add two items
    const addInput = page.locator('.expr-add-row .expr-input');
    await addInput.fill('Parent');
    await addInput.press('Enter');
    await page.waitForTimeout(300);

    await addInput.fill('Child');
    await addInput.press('Enter');
    await page.waitForTimeout(300);

    // Get initial state
    const contentRows = page.locator('.expr-row:not(.expr-add-row)');
    const initialCount = await contentRows.count();
    console.log(`Initial rows: ${initialCount}`);
    expect(initialCount).toBe(2);

    // Drag "Child" into "Parent" (inside)
    const childHandle = page.locator('.expr-handle').nth(1); // Second item
    const parentRow = contentRows.first();

    // Enable dragging
    await childHandle.dispatchEvent('mousedown');
    await page.waitForTimeout(50);

    // Dispatch drag events manually to drop "inside"
    await contentRows.nth(1).evaluate((row) => {
      const dt = new DataTransfer();
      dt.effectAllowed = 'move';
      dt.setData('text/plain', row.dataset.fosPath || '');
      row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    // Dragover in center of parent (for "inside" position)
    await parentRow.evaluate((row) => {
      const rect = row.getBoundingClientRect();
      const dt = new DataTransfer();
      dt.dropEffect = 'move';
      row.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientY: rect.top + rect.height / 2 // Center = inside
      }));
    });

    // Drop
    await parentRow.evaluate((row) => {
      const dt = new DataTransfer();
      dt.dropEffect = 'move';
      row.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    // Dragend
    await contentRows.nth(1).evaluate((row) => {
      row.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
    });

    await page.waitForTimeout(500);

    // After moving Child inside Parent:
    // - Root level should have 1 item (Parent)
    // - Parent should have 1 child (Child)
    const finalTopLevel = await contentRows.count();
    console.log(`Final top-level rows: ${finalTopLevel}`);

    // The top level should have 1 row (Parent) plus any nested rows that are now visible
    // Depending on expand/collapse state, we might see both or just Parent
    expect(finalTopLevel).toBeGreaterThan(0);

    // Check that neither item disappeared completely
    const allInputs = page.locator('.expr-input');
    const inputValues: string[] = [];
    const inputCount = await allInputs.count();
    for (let i = 0; i < inputCount; i++) {
      const val = await allInputs.nth(i).inputValue();
      if (val) inputValues.push(val);
    }
    console.log('All values:', inputValues);

    // Both "Parent" and "Child" should still exist somewhere
    expect(inputValues).toContain('Parent');
    expect(inputValues).toContain('Child');
  });

  test('manual drag-drop with DataTransfer', async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[')) {
        console.log('PAGE:', text);
      }
    });

    // Add test items first
    const addInput = page.locator('.expr-add-row .expr-input');
    if (await addInput.count() > 0) {
      await addInput.fill('First');
      await addInput.press('Enter');
      await page.waitForTimeout(300);

      await addInput.fill('Second');
      await addInput.press('Enter');
      await page.waitForTimeout(300);
    }

    const contentRows = page.locator('.expr-row:not(.expr-add-row)');
    const count = await contentRows.count();
    console.log(`Content rows before: ${count}`);

    if (count >= 2) {
      // Get the first row and second row
      const firstRow = contentRows.first();
      const secondRow = contentRows.nth(1);
      const firstHandle = page.locator('.expr-handle').first();

      // Enable dragging by clicking handle
      await firstHandle.dispatchEvent('mousedown');
      await page.waitForTimeout(50);

      // Now manually dispatch drag events
      // 1. dragstart on source
      await firstRow.evaluate((row) => {
        const dt = new DataTransfer();
        dt.effectAllowed = 'move';
        dt.setData('text/plain', row.dataset.fosPath || '');
        const dragStartEvent = new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt
        });
        row.dispatchEvent(dragStartEvent);
      });

      console.log('dragstart dispatched');
      await page.waitForTimeout(100);

      // 2. dragover on target
      await secondRow.evaluate((row) => {
        const dt = new DataTransfer();
        dt.dropEffect = 'move';
        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientY: row.getBoundingClientRect().top + row.getBoundingClientRect().height * 0.8 // bottom 25% = 'after'
        });
        row.dispatchEvent(dragOverEvent);
      });

      console.log('dragover dispatched');
      await page.waitForTimeout(100);

      // 3. drop on target
      await secondRow.evaluate((row) => {
        const dt = new DataTransfer();
        dt.dropEffect = 'move';
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt
        });
        row.dispatchEvent(dropEvent);
      });

      console.log('drop dispatched');
      await page.waitForTimeout(100);

      // 4. dragend on source
      await firstRow.evaluate((row) => {
        const dragEndEvent = new DragEvent('dragend', {
          bubbles: true,
          cancelable: true
        });
        row.dispatchEvent(dragEndEvent);
      });

      console.log('dragend dispatched');
      await page.waitForTimeout(500);

      const finalCount = await contentRows.count();
      console.log(`Final content rows: ${finalCount}`);

      // Check order
      const inputs = page.locator('.expr-input');
      const inputCount = await inputs.count();
      console.log('Final row values:');
      for (let i = 0; i < inputCount; i++) {
        const value = await inputs.nth(i).inputValue();
        console.log(`  Row ${i}: "${value}"`);
      }

      expect(finalCount).toBe(count);
    }
  });
});
