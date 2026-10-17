import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { createMeta } from '../utils/response.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Lỗi hệ thống, vui lòng thử lại sau';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const raw =
        typeof res === 'object' && res !== null
          ? (res as any).message || exception.message
          : exception.message;
      message = Array.isArray(raw) ? raw.join(', ') : raw;
    } else if (exception?.code === 11000) {
      // Lỗi trùng unique index của MongoDB
      status = HttpStatus.CONFLICT;
      const fields = Object.keys(exception.keyValue || {}).join(', ');
      message = `Dữ liệu bị trùng${fields ? `: ${fields}` : ''}`;
    } else if (exception?.name === 'CastError') {
      status = HttpStatus.BAD_REQUEST;
      message = `Giá trị không hợp lệ cho trường ${exception.path}`;
    } else if (exception?.name === 'ValidationError') {
      status = HttpStatus.BAD_REQUEST;
      message = Object.values(exception.errors || {})
        .map((e: any) => e.message)
        .join(', ');
    } else {
      this.logger.error(exception?.message, exception?.stack);
    }

    response.status(status).json({
      statusCode: status,
      message,
      data: null,
      meta: createMeta(),
    });
  }
}
