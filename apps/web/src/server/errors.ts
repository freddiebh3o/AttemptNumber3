export class HttpError extends Error {
  status: number; code: string; details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}
export const BadRequest = (msg="Bad request", details?:unknown)=> new HttpError(400,"BAD_REQUEST",msg,details);
export const Unauthorized = (msg="Unauthorized")=> new HttpError(401,"UNAUTHORIZED",msg);
export const Forbidden = (msg="Forbidden")=> new HttpError(403,"FORBIDDEN",msg);
export const NotFound = (msg="Not found")=> new HttpError(404,"NOT_FOUND",msg);
