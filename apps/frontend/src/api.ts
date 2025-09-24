// apps/frontend/src/api.ts
const API_BASE = "/api";

export type SessionUser = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "EDITOR";
  tenantId: string;
  tenantSlug: string;
};

type LoginResponse = { token: string; user: SessionUser };

const STORAGE_KEY = "mt-auth"; // saved per tenant inside object

function getStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function setStore(obj: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function setAuth(tenantSlug: string, auth: LoginResponse | null) {
  const s = getStore();
  if (auth) s[tenantSlug] = auth;
  else delete s[tenantSlug];
  setStore(s);
}

export function getAuth(tenantSlug: string): LoginResponse | null {
  const s = getStore();
  return s[tenantSlug] ?? null;
}

export async function apiFetch<T>(
  tenantSlug: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const auth = getAuth(tenantSlug);
  const headers: any = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;

  const res = await fetch(`${API_BASE}/t/${tenantSlug}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(tenantSlug: string, email: string, password: string) {
  const data = await apiFetch<LoginResponse>(tenantSlug, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    // No auth header here
    headers: { "Content-Type": "application/json" }
  });
  setAuth(tenantSlug, data);
  return data.user;
}
