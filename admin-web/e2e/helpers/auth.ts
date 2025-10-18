import { expect, type Page } from '@playwright/test';

/**
 * Test user credentials from api-server/prisma/seed.ts
 * These users are seeded in the database for testing purposes
 */
export const TEST_USERS = {
  owner: {
    email: 'owner@acme.test',
    password: 'Password123!',
    tenant: 'acme',
  },
  admin: {
    email: 'admin@acme.test',
    password: 'Password123!',
    tenant: 'acme',
  },
  editor: {
    email: 'editor@acme.test',
    password: 'Password123!',
    tenant: 'acme',
  },
  viewer: {
    email: 'viewer@acme.test',
    password: 'Password123!',
    tenant: 'acme',
  },
} as const;

export type TestUser = typeof TEST_USERS[keyof typeof TEST_USERS];

/**
 * Sign in a user and wait for redirect to products page
 *
 * @param page - Playwright page object
 * @param user - Test user credentials (from TEST_USERS)
 *
 * @example
 * ```typescript
 * import { signIn, TEST_USERS } from './helpers/auth';
 *
 * test('my test', async ({ page }) => {
 *   await signIn(page, TEST_USERS.owner);
 *   // ... rest of test
 * });
 * ```
 */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to products page
  await expect(page).toHaveURL(`/${user.tenant}/products`);
}

/**
 * Sign out the current user
 *
 * @param page - Playwright page object
 *
 * @example
 * ```typescript
 * import { signOut } from './helpers/auth';
 *
 * test('sign out test', async ({ page }) => {
 *   // ... after signing in
 *   await signOut(page);
 * });
 * ```
 */
export async function signOut(page: Page): Promise<void> {
  // Click sign out button in header (usually in user menu)
  await page.getByRole('button', { name: /sign out/i }).click();

  // Wait for redirect to sign-in page
  await expect(page).toHaveURL('/');
}

/**
 * Switch from one user to another (sign out, then sign in)
 *
 * @param page - Playwright page object
 * @param fromUser - Current user (used for validation)
 * @param toUser - User to switch to
 *
 * @example
 * ```typescript
 * import { switchUser, TEST_USERS } from './helpers/auth';
 *
 * test('switch user test', async ({ page }) => {
 *   await signIn(page, TEST_USERS.owner);
 *   // ... do something as owner
 *   await switchUser(page, TEST_USERS.owner, TEST_USERS.viewer);
 *   // ... do something as viewer
 * });
 * ```
 */
export async function switchUser(page: Page, fromUser: TestUser, toUser: TestUser): Promise<void> {
  await signOut(page);
  await signIn(page, toUser);
}
