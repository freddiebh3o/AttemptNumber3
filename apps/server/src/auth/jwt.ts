// apps/server/src/auth/jwt.ts
import { SignJWT, jwtVerify } from "jose";

export type TokenPayload = {
  sub: string;                // user id
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: "OWNER" | "ADMIN" | "EDITOR";
  iat?: number;
  exp?: number;
};

const alg = "HS256";
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "insecure-dev-key");

export async function signAuthToken(payload: Omit<TokenPayload, "iat" | "exp">, expiresIn = "1h") {
  return await new SignJWT(payload as TokenPayload)
    .setProtectedHeader({ alg })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyAuthToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret, { algorithms: [alg] });
  // Basic shape guard
  if (!payload.sub || !payload.tenantId || !payload.tenantSlug || !payload.email || !payload.role) {
    throw new Error("Invalid token payload");
  }
  return payload as TokenPayload;
}
