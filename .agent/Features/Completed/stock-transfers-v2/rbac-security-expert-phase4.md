# Phase 4: Reports Permission Implementation

**Agent:** rbac-security-expert
**Date:** 2025-10-14
**Feature:** Stock Transfers V2 - Phase 4 (Analytics Dashboard)
**Status:** Complete

---

## Context

Implemented RBAC permission `reports:view` for the Transfer Analytics Dashboard feature as part of Stock Transfers V2 Phase 4 enhancements.

**Related Documents:**
- PRD: `.agent/Features/InProgress/stock-transfers-v2/prd.md` (Lines 1076-1316 - Enhancement #9)
- RBAC System: `.agent/System/rbac-system.md`
- Database Schema: `.agent/Agents/database-expert/work/phase4-analytics-schema-2025-10-14.md`
- RBAC Catalog: `api-server/src/rbac/catalog.ts`

**Request:** Add new `reports:view` permission to allow OWNER and ADMIN roles to access the Transfer Analytics Dashboard at `/:tenantSlug/stock-transfers/analytics`.

---

## Task Description

Added a new global permission `reports:view` to the RBAC catalog for controlling access to analytics reports and dashboards. This permission is required for viewing the Transfer Analytics Dashboard, which provides managers with insights into transfer patterns, bottlenecks, and branch dependencies.

**Permission Key:** `reports:view`
**Description:** View analytics reports and dashboards
**Usage:** Required to access Transfer Analytics Dashboard and future reporting features

---

## Changes Made

### 1. Added Permission to Catalog

**File:** `api-server/src/rbac/catalog.ts`

**Added to PERMISSIONS array (line 23-24):**
```typescript
// Reports & Analytics
{ key: 'reports:view',    description: 'View analytics reports and dashboards' },
```

**Rationale:**
- Follows existing naming convention: `<resource>:<action>` format
- Grouped under "Reports & Analytics" section for clarity
- Generic enough to apply to future reporting features beyond stock transfers
- Description clearly indicates purpose (viewing analytics)

### 2. Updated Role Definitions

**File:** `api-server/src/rbac/catalog.ts`

**OWNER Role (lines 34-40):**
```typescript
OWNER: [
  'products:read','products:write',
  'users:manage','roles:manage','tenant:manage',
  'theme:manage','uploads:write',
  'branches:manage','stock:read','stock:write','stock:allocate',
  'reports:view', // ← Added
],
```

**ADMIN Role (lines 41-47):**
```typescript
ADMIN: [
  'products:read','products:write',
  'users:manage',
  'theme:manage','uploads:write',
  'branches:manage','stock:read','stock:write','stock:allocate',
  'reports:view', // ← Added
],
```

**EDITOR Role (unchanged - no reports:view):**
```typescript
EDITOR: [
  'products:read','products:write','uploads:write',
  'stock:read','stock:allocate',
],
```

**VIEWER Role (unchanged - no reports:view):**
```typescript
VIEWER: [
  'products:read',
  'stock:read',
],
```

---

## Key Decisions

### 1. Permission Naming

**Decision:** Use `reports:view` instead of `analytics:view` or `stock-analytics:view`

**Rationale:**
- **Generic scope:** "reports" is broader than "analytics" and can apply to future non-analytics reports (e.g., inventory reports, sales reports)
- **Consistency:** Matches existing verb pattern (`:view`, `:read`, `:write`, `:manage`)
- **Future-proof:** Avoids tying permission to specific feature (stock transfers)
- **Simplicity:** Single permission for all reporting features reduces complexity

**Alternatives considered:**
- `analytics:view` - Too narrow, doesn't cover non-analytics reports
- `stock-analytics:view` - Too specific to stock transfers
- `dashboards:view` - Doesn't cover tabular/exported reports

### 2. Role Assignments

**Decision:** Assign `reports:view` to OWNER and ADMIN only (not EDITOR or VIEWER)

**Rationale:**

**OWNER:**
- Needs full visibility into business metrics
- Responsible for strategic decisions based on analytics
- Has access to all tenant data already
- Typical use case: CEO, founder, tenant owner

**ADMIN:**
- Day-to-day manager role requiring operational insights
- Needs analytics to optimize workflows and identify bottlenecks
- Makes tactical decisions based on transfer patterns
- Typical use case: Warehouse manager, operations director

**EDITOR (no access):**
- Focused on operational tasks (editing products, allocating stock)
- Does not need strategic/analytical insights
- May find analytics distracting from core duties
- Typical use case: Catalog manager, inventory clerk

**VIEWER (no access):**
- Read-only role with minimal permissions
- Should not have access to potentially sensitive business metrics
- Analytics could expose competitive/strategic information
- Typical use case: External stakeholder, accountant, auditor

**Business Justification:**
- Analytics dashboards are management tools, not operational tools
- Transfer velocity metrics, branch dependencies, and bottlenecks are strategic data
- EDITOR and VIEWER roles are execution-focused, not analysis-focused
- Aligns with principle of least privilege (minimal permissions by default)

### 3. Permission Scope

**Decision:** Single permission for all reports/analytics (not separate permissions per dashboard)

**Rationale:**
- **Simplicity:** Easier to manage and understand
- **User experience:** Users with analytics access expect to see all available reports
- **Low risk:** Analytics data is read-only and scoped to tenant (no cross-tenant exposure)
- **Future scalability:** Adding new dashboards doesn't require new permissions

**Future consideration:** If specific reports contain highly sensitive data (e.g., profitability, cost analysis), we can add granular permissions later (e.g., `reports:financial`, `reports:operations`).

---

## Permission Matrix

| Role | products:read | products:write | stock:read | stock:write | reports:view |
|------|---------------|----------------|------------|-------------|--------------|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **EDITOR** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **VIEWER** | ✅ | ❌ | ✅ | ❌ | ❌ |

**Summary:**
- 2 roles have `reports:view` (OWNER, ADMIN)
- 2 roles do NOT have `reports:view` (EDITOR, VIEWER)

---

## Security Considerations

### 1. Multi-Tenant Isolation

**Risk:** Analytics dashboard could expose cross-tenant data if not properly filtered.

**Mitigation:**
- All analytics queries MUST filter by `req.currentTenantId`
- Analytics endpoints MUST use `requireAuthenticatedUserMiddleware` to ensure tenant context
- Database-expert has already scoped `TransferMetrics` and `TransferRouteMetrics` tables by `tenantId`

**Example backend enforcement:**
```typescript
router.get(
  '/analytics/overview',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'), // ← Enforces permission
  getAnalyticsOverview
);

async function getAnalyticsOverview(req: Request) {
  const { currentTenantId } = req;

  // Always filter by tenant
  const metrics = await prisma.transferMetrics.findMany({
    where: { tenantId: currentTenantId }, // ← Tenant isolation
  });

  return metrics;
}
```

### 2. Sensitive Business Metrics

**Risk:** Analytics dashboards expose business metrics (transfer volume, bottlenecks, costs) that could be sensitive.

**Mitigation:**
- EDITOR and VIEWER roles intentionally excluded from `reports:view`
- Only management roles (OWNER, ADMIN) have access
- Audit trail will log who views analytics dashboards (future: `ANALYTICS_VIEW` audit action)

**Future enhancement:** Add audit logging for analytics access:
```typescript
await auditService.logEvent({
  action: 'ANALYTICS_VIEW',
  entityType: 'ANALYTICS_DASHBOARD',
  entityId: 'transfer-analytics',
  userId: req.currentUserId,
  tenantId: req.currentTenantId,
});
```

### 3. Frontend-Backend Consistency

**Risk:** Frontend shows analytics dashboard but backend denies access (confusing UX).

**Mitigation:**
- Frontend route MUST use `<RequirePermission perm="reports:view">` wrapper
- Sidebar link MUST check `hasPerm('reports:view')` before showing
- If permission removed from user mid-session, backend will reject API calls with 403

**Example frontend enforcement:**
```tsx
// Route protection (main.tsx)
{
  path: 'stock-transfers/analytics',
  element: (
    <RequirePermission perm="reports:view">
      <TransferAnalyticsPage />
    </RequirePermission>
  ),
}

// Sidebar link (SidebarNav.tsx)
{hasPerm('reports:view') && (
  <NavLink to="stock-transfers/analytics">
    <IconChartBar size={20} />
    <span>Analytics</span>
  </NavLink>
)}
```

### 4. Custom Roles

**Risk:** Tenant creates custom role and grants `reports:view` to inappropriate users.

**Mitigation:**
- This is acceptable tenant behavior (tenant controls their own roles)
- System roles (OWNER, ADMIN, EDITOR, VIEWER) are immutable and cannot be modified
- Custom roles are tenant-scoped and only affect that tenant
- If tenant grants `reports:view` to custom role, it's their decision

---

## Testing Notes

### Seeding the Permission

**Command to seed permission to database:**
```bash
cd api-server
npm run seed:rbac
```

**Expected output:**
```
--- Seeding RBAC permissions and roles ---
Syncing permissions...
✓ Upserted permission: products:read
✓ Upserted permission: products:write
...
✓ Upserted permission: reports:view  ← New permission
Syncing roles for tenant: acme
✓ Role OWNER has 12 permissions (including reports:view)
✓ Role ADMIN has 10 permissions (including reports:view)
✓ Role EDITOR has 5 permissions (no reports:view)
✓ Role VIEWER has 2 permissions (no reports:view)
```

### Verification Queries

**SQL to verify permission exists:**
```sql
SELECT * FROM "Permission" WHERE key = 'reports:view';
```

**Expected result:**
| id | key | description |
|---|---|---|
| perm_xxx | reports:view | View analytics reports and dashboards |

**SQL to verify role assignments:**
```sql
SELECT r.name, COUNT(rp.permissionId) AS permission_count
FROM "Role" r
JOIN "RolePermission" rp ON r.id = rp.roleId
WHERE r.isSystem = true
GROUP BY r.name;
```

**Expected result (ACME tenant):**
| name | permission_count |
|---|---|
| OWNER | 12 |
| ADMIN | 10 |
| EDITOR | 5 |
| VIEWER | 2 |

**SQL to verify OWNER/ADMIN have reports:view:**
```sql
SELECT r.name AS role, p.key AS permission
FROM "Role" r
JOIN "RolePermission" rp ON r.id = rp.roleId
JOIN "Permission" p ON rp.permissionId = p.id
WHERE r.isSystem = true AND p.key = 'reports:view'
ORDER BY r.name;
```

**Expected result:**
| role | permission |
|---|---|
| ADMIN | reports:view |
| OWNER | reports:view |

### Manual Testing

**1. Test OWNER access:**
```bash
# Sign in as owner@acme.test
# Navigate to /:tenantSlug/stock-transfers/analytics
# Expected: Page loads successfully
# Expected: API calls return analytics data (200 OK)
```

**2. Test ADMIN access:**
```bash
# Sign in as admin@acme.test
# Navigate to /:tenantSlug/stock-transfers/analytics
# Expected: Page loads successfully
# Expected: API calls return analytics data (200 OK)
```

**3. Test EDITOR access (should fail):**
```bash
# Sign in as editor@acme.test
# Navigate to /:tenantSlug/stock-transfers/analytics
# Expected: "You don't have permission to view this section" error
# Expected: API calls return 403 Forbidden
```

**4. Test VIEWER access (should fail):**
```bash
# Sign in as viewer@acme.test
# Navigate to /:tenantSlug/stock-transfers/analytics
# Expected: "You don't have permission to view this section" error
# Expected: API calls return 403 Forbidden
```

### Testing with Different Roles

**Test users from seed data (tenant: acme):**
- `owner@acme.test` / `Password123!` - Has `reports:view` ✅
- `admin@acme.test` / `Password123!` - Has `reports:view` ✅
- `editor@acme.test` / `Password123!` - No `reports:view` ❌
- `viewer@acme.test` / `Password123!` - No `reports:view` ❌

**Testing checklist:**
- [ ] OWNER can access analytics dashboard
- [ ] ADMIN can access analytics dashboard
- [ ] EDITOR cannot access analytics dashboard (403 error)
- [ ] VIEWER cannot access analytics dashboard (403 error)
- [ ] Analytics link hidden from sidebar for EDITOR/VIEWER
- [ ] API endpoints return 403 for users without `reports:view`

---

## Next Steps

### For backend-api-expert (Implementation)

**Backend Implementation:**

1. **Create Analytics Router:**
   - File: `api-server/src/routes/transferAnalyticsRouter.ts`
   - Mount at: `/api/stock-transfers/analytics`

2. **Add Permission Checks to All Analytics Endpoints:**
   ```typescript
   import { requirePermission } from '../middleware/permissionMiddleware.js';

   router.get(
     '/overview',
     requireAuthenticatedUserMiddleware,
     requirePermission('reports:view'), // ← Enforce permission
     getAnalyticsOverview
   );

   router.get(
     '/volume-chart',
     requireAuthenticatedUserMiddleware,
     requirePermission('reports:view'), // ← Enforce permission
     getVolumeChart
   );

   // Repeat for all 7 analytics endpoints
   ```

3. **Analytics Endpoints to Implement:**
   - `GET /analytics/overview` - Top metrics cards
   - `GET /analytics/volume-chart` - Transfer volume over time
   - `GET /analytics/branch-dependencies` - Branch dependency graph
   - `GET /analytics/top-routes` - Top transfer routes
   - `GET /analytics/status-distribution` - Status pie chart
   - `GET /analytics/bottlenecks` - Bottleneck analysis
   - `GET /analytics/product-frequency` - Product transfer frequency

4. **Service Layer:**
   - Create `api-server/src/services/analytics/transferAnalyticsService.ts`
   - Implement aggregation queries using `TransferMetrics` and `TransferRouteMetrics` tables
   - Always filter by `tenantId`

5. **OpenAPI Schemas:**
   - Create `api-server/src/openapi/paths/transferAnalytics.ts`
   - Define request/response schemas for all 7 endpoints
   - Register in `api-server/src/openapi/index.ts`

**Important:**
- All analytics queries MUST filter by `req.currentTenantId`
- Use `requirePermission('reports:view')` middleware on ALL analytics endpoints
- Return 403 Forbidden if user lacks permission

### For frontend-expert (UI Implementation)

**Frontend Implementation:**

1. **Create Analytics Page:**
   - File: `admin-web/src/pages/TransferAnalyticsPage.tsx`
   - Route: `/:tenantSlug/stock-transfers/analytics`
   - Wrap in `<RequirePermission perm="reports:view">`

2. **Add Route Protection:**
   ```tsx
   // main.tsx
   {
     path: 'stock-transfers/analytics',
     element: (
       <RequirePermission perm="reports:view">
         <TransferAnalyticsPage />
       </RequirePermission>
     ),
   }
   ```

3. **Add Sidebar Navigation:**
   ```tsx
   // SidebarNav.tsx
   {hasPerm('reports:view') && (
     <NavLink to={`/${currentTenantSlug}/stock-transfers/analytics`}>
       <IconChartBar size={20} />
       <span>Analytics</span>
     </NavLink>
   )}
   ```

4. **Analytics Components:**
   - `TransferMetricsCards.tsx` - Overview cards (total transfers, active, avg times)
   - `TransferVolumeChart.tsx` - Line chart (Recharts)
   - `BranchDependencyGraph.tsx` - Network graph or table
   - `TopRoutesTable.tsx` - Sortable table
   - `StatusDistributionChart.tsx` - Pie chart (Recharts)
   - `BottleneckChart.tsx` - Bar chart (Recharts)
   - `ProductFrequencyTable.tsx` - Sortable table

5. **API Client:**
   - Create `admin-web/src/api/transferAnalytics.ts`
   - Implement API calls for all 7 endpoints
   - Use OpenAPI-generated types

6. **Permission-Based UI:**
   - Hide analytics link from sidebar if `!hasPerm('reports:view')`
   - Show permission denied message if user tries to access directly
   - Test with all 4 roles (OWNER, ADMIN, EDITOR, VIEWER)

**Important:**
- Always use `<RequirePermission perm="reports:view">` for route protection
- Check `hasPerm('reports:view')` before showing navigation links
- Handle 403 errors gracefully (show permission denied message)

### For test-engineer (Testing)

**Backend Unit Tests:**

1. **Permission Enforcement Tests:**
   ```typescript
   describe('GET /api/stock-transfers/analytics/overview', () => {
     it('should require reports:view permission', async () => {
       const viewer = await createTestUserWithRole('VIEWER');
       const session = createSessionCookie(viewer.id, tenant.id);

       const res = await request(app)
         .get('/api/stock-transfers/analytics/overview')
         .set('Cookie', session)
         .expect(403);

       expect(res.body.error.errorCode).toBe('PERMISSION_DENIED');
     });

     it('should allow OWNER to access analytics', async () => {
       const owner = await createTestUserWithRole('OWNER');
       const session = createSessionCookie(owner.id, tenant.id);

       const res = await request(app)
         .get('/api/stock-transfers/analytics/overview')
         .set('Cookie', session)
         .expect(200);

       expect(res.body.success).toBe(true);
     });

     it('should allow ADMIN to access analytics', async () => {
       const admin = await createTestUserWithRole('ADMIN');
       const session = createSessionCookie(admin.id, tenant.id);

       const res = await request(app)
         .get('/api/stock-transfers/analytics/overview')
         .set('Cookie', session)
         .expect(200);

       expect(res.body.success).toBe(true);
     });
   });
   ```

2. **Multi-Tenant Isolation Tests:**
   ```typescript
   it('should only return analytics for current tenant', async () => {
     const tenant1 = await createTestTenant('Tenant 1');
     const tenant2 = await createTestTenant('Tenant 2');

     // Seed metrics for both tenants
     await seedMetrics(tenant1.id, { transfersCreated: 10 });
     await seedMetrics(tenant2.id, { transfersCreated: 20 });

     const owner1 = await createTestUserWithRole('OWNER', tenant1.id);
     const session1 = createSessionCookie(owner1.id, tenant1.id);

     const res = await request(app)
       .get('/api/stock-transfers/analytics/overview')
       .set('Cookie', session1)
       .expect(200);

     // Should only see tenant1 metrics
     expect(res.body.data.transfersCreated).toBe(10);
   });
   ```

**E2E Tests:**

1. **Permission-Based Access Tests:**
   ```typescript
   test('OWNER can access analytics dashboard', async ({ page }) => {
     await signIn(page, TEST_USERS.owner);

     await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics`);
     await expect(page).toHaveURL(/\/analytics/);
     await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
   });

   test('ADMIN can access analytics dashboard', async ({ page }) => {
     await signIn(page, TEST_USERS.admin);

     await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers/analytics`);
     await expect(page).toHaveURL(/\/analytics/);
     await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
   });

   test('EDITOR cannot access analytics dashboard', async ({ page }) => {
     await signIn(page, TEST_USERS.editor);

     await page.goto(`/${TEST_USERS.editor.tenant}/stock-transfers/analytics`);

     // Should show permission denied
     await expect(page.getByRole('alert')).toContainText(/permission/i);
     await expect(page.getByRole('heading', { name: /analytics/i })).not.toBeVisible();
   });

   test('VIEWER cannot access analytics dashboard', async ({ page }) => {
     await signIn(page, TEST_USERS.viewer);

     await page.goto(`/${TEST_USERS.viewer.tenant}/stock-transfers/analytics`);

     // Should show permission denied
     await expect(page.getByRole('alert')).toContainText(/permission/i);
     await expect(page.getByRole('heading', { name: /analytics/i })).not.toBeVisible();
   });
   ```

2. **Navigation Link Visibility Tests:**
   ```typescript
   test('OWNER sees analytics link in sidebar', async ({ page }) => {
     await signIn(page, TEST_USERS.owner);

     const analyticsLink = page.getByRole('link', { name: /analytics/i });
     await expect(analyticsLink).toBeVisible();
   });

   test('EDITOR does not see analytics link in sidebar', async ({ page }) => {
     await signIn(page, TEST_USERS.editor);

     const analyticsLink = page.getByRole('link', { name: /analytics/i });
     await expect(analyticsLink).not.toBeVisible();
   });
   ```

---

## Blockers/Issues

**None.** Permission successfully added to catalog. Ready for backend and frontend implementation.

---

## References

### Documentation

- **PRD:** `.agent/Features/InProgress/stock-transfers-v2/prd.md` (Lines 1076-1316)
- **RBAC System:** `.agent/System/rbac-system.md`
- **Database Schema:** `.agent/Agents/database-expert/work/phase4-analytics-schema-2025-10-14.md`

### Code Files

- **RBAC Catalog:** `api-server/src/rbac/catalog.ts`
- **Permission Middleware:** `api-server/src/middleware/permissionMiddleware.ts`
- **Permission Seeding Script:** `api-server/src/rbac/seed.ts`

### Related Work

- **Phase 1 (Templates & Reversal):** Completed 2025-10-13
- **Phase 2 (Approval Delegation):** Completed 2025-10-13
- **Phase 3 (Barcode Scanning):** Completed 2025-10-14
- **Phase 4 (Database Schema):** Completed 2025-10-14 (database-expert)
- **Phase 4 (RBAC - This work):** Completed 2025-10-14 (rbac-security-expert)

---

## Summary

Successfully added `reports:view` permission to RBAC catalog for Transfer Analytics Dashboard access:

**Permission Added:**
- Key: `reports:view`
- Description: View analytics reports and dashboards
- Category: Reports & Analytics

**Role Assignments:**
- ✅ OWNER (has reports:view)
- ✅ ADMIN (has reports:view)
- ❌ EDITOR (no reports:view)
- ❌ VIEWER (no reports:view)

**Rationale:**
- Analytics dashboards are management tools for strategic decision-making
- OWNER and ADMIN roles need visibility into transfer patterns and bottlenecks
- EDITOR and VIEWER roles are execution-focused and do not need analytics access
- Follows principle of least privilege

**Security:**
- All analytics endpoints MUST enforce `requirePermission('reports:view')`
- All analytics queries MUST filter by `tenantId` for multi-tenant isolation
- Frontend MUST use `<RequirePermission perm="reports:view">` for route protection
- Sidebar links MUST check `hasPerm('reports:view')` before rendering

**Next Steps:**
- Run `npm run seed:rbac` to sync permission to database
- backend-api-expert: Implement analytics endpoints with permission checks
- frontend-expert: Implement analytics UI with permission guards
- test-engineer: Write permission enforcement tests

**Status:** Permission catalog updated, ready for implementation.

---

**End of Report**
