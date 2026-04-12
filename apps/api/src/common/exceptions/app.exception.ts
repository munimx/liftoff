import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType, ErrorCodes } from '@liftoff/shared';

/**
 * Standardized application exception with strongly typed error code.
 */
export class AppException extends HttpException {
  public constructor(
    message: string,
    status: HttpStatus,
    private readonly errorCode: ErrorCodeType,
    private readonly details?: unknown,
  ) {
    super(
      {
        statusCode: status,
        error: HttpStatus[status],
        message,
        code: errorCode,
        ...(details !== undefined ? { details } : {}),
      },
      status,
    );
  }

  /**
   * Returns the exception error code.
   */
  public getErrorCode(): ErrorCodeType {
    return this.errorCode;
  }

  /**
   * Returns optional structured error details.
   */
  public getDetails(): unknown {
    return this.details;
  }
}

/**
 * Shared exception factories for common HTTP error responses.
 */
export const Exceptions = {
  notFound: (
    message = 'Resource not found',
    code: ErrorCodeType = ErrorCodes.NOT_FOUND,
  ): AppException => new AppException(message, HttpStatus.NOT_FOUND, code),
  forbidden: (
    message = 'Forbidden',
    code: ErrorCodeType = ErrorCodes.AUTH_FORBIDDEN,
  ): AppException => new AppException(message, HttpStatus.FORBIDDEN, code),
  badRequest: (
    message = 'Bad request',
    code: ErrorCodeType = ErrorCodes.VALIDATION_ERROR,
  ): AppException => new AppException(message, HttpStatus.BAD_REQUEST, code),
  conflict: (
    message = 'Conflict',
    code: ErrorCodeType = ErrorCodes.VALIDATION_ERROR,
  ): AppException => new AppException(message, HttpStatus.CONFLICT, code),
  unauthorized: (
    message = 'Unauthorized',
    code: ErrorCodeType = ErrorCodes.AUTH_UNAUTHORIZED,
  ): AppException => new AppException(message, HttpStatus.UNAUTHORIZED, code),
  internalError: (
    message = 'Internal server error',
    code: ErrorCodeType = ErrorCodes.INTERNAL_ERROR,
  ): AppException => new AppException(message, HttpStatus.INTERNAL_SERVER_ERROR, code),
};
