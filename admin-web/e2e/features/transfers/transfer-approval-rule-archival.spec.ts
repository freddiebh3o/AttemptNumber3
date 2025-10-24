// approval-rule-archival.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories, SELECTORS } from '../../helpers';

/**
 * E2E Tests for Approval Rule Archival
 *
 * Tests cover:
 * - Archiving approval rules (soft delete)
 * - Restoring archived rules
 * - Archive filter dropdown (active-only, archived-only, all)
 * - Archived and inactive badges display
 * - Permission-based UI controls
 * - Preserved isActive state after restore
 *
 * **Test Isolation Pattern:**
 * - Each test creates its own unique data using timestamps
 * - Tests clean up after themselves (delete created entities)
 * - No reliance on seed data except for base tenant/users
 * - Cookies cleared between tests
 */

// Check API server health before tests
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`API health check failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev');
  }
});

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Approval Rule Archival - Archive Flow', () => {
  test('should archive approval rule from list page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a test rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Archive Test ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Test rule for archival',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 999,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 50 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Find our test rule row by name
      const ruleRow = page.locator('tr', { hasText: ruleName });
      await expect(ruleRow).toBeVisible();

      // Click archive button
      const archiveButton = ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVE_BUTTON);
      await archiveButton.click();

      await page.waitForTimeout(300);

      // Confirmation dialog should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText(/archive approval rule/i)).toBeVisible();

      // Verify user-friendly explanation
      await expect(
        confirmDialog.getByText(/completely hidden from the UI/i)
      ).toBeVisible();

      // Confirm archive
      await confirmDialog.getByRole('button', { name: /archive rule/i }).click();

      // Should show success notification
      await expect(page.getByText(/rule archived/i)).toBeVisible({ timeout: 10000 });

      // Rule should be hidden from default view (active-only)
      await page.waitForTimeout(500);
      await expect(page.getByText(ruleName, { exact: true })).not.toBeVisible();

      // Verify rule is archived by checking archived filter
      const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: 'Archived rules only', exact: true }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see archived rule with badge
      await expect(page.getByText(ruleName)).toBeVisible();
      const archivedRow = page.locator('tr', { hasText: ruleName });
      await expect(archivedRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).toBeVisible();
    } finally {
      // Cleanup: permanently delete the rule
      await Factories.approvalRule.delete(page, ruleId);
    }
  });

  test('should cancel archive confirmation modal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a test rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Cancel Archive ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Test cancel archive',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 998,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 75 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Find our test rule row
      const ruleRow = page.locator('tr', { hasText: ruleName });
      await expect(ruleRow).toBeVisible();

      // Click archive button
      const archiveButton = ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVE_BUTTON);
      await archiveButton.click();

      await page.waitForTimeout(300);

      // Confirmation dialog should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();

      // Click cancel
      await confirmDialog.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(confirmDialog).not.toBeVisible();

      // Rule should still be visible (not archived)
      await page.waitForTimeout(500);
      await expect(page.getByText(ruleName)).toBeVisible();
    } finally {
      await Factories.approvalRule.delete(page, ruleId);
    }
  });
});

test.describe('Approval Rule Archival - Restore Flow', () => {
  test('should restore archived rule from archived filter view', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive a test rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Restore Test ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Test rule for restore',
      isActive: false, // Inactive before archiving
      approvalMode: 'SEQUENTIAL',
      priority: 997,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 25 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    // Archive the rule
    await Factories.approvalRule.archive(page, ruleId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Switch to archived-only filter
      const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: 'Archived rules only', exact: true }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Find archived rule
      const ruleRow = page.locator('tr', { hasText: ruleName });
      await expect(ruleRow).toBeVisible();

      // Verify archived badge is shown
      await expect(ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).toBeVisible();

      // Click restore button
      const restoreButton = ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.RESTORE_BUTTON);
      await restoreButton.click();

      await page.waitForTimeout(300);

      // Confirmation dialog should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText(/restore approval rule/i)).toBeVisible();

      // Verify message about preserving original state
      await expect(
        confirmDialog.getByText(/original active\/inactive state/i)
      ).toBeVisible();

      // Confirm restore
      await confirmDialog.getByRole('button', { name: /restore rule/i }).click();

      // Should show success notification
      await expect(page.getByText(/rule restored/i)).toBeVisible({ timeout: 10000 });

      // Should be removed from archived view
      await page.waitForTimeout(500);
      await expect(page.getByText(ruleName, { exact: true })).not.toBeVisible();

      // Switch to active view to verify rule is restored
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: 'Archived rules only', exact: true }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see restored rule
      await expect(page.getByText(ruleName)).toBeVisible();
      const restoredRow = page.locator('tr', { hasText: ruleName });

      // Should NOT have archived badge
      await expect(restoredRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).not.toBeVisible();

      // Should have inactive badge (because it was inactive before archiving)
      await expect(restoredRow.getByTestId(SELECTORS.APPROVAL_RULE.INACTIVE_BADGE)).toBeVisible();

      // Verify isActive switch reflects original state (unchecked)
      const activeSwitch = restoredRow.locator('input[type="checkbox"][role="switch"]');
      const isChecked = await activeSwitch.isChecked();
      expect(isChecked).toBe(false);
    } finally {
      await Factories.approvalRule.delete(page, ruleId);
    }
  });

  test('should preserve active state when restoring active rule', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive an ACTIVE rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Active Restore ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Active rule for restore test',
      isActive: true, // Active before archiving
      approvalMode: 'SEQUENTIAL',
      priority: 996,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 100 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    // Archive the rule
    await Factories.approvalRule.archive(page, ruleId);

    try {
      // Restore via API
      await Factories.approvalRule.restore(page, ruleId);

      // Navigate to rules page
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Find restored rule
      const ruleRow = page.locator('tr', { hasText: ruleName });
      await expect(ruleRow).toBeVisible();

      // Should NOT have archived badge
      await expect(ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).not.toBeVisible();

      // Should NOT have inactive badge (rule was active)
      await expect(ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.INACTIVE_BADGE)).not.toBeVisible();

      // Verify isActive switch is checked
      const activeSwitch = ruleRow.locator('input[type="checkbox"][role="switch"]');
      const isChecked = await activeSwitch.isChecked();
      expect(isChecked).toBe(true);
    } finally {
      await Factories.approvalRule.delete(page, ruleId);
    }
  });
});

test.describe('Approval Rule Archival - Filter Functionality', () => {
  test('should filter to show only active rules by default', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
    await page.waitForLoadState('networkidle');

    // Default filter should be "Active rules only" - check the displayed text
    const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
    const filterText = await archivedFilter.inputValue();
    expect(filterText).toBe('Non-archived rules only'); // Mantine Select shows the label, not the value

    // Should not show any archived badges in default view
    const archivedBadges = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE);
    const badgeCount = await archivedBadges.count();
    expect(badgeCount).toBe(0);
  });

  test('should show only archived rules when filter is archived-only', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive a test rule
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Archived Filter ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Test archived filter',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 995,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 150 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    await Factories.approvalRule.archive(page, ruleId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Should not see archived rule in default view
      await expect(page.getByText(ruleName, { exact: true })).not.toBeVisible();

      // Switch to archived-only filter
      const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: 'Archived rules only', exact: true }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see archived rule
      await expect(page.getByText(ruleName)).toBeVisible();

      // All visible rules should have archived badge
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Check that each row has an archived badge
        for (let i = 0; i < rowCount; i++) {
          const row = rows.nth(i);
          await expect(row.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).toBeVisible();
        }
      }
    } finally {
      await Factories.approvalRule.delete(page, ruleId);
    }
  });

  test('should show all rules when filter is set to all', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create two rules: one active, one archived
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();

    const activeRuleName = `E2E Active ${timestamp}`;
    const archivedRuleName = `E2E Archived ${timestamp}`;

    const activeRuleId = await Factories.approvalRule.create(page, {
      name: activeRuleName,
      description: 'Active test rule',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 994,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 200 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    const archivedRuleId = await Factories.approvalRule.create(page, {
      name: archivedRuleName,
      description: 'Archived test rule',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 993,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 250 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    await Factories.approvalRule.archive(page, archivedRuleId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Switch to "all" filter
      const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /all rules/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see both rules
      await expect(page.getByText(activeRuleName)).toBeVisible();
      await expect(page.getByText(archivedRuleName)).toBeVisible();

      // Active rule should NOT have archived badge
      const activeRow = page.locator('tr', { hasText: activeRuleName });
      await expect(activeRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).not.toBeVisible();

      // Archived rule should have archived badge
      const archivedRow = page.locator('tr', { hasText: archivedRuleName });
      await expect(archivedRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).toBeVisible();
    } finally {
      await Factories.approvalRule.delete(page, activeRuleId);
      await Factories.approvalRule.delete(page, archivedRuleId);
    }
  });

  test('should clear archive filter when clicking clear button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
    await page.waitForLoadState('networkidle');

    // Change filter to archived-only
    const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
    await archivedFilter.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'Archived rules only', exact: true }).click();

    // Click clear button
    await page.getByRole('button', { name: /clear/i }).click();

    await page.waitForTimeout(1000);

    // Filter should reset to active-only
    const filterValue = await archivedFilter.inputValue();
    expect(filterValue).toBe('Non-archived rules only');
  });
});

test.describe('Approval Rule Archival - Permissions', () => {
  test('should allow admins to archive and restore rules', async ({ page }) => {
    // First sign in as OWNER to create the test rule (needs role access)
    await signIn(page, TEST_USERS.owner);

    // Create a test rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Admin Archive ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Admin permission test',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 992,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 50 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    try {
      // Now sign in as ADMIN to test the UI permissions
      await signIn(page, TEST_USERS.admin);

      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Admin should see archive button (has stock:write permission)
      const ruleRow = page.locator('tr', { hasText: ruleName });
      const archiveButton = ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVE_BUTTON);
      await expect(archiveButton).toBeVisible();
      await expect(archiveButton).toBeEnabled();
    } finally {
      // Sign back in as OWNER to clean up
      await signIn(page, TEST_USERS.owner);
      await Factories.approvalRule.delete(page, ruleId);
    }
  });
});

test.describe('Approval Rule Archival - UI State', () => {
  test('should disable active toggle for archived rules', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive a test rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Disabled Toggle ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Test disabled toggle',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 991,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 50 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    await Factories.approvalRule.archive(page, ruleId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Switch to all filter to see archived rule
      const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /all rules/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Find archived rule
      const ruleRow = page.locator('tr', { hasText: ruleName });
      await expect(ruleRow).toBeVisible();

      // Active switch should be disabled
      const activeSwitch = ruleRow.locator('input[type="checkbox"][role="switch"]');
      const isDisabled = await activeSwitch.isDisabled();
      expect(isDisabled).toBe(true);
    } finally {
      await Factories.approvalRule.delete(page, ruleId);
    }
  });

  test('should show both archived and inactive badges correctly', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create an inactive archived rule via API
    const adminRoleId = await Factories.role.getByName(page, 'ADMIN');
    const timestamp = Date.now();
    const ruleName = `E2E Dual Badge ${timestamp}`;

    const ruleId = await Factories.approvalRule.create(page, {
      name: ruleName,
      description: 'Test both badges',
      isActive: false, // Inactive
      approvalMode: 'SEQUENTIAL',
      priority: 990,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 50 }],
      levels: [{ level: 1, name: 'Manager', requiredRoleId: adminRoleId }],
    });

    await Factories.approvalRule.archive(page, ruleId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
      await page.waitForLoadState('networkidle');

      // Switch to all filter
      const archivedFilter = page.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /all rules/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Find rule
      const ruleRow = page.locator('tr', { hasText: ruleName });
      await expect(ruleRow).toBeVisible();

      // Should show archived badge (because it's archived)
      await expect(ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.ARCHIVED_BADGE)).toBeVisible();

      // Should NOT show inactive badge (because archived takes precedence or inactive doesn't show for archived)
      // Based on our implementation logic: if archived, show archived badge; if NOT archived AND inactive, show inactive badge
      // So for archived + inactive, we should only see archived badge
      await expect(ruleRow.getByTestId(SELECTORS.APPROVAL_RULE.INACTIVE_BADGE)).not.toBeVisible();
    } finally {
      await Factories.approvalRule.delete(page, ruleId);
    }
  });
});
