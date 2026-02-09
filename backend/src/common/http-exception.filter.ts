import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `${req.method} ${req.url} ${status}`,
      stack ?? String(exception),
    );

    const body: Record<string, unknown> = {
      statusCode: status,
      message: typeof message === 'object' && message && 'message' in message
        ? (message as { message: string }).message
        : String(message),
    };
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      body.error = exception.name;
      body.details = exception.message;
    }

    res.status(status).json(body);
  }
}
