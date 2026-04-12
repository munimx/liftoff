import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
};

type ResponseLike = {
  statusCode?: number;
};

/**
 * Logs request method, route, status code, and request duration.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();
    const method = request.method ?? 'UNKNOWN';
    const path = request.originalUrl ?? request.url ?? '';

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode ?? 200;
          const durationMs = Date.now() - startedAt;
          this.logger.log(`${method} ${path} ${statusCode} ${durationMs}ms`);
        },
        error: () => {
          const statusCode = response.statusCode ?? 500;
          const durationMs = Date.now() - startedAt;
          this.logger.warn(`${method} ${path} ${statusCode} ${durationMs}ms`);
        },
      }),
    );
  }
}
