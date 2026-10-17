import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';

export const IS_PUBLIC_KEY = 'isPublic';
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const PERMISSIONS_KEY = 'permissions';

/** Endpoint không cần đăng nhập */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Endpoint cho phép cả khách và người đã đăng nhập (req.user có thể null) */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

/** Yêu cầu user có ÍT NHẤT MỘT trong các quyền được liệt kê */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);

export const GetUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest().user?.id,
);
