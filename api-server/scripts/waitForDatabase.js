/**
 * Wait for test database to be ready before running migrations/seeds
 * Uses the DATABASE_URL from .env.test
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import pg from 'pg';

// Load test environment
config({ path: resolve(process.cwd(), '.env.test') });

const maxRetries = 30;
const retryDelay = 1000; // 1 second

async function waitForDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.test');
    process.exit(1);
  }

  console.log('⏳ Waiting for test database to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      console.log('✓ Test database is ready!');
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ Failed to connect to test database after', maxRetries, 'attempts');
        console.error('Error:', error.message);
        process.exit(1);
      }
      
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

waitForDatabase();

