// api-server/src/openapi/index.ts
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Paths
import { registerTenantPaths } from './paths/tenants.js';
import { registerAuthPaths } from './paths/auth.js';
import { registerProductPaths } from './paths/products.js';
import { registerTenantUsersPaths } from './paths/tenantUsers.js';
import { registerSystemPaths } from './paths/system.js';
import { registerUploadPaths } from './paths/uploads.js';

export function buildOpenApiDocument() {
  // Register all feature paths
  registerAuthPaths(registry);
  registerProductPaths(registry);
  registerTenantUsersPaths(registry);
  registerTenantPaths(registry);
  registerSystemPaths(registry);
  registerUploadPaths(registry);

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const servers = [{ url: 'http://localhost:4000' }];
  if (process.env.NODE_ENV === 'production' && process.env.API_PUBLIC_URL) {
    servers.unshift({ url: process.env.API_PUBLIC_URL });
  }

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Multi-tenant Admin API (POC)',
      version: '0.0.1',
      description:
        'Simple, multi-tenant admin API. Responses use a standard success/error envelope. Auth is cookie-based session.',
    },
    servers,
    tags: [
      { name: 'Auth' },
      { name: 'System' },
      { name: 'TenantUsers' },
      { name: 'Tenants' },
      { name: 'Uploads' },
      { name: 'Products' },
    ],
  });
}
