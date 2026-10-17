import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  IS_OPTIONAL_AUTH_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/auth.decorators';

/** Guard global: mọi endpoint cần JWT trừ khi gắn @Public() hoặc @OptionalAuth() */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, targets)
    ) {
      const req = context.switchToHttp().getRequest();
      if (!req.headers?.authorization) return true;
      try {
        await super.canActivate(context);
      } catch {
        req.user = null;
      }
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
        )
      );
    }
    return user;
  }
}
