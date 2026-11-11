import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import type { ChatSocket } from './chat.types';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('ChatGateway');

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<ChatSocket>();

    let code: string;
    let details: unknown;
    let message: string;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      const body =
        typeof response === 'object' && response !== null ? response : {};
      const responseCode =
        'code' in body && typeof body.code === 'string' ? body.code : undefined;
      code = responseCode ?? CODE_BY_STATUS[status] ?? 'ERROR';
      message = exception.message;
      details = 'errors' in body ? body.errors : undefined;
    } else {
      code = 'INTERNAL_ERROR';
      message = 'Internal server error';
      this.logger.error(exception);
    }
    client.emit('chat:error', {
      code,
      message,
      details,
    });
  }
}
