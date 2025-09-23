import { wrapRoute } from "@/server/wrapRoute";

export const GET = wrapRoute(async ({ correlationId }) => {
  return { ok: true, uptime: process.uptime(), ts: Date.now() };
});
