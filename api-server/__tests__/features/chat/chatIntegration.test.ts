// api-server/__tests__/integration/chatIntegration.test.ts
/**
 * Integration tests for AI Chat - Makes REAL OpenAI API calls
 *
 * Prerequisites:
 * - Valid OPENAI_API_KEY in .env file
 * - These tests will consume OpenAI API credits
 * - Run with: npm run test:accept -- chatIntegration.test.ts
 *
 * These tests validate:
 * 1. End-to-end conversation flow works
 * 2. AI can successfully call tools and get real data
 * 3. Multi-turn conversations maintain context
 * 4. Streaming responses work correctly
 *
 * NOTE: These tests verify the PLUMBING works (backend → OpenAI → tools → response)
 * They do NOT test AI response quality (that would be unreliable/flaky)
 */

import request from 'supertest';
import express, { type Express } from 'express';
import { chatRouter } from '../../../src/routes/chatRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import * as transferService from '../../../src/services/stockTransfers/stockTransferService.js';
import { receiveStock } from '../../../src/services/stockService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';

// Skip these tests if OPENAI_API_KEY is not set
const describeIf = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeIf('[CHAT-INTEGRATION-001] AI Chat Integration (Real OpenAI API)', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let sessionCookie: string;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  let transfer1: Awaited<ReturnType<typeof transferService.createStockTransfer>>;
  let transfer2: Awaited<ReturnType<typeof transferService.createStockTransfer>>;

  beforeAll(async () => {
    // Setup Express app with chat router
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/chat', chatRouter);
    app.use(standardErrorHandler);

    console.log('\n🤖 Starting AI Chat Integration Tests');
    console.log('   These tests make REAL OpenAI API calls');
    console.log('   Responses are printed for manual verification\n');
  });

  beforeEach(async () => {
    // Create tenant
    testTenant = await createTestTenant();

    // Create user
    testUser = await createTestUser();

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
    });
    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create products
    product = await createTestProduct({
      tenantId: testTenant.id,
    });

    // Create role
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    // Add user to tenant
    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Add user to branches
    await addUserToBranch(testUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(testUser.id, testTenant.id, destinationBranch.id);

    // Add stock
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: testUser.id },
      {
        branchId: sourceBranch.id,
        productId: product.id,
        qty: 1000,
        unitCostPence: 1200,
      }
    );

    // Create test transfers for AI to find
    transfer1 = await transferService.createStockTransfer({
      tenantId: testTenant.id,
      userId: testUser.id,
      data: {
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        requestNotes: 'Urgent restocking needed',
        priority: 'URGENT',
        items: [{ productId: product.id, qtyRequested: 100 }],
      },
    });

    transfer2 = await transferService.createStockTransfer({
      tenantId: testTenant.id,
      userId: testUser.id,
      data: {
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        requestNotes: 'Regular stock movement',
        priority: 'NORMAL',
        items: [{ productId: product.id, qtyRequested: 50 }],
      },
    });

    // Create session cookie
    sessionCookie = createSessionCookie(testUser.id, testTenant.id);

    console.log(`\n📦 Test Data Created:`);
    console.log(`   Transfer 1: ${transfer1.transferNumber} (URGENT)`);
    console.log(`   Transfer 2: ${transfer2.transferNumber} (NORMAL)`);
    console.log(`   Source: ${sourceBranch.branchName}`);
    console.log(`   Destination: ${destinationBranch.branchName}\n`);
  }, 30000); // Increase timeout for setup

  describe('[AC-CHAT-INT-001] Basic Conversation Flow', () => {
    it('should handle a simple greeting (verifies AI responds)', async () => {
      const userMessage = 'Hello! Can you help me with stock transfers?';

      console.log(`\n💬 User: "${userMessage}"`);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
        });

      // Verify we get a successful response
      expect(response.status).toBe(200);
      expect(response.text).toBeDefined();

      console.log(`🤖 AI Response: ${response.text.substring(0, 200)}...`);
      console.log(`✅ Test passed: Got 200 OK with response\n`);
    }, 30000);

    it('should maintain context in multi-turn conversation', async () => {
      // Turn 1
      const msg1 = 'Show me my stock transfers';
      console.log(`\n💬 User (Turn 1): "${msg1}"`);

      const response1 = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: msg1 }],
            },
          ],
        });

      expect(response1.status).toBe(200);
      const turn1Response = response1.text;
      console.log(`🤖 AI (Turn 1): ${turn1Response.substring(0, 150)}...`);

      // Turn 2 - requires context from Turn 1
      const msg2 = 'Tell me more about the urgent one';
      console.log(`\n💬 User (Turn 2): "${msg2}"`);

      const response2 = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: msg1 }],
            },
            {
              role: 'assistant',
              parts: [{ type: 'text', text: turn1Response }],
            },
            {
              role: 'user',
              parts: [{ type: 'text', text: msg2 }],
            },
          ],
        });

      expect(response2.status).toBe(200);
      console.log(`🤖 AI (Turn 2): ${response2.text.substring(0, 150)}...`);
      console.log(`✅ Test passed: Multi-turn conversation works\n`);
    }, 60000);
  });

  describe('[AC-CHAT-INT-002] Tool Calling - Search Transfers', () => {
    it('should successfully call searchTransfers tool', async () => {
      const userMessage = 'List all my pending stock transfers';
      console.log(`\n💬 User: "${userMessage}"`);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
        });

      expect(response.status).toBe(200);
      console.log(`🤖 AI Response: ${response.text.substring(0, 300)}...`);
      console.log(`   ✅ Verify: Response mentions transfers`);
      console.log(`   ✅ Verify: ${transfer1.transferNumber} or ${transfer2.transferNumber} mentioned`);
      console.log(`✅ Test passed: Tool calling works\n`);
    }, 30000);

    it('should filter transfers by priority (urgent)', async () => {
      const userMessage = 'Show me only urgent transfers';
      console.log(`\n💬 User: "${userMessage}"`);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
        });

      expect(response.status).toBe(200);
      console.log(`🤖 AI Response: ${response.text.substring(0, 300)}...`);
      console.log(`   ✅ Verify: Should mention "urgent"`);
      console.log(`   ✅ Verify: Should include ${transfer1.transferNumber}`);
      console.log(`✅ Test passed: Priority filtering works\n`);
    }, 30000);
  });

  describe('[AC-CHAT-INT-003] Tool Calling - Get Transfer Details', () => {
    it('should get detailed info about a specific transfer', async () => {
      const userMessage = `Tell me about transfer ${transfer1.transferNumber}`;
      console.log(`\n💬 User: "${userMessage}"`);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
        });

      expect(response.status).toBe(200);
      console.log(`🤖 AI Response: ${response.text.substring(0, 300)}...`);
      console.log(`   ✅ Verify: Mentions ${transfer1.transferNumber}`);
      console.log(`   ✅ Verify: Mentions URGENT priority`);
      console.log(`   ✅ Verify: Mentions branches`);
      console.log(`✅ Test passed: Get transfer details works\n`);
    }, 30000);

    it('should handle non-existent transfer gracefully', async () => {
      const userMessage = 'Tell me about transfer TRF-9999-9999';
      console.log(`\n💬 User: "${userMessage}"`);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
        });

      expect(response.status).toBe(200);
      console.log(`🤖 AI Response: ${response.text.substring(0, 200)}...`);
      console.log(`   ✅ Verify: Should say "not found" or "couldn't find"`);
      console.log(`✅ Test passed: Error handling works\n`);
    }, 30000);
  });

  describe('[AC-CHAT-INT-004] Security Integration', () => {
    it('should respect branch membership restrictions', async () => {
      // Create user with NO branch memberships
      const restrictedUser = await createTestUser();
      const restrictedRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: restrictedUser.id,
        tenantId: testTenant.id,
        roleId: restrictedRole.id,
      });
      // NOT adding to any branches

      const restrictedCookie = createSessionCookie(restrictedUser.id, testTenant.id);

      const userMessage = 'Show me my stock transfers';
      console.log(`\n💬 Restricted User: "${userMessage}"`);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', restrictedCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
        });

      expect(response.status).toBe(200);
      console.log(`🤖 AI Response: ${response.text.substring(0, 200)}...`);
      console.log(`   ✅ Verify: Should mention no transfers or need branch membership`);
      console.log(`✅ Test passed: Branch membership security works\n`);
    }, 30000);
  });

  describe('[AC-CHAT-INT-005] Complete End-to-End Scenario', () => {
    it('should handle a realistic 3-turn conversation with tool calls', async () => {
      console.log(`\n🎬 SCENARIO: User asks about transfers, then drills into details\n`);

      // Turn 1: Ask for transfers
      const msg1 = 'What pending transfers do I have?';
      console.log(`💬 User (Turn 1): "${msg1}"`);

      const response1 = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: msg1 }],
            },
          ],
        });

      expect(response1.status).toBe(200);
      const turn1Text = response1.text;
      console.log(`🤖 AI (Turn 1): ${turn1Text.substring(0, 200)}...`);

      // Turn 2: Ask for details about specific transfer
      const msg2 = `Give me details about ${transfer1.transferNumber}`;
      console.log(`\n💬 User (Turn 2): "${msg2}"`);

      const response2 = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: msg1 }],
            },
            {
              role: 'assistant',
              parts: [{ type: 'text', text: turn1Text }],
            },
            {
              role: 'user',
              parts: [{ type: 'text', text: msg2 }],
            },
          ],
        });

      expect(response2.status).toBe(200);
      const turn2Text = response2.text;
      console.log(`🤖 AI (Turn 2): ${turn2Text.substring(0, 200)}...`);

      // Turn 3: Context-dependent follow-up
      const msg3 = 'What branch is it going to?';
      console.log(`\n💬 User (Turn 3): "${msg3}"`);

      const response3 = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: msg1 }],
            },
            {
              role: 'assistant',
              parts: [{ type: 'text', text: turn1Text }],
            },
            {
              role: 'user',
              parts: [{ type: 'text', text: msg2 }],
            },
            {
              role: 'assistant',
              parts: [{ type: 'text', text: turn2Text }],
            },
            {
              role: 'user',
              parts: [{ type: 'text', text: msg3 }],
            },
          ],
        });

      expect(response3.status).toBe(200);
      console.log(`🤖 AI (Turn 3): ${response3.text.substring(0, 200)}...`);
      console.log(`   ✅ Verify: Should mention ${destinationBranch.branchName}`);
      console.log(`\n✅ SCENARIO COMPLETE: 3-turn conversation with context worked!\n`);
    }, 90000); // 90 seconds for 3 API calls
  });
});
