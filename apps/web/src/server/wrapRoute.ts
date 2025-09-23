import { logger } from "./logging";
import { HttpError } from "./errors";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function correlationIdFrom(req: NextRequest) {
  const existing = req.headers.get("x-correlation-id");
  return existing ?? crypto.randomUUID();
}

type Options = {
  auth?: boolean;      // for Phase 1 we'll wire this
  tenant?: boolean;    // for Phase 1 we'll wire this
  schema?: z.ZodTypeAny; // for validating body/query
};

export function wrapRoute<TInput = unknown>(
  handler: (ctx: { req: NextRequest; input: TInput; correlationId: string }) => Promise<unknown>,
  opts: Options = {}
) {
  return async (req: NextRequest) => {
    const correlationId = correlationIdFrom(req);
    try {
      // parse body or query via zod when schema provided
      let input: any = undefined;
      if (opts.schema) {
        if (req.method === "GET") {
          const url = new URL(req.url);
          const params = Object.fromEntries(url.searchParams.entries());
          input = opts.schema.parse(params);
        } else {
          const json = await req.json().catch(() => ({}));
          input = opts.schema.parse(json);
        }
      }
      const data = await handler({ req, input, correlationId });
      return NextResponse.json({ success: true, data, meta: { correlationId } }, { status: 200, headers: { "x-correlation-id": correlationId } });
    } catch (err: any) {
      const e: HttpError =
        err instanceof HttpError
          ? err
          : err?.name === "ZodError"
          ? new HttpError(400, "INVALID_INPUT", "Invalid input", err.issues)
          : new HttpError(500, "INTERNAL_ERROR", "Something went wrong");
      logger.error({ correlationId, code: e.code, status: e.status, err }, e.message);
      return NextResponse.json(
        { success: false, error: { code: e.code, message: e.message }, meta: { correlationId } },
        { status: e.status, headers: { "x-correlation-id": correlationId } }
      );
    }
  };
}
