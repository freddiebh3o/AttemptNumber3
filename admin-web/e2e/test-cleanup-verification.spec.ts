// Temporary test to verify cleanup happens on failure
import { test, expect, type Page } from '@playwright/test';

const TEST_USER = { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' };

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByLabel(/tenant/i).fill(TEST_USER.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(`/${TEST_USER.tenant}/products`);
  await page.waitForTimeout(500);
}

async function getRoleId(page: Page): Promise<string> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const response = await page.request.get(`${apiUrl}/api/roles`, {
    headers: { 'Cookie': cookieHeader },
  });
  const data = await response.json();
  return data.data.items[0].id; // Just get first role
}

async function createRule(page: Page, roleId: string, name: string): Promise<string> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const response = await page.request.post(`${apiUrl}/api/transfer-approval-rules`, {
    data: {
      name,
      description: 'Test cleanup verification',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 999,
      conditions: [{ conditionType: 'TOTAL_QTY_THRESHOLD', threshold: 50 }],
      levels: [{ level: 1, name: 'Test', requiredRoleId: roleId }],
    },
    headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  return data.data.id;
}

async function deleteRule(page: Page, ruleId: string): Promise<void> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  await page.request.delete(`${apiUrl}/api/transfer-approval-rules/${ruleId}`, {
    headers: { 'Cookie': cookieHeader },
  });
  console.log(`✅ Cleanup executed for rule: ${ruleId}`);
}

test.skip('VERIFY CLEANUP: should cleanup even when test fails', async ({ page }) => {
  await signIn(page);
  const roleId = await getRoleId(page);
  const ruleName = `Cleanup Test ${Date.now()}`;
  const ruleId = await createRule(page, roleId, ruleName);
  
  console.log(`📝 Created test rule: ${ruleId} - "${ruleName}"`);
  
  try {
    // Intentionally fail the test
    expect(true).toBe(false); // This will fail
  } finally {
    // This should still execute
    await deleteRule(page, ruleId);
  }
});
