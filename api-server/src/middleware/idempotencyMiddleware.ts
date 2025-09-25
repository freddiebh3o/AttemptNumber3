import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prismaClientInstance } from "../db/prismaClient.js";

// Generate a stable fingerprint for the request (method + path + body + user + tenant)
function createStableRequestFingerprintString(request: Request): string {
  const currentUserId: string | undefined = (request as any).currentUserId;
  const currentTenantId: string | undefined = (request as any).currentTenantId;
  const requestBodyValue =
    typeof request.body === "object"
      ? request.body
      : String(request.body ?? "");

  return JSON.stringify({
    httpMethod: request.method,
    originalUrl: request.originalUrl,
    requestBodyValue,
    currentUserId,
    currentTenantId,
  });
}

function createSha256HexDigest(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * For POST/PUT: if Idempotency-Key is present:
 *  - If a matching record (same key + same fingerprint) exists and not expired → return stored JSON immediately
 *  - Else wrap res.json to capture the outgoing body and store it before sending
 */
export function idempotencyMiddleware(requestTtlMinutes = 60) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const idempotencyKeyHeaderValue: string | undefined =
      request.header("Idempotency-Key") ||
      request.header("Idempotency-key") ||
      undefined;

    // Only apply to POST/PUT with a header
    if (
      !idempotencyKeyHeaderValue ||
      !["POST", "PUT", "DELETE"].includes(request.method)
    ) {
      return next();
    }

    const requestFingerprintString =
      createStableRequestFingerprintString(request);
    const requestFingerprintHashHex = createSha256HexDigest(
      requestFingerprintString
    );

    // Lookup existing
    const existing = await prismaClientInstance.idempotencyRecord.findUnique({
      where: { idempotencyKey: idempotencyKeyHeaderValue },
      select: {
        idempotencyKey: true,
        requestFingerprint: true,
        storedResponseJson: true,
        expiresAt: true,
      },
    });

    const now = new Date();
    if (
      existing &&
      existing.expiresAt > now &&
      existing.requestFingerprint === requestFingerprintHashHex
    ) {
      // Replay stored response (assume JSON envelope)
      return response.status(200).json(existing.storedResponseJson);
    }

    // Wrap res.json to capture the body we’re about to send
    const originalJson = response.json.bind(response);
    response.json = (body: any) => {
      // Store before sending (best-effort; ignore errors to not block the response)
      const expiresAt = new Date(Date.now() + requestTtlMinutes * 60 * 1000);
      prismaClientInstance.idempotencyRecord
        .upsert({
          where: { idempotencyKey: idempotencyKeyHeaderValue },
          create: {
            idempotencyKey: idempotencyKeyHeaderValue,
            requestFingerprint: requestFingerprintHashHex,
            storedResponseJson: body,
            expiresAt,
          },
          update: {
            requestFingerprint: requestFingerprintHashHex,
            storedResponseJson: body,
            expiresAt,
          },
        })
        .catch(() => {});

      return originalJson(body);
    };

    return next();
  };
}
