// api-server/src/utils/httpErrors.ts
export class HttpError extends Error {
  httpStatusCode: number;
  errorCode: string;
  userFacingMessage: string;
  developerMessage?: string | undefined;

  constructor(params: {
    httpStatusCode: number;
    errorCode: string;
    userFacingMessage: string;
    developerMessage?: string;
  }) {
    super(params.userFacingMessage);
    this.httpStatusCode = params.httpStatusCode;
    this.errorCode = params.errorCode;
    this.userFacingMessage = params.userFacingMessage;
    this.developerMessage = params.developerMessage;
  }
}

// Common factories
export const Errors = {
  validation(message = "One or more fields are invalid", dev?: string) {
    return new HttpError({
      httpStatusCode: 400,
      errorCode: "VALIDATION_ERROR",
      userFacingMessage: message,
      ...(dev !== undefined && { developerMessage: dev }),
    });
  },
  authRequired(userMsg = "Please sign in to continue.") {
    return new HttpError({
      httpStatusCode: 401,
      errorCode: "AUTH_REQUIRED",
      userFacingMessage: userMsg,
    });
  },
  permissionDenied() {
    return new HttpError({
      httpStatusCode: 403,
      errorCode: "PERMISSION_DENIED",
      userFacingMessage: "You do not have permission for this action.",
    });
  },
  cantDeleteLastOwner() {
    return new HttpError({
      httpStatusCode: 409,
      errorCode: "CANT_DELETE_LAST_OWNER",
      userFacingMessage: "You cannot delete the last owner of a tenant.",
    });
  },
  cantAssignOwnerRole() {
    return new HttpError({
      httpStatusCode: 403,
      errorCode: "CANT_ASSIGN_OWNER_ROLE",
      userFacingMessage: "Only OWNER users can assign the OWNER role to other users.",
      developerMessage: "Role assignment validation: current user must have OWNER role to assign OWNER role to others.",
    });
  },
  notFound(userMsg = "The requested resource was not found.") {
    return new HttpError({
      httpStatusCode: 404,
      errorCode: "RESOURCE_NOT_FOUND",
      userFacingMessage: userMsg,
    });
  },
  conflict(
    userMsg = "This action conflicts with the current state of the resource.",
    dev?: string
  ) {
    return new HttpError({
      httpStatusCode: 409,
      errorCode: "CONFLICT",
      userFacingMessage: userMsg,
      ...(dev !== undefined && { developerMessage: dev }),
    });
  },
  internal(dev?: string) {
    return new HttpError({
      httpStatusCode: 500,
      errorCode: "INTERNAL_ERROR",
      userFacingMessage: "Unexpected error occurred.",
      ...(dev !== undefined && { developerMessage: dev }),
    });
  },
};
