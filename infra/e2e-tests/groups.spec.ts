import { test, expect } from '@playwright/test';

const TEST_USERS = [
  {
    email: 'alice@fosforescent.com',
    password: 'alice123',
    name: 'Alice Smith'
  },
  {
    email: 'bob@fosforescent.com',
    password: 'bob123',
    name: 'Bob Johnson'
  },
  {
    email: 'charlie@fosforescent.com',
    password: 'charlie123',
    name: 'Charlie Williams'
  }
];

test.describe('Groups and DM Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure users are registered and logged in
    await page.goto('/');
  });

  test('should search for users and start a DM', async ({ page }) => {
    // Login as user1
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.fill('#login-email', TEST_USERS[0].email);
    await page.fill('#login-password', TEST_USERS[0].password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Navigate to groups page
    await page.goto('/groups');
    await page.waitForTimeout(1000);

    // Switch to "Start DM" tab
    await page.getByRole('tab', { name: /start dm/i }).click();

    // Search for user2
    await page.fill('input[placeholder*="Search users"]', 'Bob');
    await page.waitForTimeout(1000);

    // Should show Bob in search results
    await expect(page.getByText(TEST_USERS[1].name)).toBeVisible();

    // Click message button to create DM
    await page.getByRole('button', { name: /message/i }).first().click();
    await page.waitForTimeout(1000);

    // Should see success toast
    await expect(page.getByText(/DM/i)).toBeVisible();
  });

  test('should create a custom group', async ({ page }) => {
    // Login as user1
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.fill('#login-email', TEST_USERS[0].email);
    await page.fill('#login-password', TEST_USERS[0].password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Navigate to groups page
    await page.goto('/groups');
    await page.waitForTimeout(1000);

    // Click create group button
    await page.getByRole('button', { name: /create group/i }).click();
    await page.waitForTimeout(500);

    // Fill in group details
    await page.fill('#groupName', 'Test Team');
    await page.fill('#groupDescription', 'A test team for collaboration');

    // Toggle to make it public
    await page.locator('#visibility').click();

    // Create the group
    await page.getByRole('button', { name: /create group/i }).last().click();
    await page.waitForTimeout(1000);

    // Should see success message
    await expect(page.getByText(/Test Team/i)).toBeVisible();
  });

  test('should display user groups', async ({ page }) => {
    // Login as user1
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.fill('#login-email', TEST_USERS[0].email);
    await page.fill('#login-password', TEST_USERS[0].password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Navigate to groups page
    await page.goto('/groups');
    await page.waitForTimeout(1000);

    // Should be on "My Groups" tab by default
    // User should at least see their default group
    const groupCards = page.locator('[class*="cursor-pointer"]');
    const count = await groupCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should browse public groups', async ({ page }) => {
    // Login as user2
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.fill('#login-email', TEST_USERS[1].email);
    await page.fill('#login-password', TEST_USERS[1].password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Navigate to groups page
    await page.goto('/groups');
    await page.waitForTimeout(1000);

    // Switch to public groups tab
    await page.getByRole('tab', { name: /public/i }).click();
    await page.waitForTimeout(500);

    // Should see public groups or "no public groups" message
    const noGroupsMessage = page.getByText(/no public groups/i);
    const groupCards = page.locator('[class*="cursor-pointer"]');

    const hasNoGroupsMessage = await noGroupsMessage.isVisible();
    const hasGroupCards = await groupCards.count() > 0;

    expect(hasNoGroupsMessage || hasGroupCards).toBe(true);
  });

  test('should open group console and display members', async ({ page }) => {
    // Login as user1
    await page.getByRole('tab', { name: /sign in/i }).click();
    await page.fill('#login-email', TEST_USERS[0].email);
    await page.fill('#login-password', TEST_USERS[0].password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Navigate to groups page
    await page.goto('/groups');
    await page.waitForTimeout(1000);

    // Click on first group
    const firstGroup = page.locator('[class*="cursor-pointer"]').first();
    await firstGroup.click();
    await page.waitForTimeout(1000);

    // Should navigate to group console
    // Check for console elements
    await expect(page.getByText(/connected/i).or(page.getByText(/disconnected/i))).toBeVisible();
  });
});

test.describe('Multi-Session Real-Time Messaging', () => {
  test('should send and receive messages in real-time between two sessions', async ({ browser }) => {
    // Create two separate browser contexts (like two different users)
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Login Alice
      console.log('Logging in Alice...');
      await alicePage.goto('/');
      await alicePage.getByRole('tab', { name: /sign in/i }).click();
      await alicePage.fill('#login-email', TEST_USERS[0].email);
      await alicePage.fill('#login-password', TEST_USERS[0].password);
      await alicePage.getByRole('button', { name: /sign in/i }).click();
      await alicePage.waitForTimeout(2000);

      // Login Bob
      console.log('Logging in Bob...');
      await bobPage.goto('/');
      await bobPage.getByRole('tab', { name: /sign in/i }).click();
      await bobPage.fill('#login-email', TEST_USERS[1].email);
      await bobPage.fill('#login-password', TEST_USERS[1].password);
      await bobPage.getByRole('button', { name: /sign in/i }).click();
      await bobPage.waitForTimeout(2000);

      // Alice navigates to groups and finds the DM with Bob (created in seed)
      console.log('Alice opening DM with Bob...');
      await alicePage.goto('/groups');
      await alicePage.waitForTimeout(1000);

      // Find and click on the group that contains Bob (should be the DM)
      const aliceGroups = await alicePage.locator('[class*="cursor-pointer"]').all();
      let foundDM = false;
      for (const group of aliceGroups) {
        const text = await group.textContent();
        if (text?.includes('Bob') || text?.includes('DM')) {
          await group.click();
          foundDM = true;
          break;
        }
      }

      if (!foundDM && aliceGroups.length > 0) {
        // Fallback: just click the first group
        await aliceGroups[0].click();
      }

      await alicePage.waitForTimeout(1500);

      // Bob navigates to the same group/DM
      console.log('Bob opening DM with Alice...');
      await bobPage.goto('/groups');
      await bobPage.waitForTimeout(1000);

      const bobGroups = await bobPage.locator('[class*="cursor-pointer"]').all();
      foundDM = false;
      for (const group of bobGroups) {
        const text = await group.textContent();
        if (text?.includes('Alice') || text?.includes('DM')) {
          await group.click();
          foundDM = true;
          break;
        }
      }

      if (!foundDM && bobGroups.length > 0) {
        // Fallback: just click the first group
        await bobGroups[0].click();
      }

      await bobPage.waitForTimeout(1500);

      // Verify both are connected
      await expect(alicePage.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
      await expect(bobPage.getByText(/connected/i)).toBeVisible({ timeout: 10000 });

      console.log('Both users connected to WebSocket');

      // Alice sends a message
      const aliceMessage = `Hello from Alice at ${Date.now()}`;
      console.log('Alice sending message:', aliceMessage);

      const aliceInput = alicePage.getByPlaceholder(/type a message/i);
      await aliceInput.fill(aliceMessage);
      await aliceInput.press('Enter');
      await alicePage.waitForTimeout(1000);

      // Verify Alice sees her own message
      await expect(alicePage.getByText(aliceMessage)).toBeVisible({ timeout: 5000 });
      console.log('Alice sees her own message');

      // Verify Bob receives the message in real-time
      await expect(bobPage.getByText(aliceMessage)).toBeVisible({ timeout: 10000 });
      console.log('Bob received Alice\'s message!');

      // Bob sends a reply
      const bobMessage = `Hi Alice! Reply from Bob at ${Date.now()}`;
      console.log('Bob sending reply:', bobMessage);

      const bobInput = bobPage.getByPlaceholder(/type a message/i);
      await bobInput.fill(bobMessage);
      await bobInput.press('Enter');
      await bobPage.waitForTimeout(1000);

      // Verify Bob sees his own message
      await expect(bobPage.getByText(bobMessage)).toBeVisible({ timeout: 5000 });
      console.log('Bob sees his own message');

      // Verify Alice receives Bob's reply in real-time
      await expect(alicePage.getByText(bobMessage)).toBeVisible({ timeout: 10000 });
      console.log('Alice received Bob\'s reply!');

      // Send a few more messages back and forth
      const aliceMessage2 = `Second message from Alice at ${Date.now()}`;
      await aliceInput.fill(aliceMessage2);
      await aliceInput.press('Enter');
      await alicePage.waitForTimeout(500);

      await expect(bobPage.getByText(aliceMessage2)).toBeVisible({ timeout: 10000 });
      console.log('Real-time messaging working both ways!');

    } finally {
      // Cleanup
      await alicePage.close();
      await bobPage.close();
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('should broadcast messages to all members in a group', async ({ browser }) => {
    // Create three separate browser contexts for Alice, Bob, and Charlie
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const charlieContext = await browser.newContext();

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();
    const charliePage = await charlieContext.newPage();

    try {
      // Login all three users
      console.log('Logging in all users...');

      // Alice
      await alicePage.goto('/');
      await alicePage.getByRole('tab', { name: /sign in/i }).click();
      await alicePage.fill('#login-email', TEST_USERS[0].email);
      await alicePage.fill('#login-password', TEST_USERS[0].password);
      await alicePage.getByRole('button', { name: /sign in/i }).click();
      await alicePage.waitForTimeout(2000);

      // Bob
      await bobPage.goto('/');
      await bobPage.getByRole('tab', { name: /sign in/i }).click();
      await bobPage.fill('#login-email', TEST_USERS[1].email);
      await bobPage.fill('#login-password', TEST_USERS[1].password);
      await bobPage.getByRole('button', { name: /sign in/i }).click();
      await bobPage.waitForTimeout(2000);

      // Charlie
      await charliePage.goto('/');
      await charliePage.getByRole('tab', { name: /sign in/i }).click();
      await charliePage.fill('#login-email', TEST_USERS[2].email);
      await charliePage.fill('#login-password', TEST_USERS[2].password);
      await charliePage.getByRole('button', { name: /sign in/i }).click();
      await charliePage.waitForTimeout(2000);

      // All navigate to groups page
      await alicePage.goto('/groups');
      await bobPage.goto('/groups');
      await charliePage.goto('/groups');
      await alicePage.waitForTimeout(1000);
      await bobPage.waitForTimeout(1000);
      await charliePage.waitForTimeout(1000);

      // Find "Design Team" group (Alice, Charlie, Diana from seed)
      console.log('Opening Design Team group...');

      const findAndClickGroup = async (page: any, groupName: string) => {
        const groups = await page.locator('[class*="cursor-pointer"]').all();
        for (const group of groups) {
          const text = await group.textContent();
          if (text?.includes(groupName)) {
            await group.click();
            return true;
          }
        }
        return false;
      };

      await findAndClickGroup(alicePage, 'Design Team');
      await findAndClickGroup(charliePage, 'Design Team');

      await alicePage.waitForTimeout(1500);
      await charliePage.waitForTimeout(1500);

      // Verify connections
      await expect(alicePage.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
      await expect(charliePage.getByText(/connected/i)).toBeVisible({ timeout: 10000 });

      console.log('Both members connected to Design Team');

      // Alice sends a broadcast message
      const broadcastMessage = `Team update from Alice at ${Date.now()}`;
      console.log('Alice broadcasting:', broadcastMessage);

      const aliceInput = alicePage.getByPlaceholder(/type a message/i);
      await aliceInput.fill(broadcastMessage);
      await aliceInput.press('Enter');
      await alicePage.waitForTimeout(1000);

      // Verify both Alice and Charlie see the message
      await expect(alicePage.getByText(broadcastMessage)).toBeVisible({ timeout: 5000 });
      await expect(charliePage.getByText(broadcastMessage)).toBeVisible({ timeout: 10000 });

      console.log('Broadcast received by all group members!');

    } finally {
      // Cleanup
      await alicePage.close();
      await bobPage.close();
      await charliePage.close();
      await aliceContext.close();
      await bobContext.close();
      await charlieContext.close();
    }
  });
});

/**
 * Test scenarios for structural typing:
 *
 * 1. Document → Project transformation:
 *    - Create a document node
 *    - Add TODO_FIELD children
 *    - Verify it displays as a project
 *
 * 2. Document → Chat transformation:
 *    - Create a document node
 *    - Add PERSON_FIELD children (users)
 *    - Add COMMENT_FIELD children (messages)
 *    - Verify it displays as a chat room
 *
 * 3. Nested groups:
 *    - Create group A
 *    - Create group B
 *    - Add group B as GROUP_FIELD child of group A
 *    - Verify event propagation works
 *
 * 4. Event propagation:
 *    - Send message in group
 *    - Verify all PERSON_FIELD members receive it
 *    - Verify nested GROUP_FIELD members receive it
 */
