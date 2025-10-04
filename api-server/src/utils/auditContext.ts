// api-server/src/utils/auditContext.ts
export function getAuditContext(req: any) {
  const xf = req.headers?.["x-forwarded-for"];
  const first = Array.isArray(xf)
    ? xf[0]
    : typeof xf === "string"
    ? xf.split(",")[0]?.trim()
    : undefined;

  const ip: string | null = first ?? req.socket?.remoteAddress ?? null;
  const userAgent: string | null =
    (req.headers?.["user-agent"] as string | undefined) ?? null;

  return {
    // ⬇️ removed tenantId; not needed in ctx
    actorUserId: (req.currentUserId as string | undefined) ?? null,
    correlationId: (req.correlationId as string | undefined) ?? null,
    ip,
    userAgent,
  };
}