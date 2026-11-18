import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  consumer: 'Consumer',
  manufacturer: 'Food Manufacturer',
  inspector: 'Safety Inspector',
  admin: 'Administrator',
};

interface ActionLink {
  label: string;
  href: string;
}

interface ForbiddenViewModel {
  title: string;
  heading: string;
  message: string;
  hint: string | null;
  currentRoleLabel: string | null;
  requiredRolesLabel: string | null;
  primaryAction: ActionLink;
  secondaryAction: ActionLink;
  user: Request['session']['user'] | null;
}

@Catch(UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus ? exception.getStatus() : 500;

    const acceptsHtml = request.accepts ? request.accepts(['html', 'json']) === 'html' : false;

    if (acceptsHtml) {
      if (status === 401) {
        return response.redirect('/auth/login?unauthorized=true');
      }

      if (status === 403) {
        return response
          .status(403)
          .render('shared/views/forbidden', this.buildForbiddenViewModel(exception, request));
      }

      if (status === 404 || status === 400) {
        let errMessage = exception.message || 'The requested resource could not be found.';
        const exceptionResponse = exception.getResponse ? exception.getResponse() : null;
        if (exceptionResponse && typeof exceptionResponse === 'object') {
          const respObj = exceptionResponse as any;
          if (Array.isArray(respObj.message)) {
            errMessage = respObj.message.join('. ');
          } else if (typeof respObj.message === 'string') {
            errMessage = respObj.message;
          }
        }

        return response.status(status).render('shared/views/not-found', {
          title: status === 404 ? 'Page Not Found — TrueLabel' : 'Invalid Request — TrueLabel',
          statusCode: status,
          message: errMessage,
          path: request.url,
          user: request.session?.user || null,
        });
      }
    }

    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
    };

    return response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: errorNames[status] || 'Error',
    });
  }

  private buildForbiddenViewModel(
    exception: HttpException,
    request: Request,
  ): ForbiddenViewModel {
    const user = request.session?.user || null;
    const role = user?.role || null;
    const currentRoleLabel = role ? ROLE_DISPLAY_NAMES[role] || role : null;
    const rawPath = (request.url || '').split('?')[0];

    const exceptionResponse = exception.getResponse ? exception.getResponse() : null;
    const payload =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? (exceptionResponse as {
            isRoleRestriction?: boolean;
            requiredRoles?: string[];
            message?: string;
          })
        : null;

    const isRoleRestriction = Boolean(payload?.isRoleRestriction);
    const requiredRoles = Array.isArray(payload?.requiredRoles) ? payload.requiredRoles : [];
    const requiredRolesLabel = this.formatRoleList(requiredRoles);

    const defaultPrimary: ActionLink = user
      ? { label: 'Go to your dashboard', href: '/dashboard' }
      : { label: 'Sign in', href: '/auth/login' };
    const defaultSecondary: ActionLink = { label: 'Explore food catalog', href: '/catalog' };

    // Route-specific, plain-language guidance for role-restricted pages
    if (isRoleRestriction) {
      // 1. Submit safety certificates (/safety/documents/upload)
      if (rawPath.startsWith('/safety/documents/upload')) {
        if (role === 'inspector') {
          return {
            title: 'Access Forbidden — TrueLabel',
            heading: 'Submitting certificates is for food manufacturers',
            message:
              'Only registered Food Manufacturers and Administrators can upload new safety certificates. With your Safety Inspector account, you can audit and verify submitted documents instead.',
            hint: 'Need to upload a certificate for a brand? Sign out and sign in with a Food Manufacturer account.',
            currentRoleLabel,
            requiredRolesLabel,
            primaryAction: { label: 'Review safety documents', href: '/safety/documents' },
            secondaryAction: { label: 'Go to your dashboard', href: '/dashboard' },
            user,
          };
        }

        if (role === 'consumer') {
          return {
            title: 'Access Forbidden — TrueLabel',
            heading: 'Submitting certificates is for food manufacturers',
            message:
              'Only registered Food Manufacturers and Administrators can upload new safety certificates. With your Consumer account, you can browse verified certificates and inspect product safety records anytime.',
            hint: 'Representing a food brand? Sign out and register or sign in with a Food Manufacturer account.',
            currentRoleLabel,
            requiredRolesLabel,
            primaryAction: { label: 'Browse safety documents', href: '/safety/documents' },
            secondaryAction: { label: 'Explore food catalog', href: '/catalog' },
            user,
          };
        }

        return {
          title: 'Access Forbidden — TrueLabel',
          heading: 'Submitting certificates is for food manufacturers',
          message:
            'Only registered Food Manufacturers and Administrators can upload safety certificates and lab analysis reports.',
          hint: null,
          currentRoleLabel,
          requiredRolesLabel,
          primaryAction: { label: 'Browse safety documents', href: '/safety/documents' },
          secondaryAction: defaultSecondary,
          user,
        };
      }

      // 2. Product catalog management (/catalog/manage/*)
      if (rawPath.startsWith('/catalog/manage')) {
        return {
          title: 'Access Forbidden — TrueLabel',
          heading: 'Managing food listings is for food manufacturers',
          message:
            'Adding or editing products in the TrueLabel catalog is limited to registered Food Manufacturers and Administrators.',
          hint: user
            ? 'Need to manage a product listing? Sign out and sign in with a Food Manufacturer account.'
            : null,
          currentRoleLabel,
          requiredRolesLabel,
          primaryAction: { label: 'Explore food catalog', href: '/catalog' },
          secondaryAction: defaultPrimary,
          user,
        };
      }

      // 3. Inspector review & complaint queues
      if (
        rawPath.startsWith('/community/reports/queue') ||
        /^\/safety\/documents\/\d+\/review/.test(rawPath)
      ) {
        return {
          title: 'Access Forbidden — TrueLabel',
          heading: 'This review bench is for safety inspectors',
          message:
            'Auditing compliance certificates and moderating consumer safety reports is reserved for certified Safety Inspectors and Administrators.',
          hint: null,
          currentRoleLabel,
          requiredRolesLabel,
          primaryAction: defaultPrimary,
          secondaryAction: { label: 'Browse safety documents', href: '/safety/documents' },
          user,
        };
      }

      // 4. Consumer reports & reviews
      if (rawPath.startsWith('/community/reports') || rawPath.startsWith('/community/reviews')) {
        return {
          title: 'Access Forbidden — TrueLabel',
          heading: 'This feature is for consumer accounts',
          message:
            'Writing product reviews and filing consumer safety reports is available when signed in with a Consumer account.',
          hint: null,
          currentRoleLabel,
          requiredRolesLabel,
          primaryAction: { label: 'Explore food catalog', href: '/catalog' },
          secondaryAction: defaultPrimary,
          user,
        };
      }

      // 5. Role-specific dashboards
      if (rawPath.startsWith('/dashboard/')) {
        return {
          title: 'Access Forbidden — TrueLabel',
          heading: 'That dashboard belongs to a different account type',
          message:
            'Each TrueLabel role has its own dedicated workspace. Head to your dashboard to see the tools set up for your account.',
          hint: null,
          currentRoleLabel,
          requiredRolesLabel,
          primaryAction: { label: 'Open your dashboard', href: '/dashboard' },
          secondaryAction: defaultSecondary,
          user,
        };
      }

      // Generic friendly fallback for any other @Roles-protected route
      return {
        title: 'Access Forbidden — TrueLabel',
        heading: 'This section is for a different account type',
        message:
          exception.message ||
          (requiredRolesLabel
            ? `This page is only available to ${requiredRolesLabel} accounts.`
            : 'Your current account does not include access to this section.'),
        hint: user
          ? 'If you have another account for this role, sign out and sign in with it.'
          : null,
        currentRoleLabel,
        requiredRolesLabel,
        primaryAction: defaultPrimary,
        secondaryAction: defaultSecondary,
        user,
      };
    }

    // Non-role 403 (e.g., ownership check, CSRF, or explicit controller ForbiddenException)
    return {
      title: 'Access Forbidden — TrueLabel',
      heading: 'You cannot complete this action',
      message: exception.message || 'You do not have permission to access this resource.',
      hint: null,
      currentRoleLabel,
      requiredRolesLabel: null,
      primaryAction: defaultPrimary,
      secondaryAction: defaultSecondary,
      user,
    };
  }

  private formatRoleList(roles: string[]): string | null {
    if (!roles || roles.length === 0) return null;
    const labels = roles.map((r) => ROLE_DISPLAY_NAMES[r] || r);
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
  }
}
