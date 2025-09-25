// api-server/src/middleware/zodValidation.ts
import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { Errors } from "../utils/httpErrors.js";

export function validateRequestBodyWithZod<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parseResult = zodSchema.safeParse(request.body);
    if (!parseResult.success) {
      return next(
        Errors.validation("Invalid request body", parseResult.error.message)
      );
    }
    (request as any).validatedBody =
      parseResult.data as import("zod").infer<TSchema>;
    next();
  };
}

export function validateRequestQueryWithZod<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parseResult = zodSchema.safeParse(request.query);
    if (!parseResult.success) {
      return next(
        Errors.validation("Invalid query string", parseResult.error.message)
      );
    }
    (request as any).validatedQuery =
      parseResult.data as import("zod").infer<TSchema>;
    next();
  };
}

export function validateRequestParamsWithZod<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parseResult = zodSchema.safeParse(request.params);
    if (!parseResult.success) {
      return next(
        Errors.validation("Invalid route parameters", parseResult.error.message)
      );
    }
    (request as any).validatedParams =
      parseResult.data as import("zod").infer<TSchema>;
    next();
  };
}
