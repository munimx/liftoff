import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCodeType, ErrorCodes } from '@liftoff/shared';
import { AppException } from '../exceptions/app.exception';

type JsonResponse = {
  status(code: number): {
    json(body: unknown): void;
  };
};

type HttpRequestLike = {
  url?: string;
};

type ExceptionResponseShape = {
  message?: string | string[];
  code?: string;
  details?: unknown;
};

/**
 * Global HTTP exception filter for standardized API error payloads.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<JsonResponse>();
    const request = context.getRequest<HttpRequestLike>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const code = this.resolveCode(statusCode, exception, exceptionResponse);
    const message = this.resolveMessage(statusCode, exceptionResponse);
    const details = this.resolveDetails(exception, exceptionResponse);
    const path = request.url ?? '';

    if (statusCode >= 500) {
      this.logger.error(message);
    } else {
      this.logger.warn(message);
    }

    response.status(statusCode).json({
      statusCode,
      error: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message,
      code,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path,
    });
  }

  private resolveMessage(statusCode: number, exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const shape = exceptionResponse as ExceptionResponseShape;
      if (Array.isArray(shape.message)) {
        return shape.message.join(', ');
      }
      if (typeof shape.message === 'string') {
        return shape.message;
      }
    }

    if (statusCode >= 500) {
      return 'Internal server error';
    }

    return 'Request failed';
  }

  private resolveCode(
    statusCode: number,
    exception: unknown,
    exceptionResponse: unknown,
  ): ErrorCodeType {
    if (exception instanceof AppException) {
      return exception.getErrorCode();
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const shape = exceptionResponse as ExceptionResponseShape;
      if (typeof shape.code === 'string') {
        return shape.code as ErrorCodeType;
      }
    }

    if (statusCode === HttpStatus.NOT_FOUND) {
      return ErrorCodes.NOT_FOUND;
    }

    if (statusCode === HttpStatus.BAD_REQUEST) {
      return ErrorCodes.VALIDATION_ERROR;
    }

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return ErrorCodes.TOO_MANY_REQUESTS;
    }

    return ErrorCodes.INTERNAL_ERROR;
  }

  private resolveDetails(exception: unknown, exceptionResponse: unknown): unknown {
    if (exception instanceof AppException) {
      return exception.getDetails();
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const shape = exceptionResponse as ExceptionResponseShape;
      if (shape.details !== undefined) {
        return shape.details;
      }
    }

    return undefined;
  }
}
