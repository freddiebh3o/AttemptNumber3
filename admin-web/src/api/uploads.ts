// admin-web/src/api/uploads.ts
import { httpRequestMultipart } from "./http";
import type { paths } from "../types/openapi";

// POST /api/tenants/{tenantSlug}/logo
type UploadTenantLogo200 =
  paths["/api/tenants/{tenantSlug}/logo"]["post"]["responses"]["200"]["content"]["application/json"];

export async function uploadTenantLogoApiRequest(params: { tenantSlug: string; file: File }) {
  const form = new FormData();
  form.append("file", params.file, params.file.name);
  return httpRequestMultipart<UploadTenantLogo200>(`/api/tenants/${params.tenantSlug}/logo`, {
    method: "POST",
    body: form,
  });
}

// POST /api/uploads/images (generic)
type UploadImage200 =
  paths["/api/uploads/images"]["post"]["responses"]["201"]["content"]["application/json"];

export async function uploadImageApiRequest(params: { file: File; kind?: "tenantLogo" | "product" | "other" }) {
  const form = new FormData();
  form.append("file", params.file, params.file.name);
  if (params.kind) form.append("kind", params.kind);
  return httpRequestMultipart<UploadImage200>(`/api/uploads/images`, {
    method: "POST",
    body: form,
  });
}
