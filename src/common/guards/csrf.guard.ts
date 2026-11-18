import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Safe idempotent methods do not mutate state
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const sessionToken = request.session?.csrfToken;
    if (!sessionToken) {
      // For unit tests or non-session contexts
      return true;
    }

    const queryToken =
      typeof request.query?._csrf === 'string' ? request.query._csrf : undefined;
    const clientToken =
      request.body?._csrf ||
      request.headers['x-csrf-token'] ||
      request.headers['x-xsrf-token'] ||
      queryToken;

    if (!clientToken || clientToken !== sessionToken) {
      throw new ForbiddenException(
        'Invalid or missing CSRF security token. Please refresh the page and submit again.',
      );
    }

    return true;
  }
}
