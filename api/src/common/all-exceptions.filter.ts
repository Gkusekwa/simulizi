import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * One error shape for every failure:
 *   { success: false, error: { status, code, message }, timestamp }
 * Unexpected errors are logged with the request path and hidden from clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'internal_error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? exception.message;
        code = (b.error ?? exception.name).toLowerCase().replace(/\s+/g, '_');
      }
    } else {
      this.logger.error(
        `${req.method} ${req.url} -> ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json({
      success: false,
      error: { status, code, message },
      timestamp: new Date().toISOString(),
    });
  }
}
