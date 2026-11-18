import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  consumer: 'Consumer',
  manufacturer: 'Food Manufacturer',
  inspector: 'Safety Inspector',
  admin: 'Administrator',
};

function formatRoleList(roles: string[]): string {
  const labels = roles.map((r) => ROLE_DISPLAY_NAMES[r] || r);
  if (labels.length === 0) return 'authorized';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.session?.user;

    if (!user || !requiredRoles.includes(user.role)) {
      const allowedLabel = formatRoleList(requiredRoles);
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `This page is only available to ${allowedLabel} accounts.`,
        isRoleRestriction: true,
        requiredRoles,
      });
    }

    return true;
  }
}

