// admin-web/src/api/auth.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// Types from your OpenAPI spec
type SignInRequestBody = NonNullable<
  paths["/api/auth/sign-in"]["post"]["requestBody"]
>["content"]["application/json"];
type SignIn200Response =
  paths["/api/auth/sign-in"]["post"]["responses"]["200"]["content"]["application/json"];

type SignOut200Response =
  paths["/api/auth/sign-out"]["post"]["responses"]["200"]["content"]["application/json"];

type Me200Response =
  paths["/api/auth/me"]["get"]["responses"]["200"]["content"]["application/json"];

// NOTE: /api/auth/switch-tenant is not yet in the spec; keep manual types for now.
type SwitchTenantRequestBody = NonNullable<
  paths["/api/auth/switch-tenant"]["post"]["requestBody"]
>["content"]["application/json"];
type SwitchTenant200Response =
  paths["/api/auth/switch-tenant"]["post"]["responses"]["200"]["content"]["application/json"];

export async function signInApiRequest(body: SignInRequestBody) {
  return httpRequestJson<SignIn200Response>("/api/auth/sign-in", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function signOutApiRequest() {
  return httpRequestJson<SignOut200Response>("/api/auth/sign-out", {
    method: "POST",
  });
}

export async function meApiRequest() {
  return httpRequestJson<Me200Response>("/api/auth/me", { method: "GET" });
}

export async function switchTenantApiRequest(body: SwitchTenantRequestBody) {
  return httpRequestJson<SwitchTenant200Response>("/api/auth/switch-tenant", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
