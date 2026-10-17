import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { createMeta } from '../utils/response.util';

/** Bọc mọi response về dạng { statusCode, message, data, meta } */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || Buffer.isBuffer(data)) {
          return data;
        }
        const statusCode =
          context.switchToHttp().getResponse().statusCode || 200;

        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'message' in data &&
          'data' in data &&
          'meta' in data
        ) {
          return data;
        }

        return {
          statusCode,
          message: 'Thành công',
          data: data ?? null,
          meta: createMeta(),
        };
      }),
    );
  }
}
