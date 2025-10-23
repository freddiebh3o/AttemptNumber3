// api-server/src/middleware/zodValidation.ts
import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { Errors } from "../utils/httpErrors.js";

/**
 * Extract a user-friendly validation error message from Zod errors
 */
function formatZodError(zodError: any): string {
  // Get the first error issue
  const firstIssue = zodError.issues?.[0];
  if (!firstIssue) {
    return "Invalid request body";
  }

  // If we have a custom message, use it
  if (firstIssue.message && firstIssue.message !== "Required") {
    return firstIssue.message;
  }

  // Otherwise, construct a message from the path and code
  const fieldPath = firstIssue.path?.join('.') || 'field';
  const code = firstIssue.code;

  if (code === 'invalid_type' && firstIssue.received === 'undefined') {
    return `${fieldPath} is required`;
  }

  return `Invalid ${fieldPath}`;
}

export function validateRequestBodyWithZod<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parseResult = zodSchema.safeParse(request.body);
    if (!parseResult.success) {
      const userMessage = formatZodError(parseResult.error);
      return next(
        Errors.validation(userMessage, parseResult.error.message)
      );
    }
    request.validatedBody = parseResult.data as import("zod").infer<TSchema>;
    next();
  };
}

export function validateRequestQueryWithZod<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parseResult = zodSchema.safeParse(request.query);
    if (!parseResult.success) {
      const userMessage = formatZodError(parseResult.error);
      return next(
        Errors.validation(userMessage, parseResult.error.message)
      );
    }
    request.validatedQuery = parseResult.data as import("zod").infer<TSchema>;
    next();
  };
}

export function validateRequestParamsWithZod<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parseResult = zodSchema.safeParse(request.params);
    if (!parseResult.success) {
      const userMessage = formatZodError(parseResult.error);
      return next(
        Errors.validation(userMessage, parseResult.error.message)
      );
    }
    request.validatedParams = parseResult.data as import("zod").infer<TSchema>;
    next();
  };
}
