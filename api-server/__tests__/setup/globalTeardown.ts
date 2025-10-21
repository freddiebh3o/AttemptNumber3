// Global teardown for Jest tests
// Cleanup after all tests complete

export default async function globalTeardown() {
  console.log('✓ Tests complete');
  
  // Note: Docker database is left running for faster subsequent test runs
  // Run 'npm run db:test:down' to stop the database when done
}

