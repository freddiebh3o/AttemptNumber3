export type StandardSuccessResponse<DataType> = {
  success: true;
  data: DataType;
  error: null;
};

export type StandardErrorBody = {
  errorCode: string;
  httpStatusCode: number;
  userFacingMessage: string;
  developerMessage?: string;
  correlationId?: string | null;
};

export type StandardErrorResponse = {
  success: false;
  data: null;
  error: StandardErrorBody;
};

export function createStandardSuccessResponse<DataType>(
  responseData: DataType
): StandardSuccessResponse<DataType> {
  return { success: true, data: responseData, error: null };
}
