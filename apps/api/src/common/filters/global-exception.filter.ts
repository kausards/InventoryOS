import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (!(exception instanceof HttpException)) {
      console.error('Unhandled exception:', exception);
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse: any = {
      success: false,
      error: {
        code: exception instanceof HttpException ? 'HTTP_ERROR' : 'INTERNAL_ERROR',
        message:
          exception instanceof HttpException
            ? exception.message
            : 'Internal server error',
        requestId: request.headers['x-request-id'],
      },
    };

    if (exception instanceof HttpException) {
      const resp = exception.getResponse() as any;
      if (resp && resp.message && Array.isArray(resp.message)) {
        errorResponse.error.code = 'VALIDATION_ERROR';
        errorResponse.error.fields = resp.message;
      }
    }

    response.status(status).send(errorResponse);
  }
}
