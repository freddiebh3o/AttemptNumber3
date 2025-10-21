// api-server/__tests__/features/theme/themeService.test.ts
import {
  getTenantThemeService,
  upsertTenantThemeService,
  upsertTenantLogoOnlyService,
} from '../../../src/services/theme/tenantThemeService.js';
import {
  createTestUser,
  createTestTenant,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

describe('[THEME-SVC] Tenant Theme Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
  });

  describe('getTenantThemeService - Get Tenant Theme', () => {
    it('should return default theme when no branding exists', async () => {
      const result = await getTenantThemeService(testTenant.id);

      expect(result).toBeDefined();
      expect(result.presetKey).toBeNull();
      expect(result.overrides).toEqual({});
      expect(result.logoUrl).toBeNull();
      expect(result.createdAt).toBeNull();
      expect(result.updatedAt).toBeNull();
    });

    it('should return existing theme with preset', async () => {
      // Create theme first
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'classicBlue',
        overrides: {},
        logoUrl: null,
      });

      const result = await getTenantThemeService(testTenant.id);

      expect(result.presetKey).toBe('classicBlue');
      expect(result.overrides).toEqual({});
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should return existing theme with overrides', async () => {
      const overrides = {
        primaryColor: 'blue',
        fontFamily: 'Arial',
      };

      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides,
        logoUrl: null,
      });

      const result = await getTenantThemeService(testTenant.id);

      expect(result.presetKey).toBeNull();
      expect(result.overrides).toEqual(overrides);
    });

    it('should return existing theme with logo URL', async () => {
      const logoUrl = 'https://example.com/logo.png';

      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: {},
        logoUrl,
      });

      const result = await getTenantThemeService(testTenant.id);

      expect(result.logoUrl).toBe(logoUrl);
    });
  });

  describe('upsertTenantThemeService - Upsert Tenant Theme', () => {
    it('should create new theme with preset', async () => {
      const result = await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'rubyDark',
        overrides: {},
        logoUrl: null,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result).toBeDefined();
      expect(result.presetKey).toBe('rubyDark');
      expect(result.overrides).toEqual({});
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create new theme with color overrides', async () => {
      const overrides = {
        primaryColor: 'emerald',
        primaryShade: 6,
        colors: {
          brand: ['#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b', '#00796b', '#00695c', '#004d40'],
        },
      };

      const result = await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides,
        logoUrl: null,
      });

      expect(result.overrides).toEqual(overrides);
    });

    it('should create new theme with logo URL', async () => {
      const logoUrl = 'https://storage.example.com/tenant-123/logo.png';

      const result = await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: {},
        logoUrl,
      });

      expect(result.logoUrl).toBe(logoUrl);
    });

    it('should update existing theme preset', async () => {
      // Create initial theme
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'oceanLight',
        overrides: {},
        logoUrl: null,
      });

      // Update preset
      const result = await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'violetLight',
        overrides: {},
        logoUrl: null,
      });

      expect(result.presetKey).toBe('violetLight');
    });

    it('should update existing theme overrides', async () => {
      const initialOverrides = { primaryColor: 'blue' };
      const updatedOverrides = { primaryColor: 'green', fontFamily: 'Roboto' };

      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: initialOverrides,
        logoUrl: null,
      });

      const result = await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: updatedOverrides,
        logoUrl: null,
      });

      expect(result.overrides).toEqual(updatedOverrides);
    });

    it('should reset theme to defaults when passing null values', async () => {
      // Create theme with values
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'grapeDark',
        overrides: { primaryColor: 'purple' },
        logoUrl: 'https://example.com/logo.png',
      });

      // Reset to defaults
      const result = await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: {},
        logoUrl: null,
      });

      expect(result.presetKey).toBeNull();
      expect(result.overrides).toEqual({});
      expect(result.logoUrl).toBeNull();
    });

    it('should create CREATE audit log entry for new theme', async () => {
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'tealDark',
        overrides: {},
        logoUrl: null,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: testTenant.id,
          entityType: 'TENANT_BRANDING',
          action: 'CREATE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
      expect(auditEntry?.tenantId).toBe(testTenant.id);
    });

    it('should create UPDATE audit log entry for existing theme', async () => {
      // Create initial theme
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'cyanLight',
        overrides: {},
        logoUrl: null,
        auditContextOptional: { actorUserId: testUser.id },
      });

      // Update theme
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'orangeLight',
        overrides: {},
        logoUrl: null,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const updateAudit = await prisma.auditEvent.findFirst({
        where: {
          entityId: testTenant.id,
          entityType: 'TENANT_BRANDING',
          action: 'UPDATE',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(updateAudit).toBeDefined();
      expect(updateAudit?.actorUserId).toBe(testUser.id);
    });

    it('should create THEME_UPDATE audit log when theme changes', async () => {
      // Create initial theme
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'limeLight',
        overrides: {},
        logoUrl: null,
        auditContextOptional: { actorUserId: testUser.id },
      });

      // Update theme (should trigger THEME_UPDATE)
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'pinkDark',
        overrides: {},
        logoUrl: null,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const themeUpdateAudit = await prisma.auditEvent.findFirst({
        where: {
          entityId: testTenant.id,
          entityType: 'TENANT_BRANDING',
          action: 'THEME_UPDATE',
        },
      });

      expect(themeUpdateAudit).toBeDefined();
    });

    it('should create THEME_LOGO_UPDATE audit log when logo changes', async () => {
      // Create initial theme
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: {},
        logoUrl: 'https://example.com/old-logo.png',
        auditContextOptional: { actorUserId: testUser.id },
      });

      // Update logo
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: null,
        overrides: {},
        logoUrl: 'https://example.com/new-logo.png',
        auditContextOptional: { actorUserId: testUser.id },
      });

      const logoUpdateAudit = await prisma.auditEvent.findFirst({
        where: {
          entityId: testTenant.id,
          entityType: 'TENANT_BRANDING',
          action: 'THEME_LOGO_UPDATE',
        },
      });

      expect(logoUpdateAudit).toBeDefined();
    });

    it('should persist theme in TenantBranding table', async () => {
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'yellowLight',
        overrides: { primaryColor: 'yellow' },
        logoUrl: 'https://example.com/logo.png',
      });

      const branding = await prisma.tenantBranding.findUnique({
        where: { tenantId: testTenant.id },
      });

      expect(branding).toBeDefined();
      expect(branding?.presetKey).toBe('yellowLight');
      expect(branding?.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should support multi-tenant isolation', async () => {
      const tenant2 = await createTestTenant();

      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'classicBlue',
        overrides: {},
        logoUrl: null,
      });

      await upsertTenantThemeService({
        tenantId: tenant2.id,
        presetKey: 'rubyDark',
        overrides: {},
        logoUrl: null,
      });

      const theme1 = await getTenantThemeService(testTenant.id);
      const theme2 = await getTenantThemeService(tenant2.id);

      expect(theme1.presetKey).toBe('classicBlue');
      expect(theme2.presetKey).toBe('rubyDark');
    });
  });

  describe('upsertTenantLogoOnlyService - Update Logo Only', () => {
    it('should update logo for existing theme', async () => {
      // Create initial theme
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'emeraldLight',
        overrides: {},
        logoUrl: null,
      });

      // Update logo only
      const result = await upsertTenantLogoOnlyService({
        tenantId: testTenant.id,
        logoUrl: 'https://storage.example.com/new-logo.png',
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.logoUrl).toBe('https://storage.example.com/new-logo.png');
      expect(result.presetKey).toBe('emeraldLight'); // Preset unchanged
    });

    it('should create theme with logo if none exists', async () => {
      const result = await upsertTenantLogoOnlyService({
        tenantId: testTenant.id,
        logoUrl: 'https://storage.example.com/logo.png',
      });

      expect(result.logoUrl).toBe('https://storage.example.com/logo.png');
      expect(result.presetKey).toBeNull();
      expect(result.overrides).toEqual({});
    });

    it('should preserve existing theme settings when updating logo', async () => {
      const overrides = { primaryColor: 'teal', fontFamily: 'Georgia' };

      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'tealDark',
        overrides,
        logoUrl: 'https://example.com/old-logo.png',
      });

      const result = await upsertTenantLogoOnlyService({
        tenantId: testTenant.id,
        logoUrl: 'https://example.com/new-logo.png',
      });

      expect(result.logoUrl).toBe('https://example.com/new-logo.png');
      expect(result.presetKey).toBe('tealDark');
      expect(result.overrides).toEqual(overrides);
    });

    it('should create audit log entries for logo update', async () => {
      await upsertTenantLogoOnlyService({
        tenantId: testTenant.id,
        logoUrl: 'https://storage.example.com/logo.png',
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: testTenant.id,
          entityType: 'TENANT_BRANDING',
          actorUserId: testUser.id,
        },
      });

      expect(auditEntries.length).toBeGreaterThan(0);

      const logoUpdateAudit = auditEntries.find(e => e.action === 'THEME_LOGO_UPDATE');
      expect(logoUpdateAudit).toBeDefined();
    });
  });
});
