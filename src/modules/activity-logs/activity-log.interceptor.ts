import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ActivityLogService } from './activity-log.service';

const SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'refreshToken',
];

/** Ghi nhật ký mọi request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (
      context.getType() !== 'http' ||
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) ||
      request.url.includes('/refresh-token')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response) => this.save(request, 'success', response),
        error: (error) => this.save(request, 'failure', error),
      }),
    );
  }

  private save(request: any, status: 'success' | 'failure', data: any) {
    const { method, ip } = request;
    const url: string = request.originalUrl || request.url;
    const path = url.split('?')[0];
    // /api/v1/<module>/...
    const module = path.split('/')[3] || 'system';

    let action = 'UNKNOWN';
    if (path.endsWith('/auth/login')) action = 'LOGIN';
    else if (path.endsWith('/auth/logout')) action = 'LOGOUT';
    else if (method === 'POST') action = 'CREATE';
    else if (method === 'PUT' || method === 'PATCH') action = 'UPDATE';
    else if (method === 'DELETE') action = 'DELETE';

    let user: Partial<AuthUser> = request.user;
    if (!user && action === 'LOGIN' && status === 'success') {
      user = data?.data?.user;
    }

    void this.activityLogService.log({
      userId: (user?.id as any) || undefined,
      username: user?.username || request.body?.username || 'anonymous',
      roleCode: user?.roleCode || 'guest',
      action,
      module,
      description: this.describe(action, module, status, data),
      method,
      url,
      ip,
      userAgent: request.get?.('user-agent'),
      payload: this.sanitize(request.body),
      status,
      statusCode:
        data?.statusCode ||
        data?.status ||
        (typeof data?.getStatus === 'function'
          ? data.getStatus()
          : undefined) ||
        (status === 'success' ? 200 : 500),
    });
  }

  private describe(action: string, module: string, status: string, data: any) {
    const message = data?.message || data?.response?.message;
    if (action === 'LOGIN') {
      return status === 'success' ? 'Đăng nhập hệ thống' : 'Đăng nhập thất bại';
    }
    if (action === 'LOGOUT') return 'Đăng xuất';
    return `${action} ${module}${message ? `: ${message}` : ''}`;
  }

  private sanitize(body: any) {
    if (!body || typeof body !== 'object') return null;
    const sanitized = { ...body };
    for (const field of SENSITIVE_FIELDS) {
      if (sanitized[field]) sanitized[field] = '********';
    }
    return sanitized;
  }
}
