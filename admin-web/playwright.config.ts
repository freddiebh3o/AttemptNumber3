import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * IMPORTANT: Before running E2E tests, ensure the API server is running with the E2E database:
 * 0. Stop dev server if running (E2E server uses same port 4000)
 * 1. Start E2E database: cd api-server && npm run db:e2e:reset
 * 2. Start API server with E2E config: cd api-server && npm run dev:e2e
 * 3. Run E2E tests: cd admin-web && npm run test:accept
 *
 * The E2E database runs on port 5434 (separate from Jest test DB on 5433)
 * The API server runs on port 4000 when using E2E config (same port as dev, but different database)
 *
 * Parallel Execution:
 * - Local: Uses CPU count (usually 4-8 workers)
 * - CI: Uses 4 workers for optimal performance
 * - Rate limiting is disabled in E2E environment to support parallel execution
 *
 * Sharding (for CI/CD):
 * - Set SHARD env var to split tests across machines
 * - Example: SHARD=1/4 npm run test:accept (runs 1st quarter of tests)
 */
export default defineConfig({
  testDir: './e2e',

  // Parallel execution enabled (Phase 3)
  fullyParallel: true,

  // Worker configuration (Phase 3: optimized for parallel execution)
  // Local: Use all available CPU cores for maximum speed
  // CI: Use 4 workers (balanced performance/resource usage)
  workers: process.env.CI ? 4 : undefined,

  // Fail fast if many tests are broken (Phase 3)
  maxFailures: process.env.CI ? 10 : undefined,

  // Retry configuration
  // CI: 2 retries to handle flakiness
  // Local: 1 retry (faster feedback, can re-run manually)
  retries: process.env.CI ? 2 : 1,

  // Test timeout per test (30 seconds)
  timeout: 30_000,

  forbidOnly: !!process.env.CI,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',

    // Action timeout (10 seconds for each action like click, fill, etc.)
    actionTimeout: 10_000,
  },

  // Sharding support (Phase 3)
  // Allows splitting tests across multiple machines in CI
  // Usage: SHARD=1/4 npm run test:accept
  ...(process.env.SHARD ? {
    shard: {
      current: parseInt(process.env.SHARD.split('/')[0]),
      total: parseInt(process.env.SHARD.split('/')[1]),
    }
  } : {}),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
