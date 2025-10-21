// Global setup for Jest tests
// Loads test environment variables before any tests run

import { config } from 'dotenv';
import { resolve } from 'path';

export default async function globalSetup() {
  // Load .env.test file
  const envPath = resolve(process.cwd(), '.env.test');
  config({ path: envPath });
  
  console.log('✓ Loaded test environment from .env.test');
  console.log('✓ Database URL:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@'));
  
  // Note: Database migrations are handled by db:test:setup script
  // Run 'npm run db:test:up && npm run db:test:migrate' before running tests
}

