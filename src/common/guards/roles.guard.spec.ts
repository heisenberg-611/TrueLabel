import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  const createMockContext = (sessionUser?: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          session: sessionUser !== undefined ? { user: sessionUser } : {},
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles are required on route', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext(null);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['manufacturer', 'admin']);
    const context = createMockContext({ id: 1, role: 'manufacturer' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException with friendly role metadata if user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['manufacturer', 'admin']);
    const context = createMockContext({ id: 2, role: 'consumer' });

    let caughtError: any;
    try {
      guard.canActivate(context);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ForbiddenException);
    expect(caughtError.message).toBe(
      'This page is only available to Food Manufacturer or Administrator accounts.',
    );
    expect(caughtError.getResponse()).toEqual(
      expect.objectContaining({
        isRoleRestriction: true,
        requiredRoles: ['manufacturer', 'admin'],
      }),
    );
  });

  it('should throw ForbiddenException if user is not authenticated (guest)', () => {
    reflector.getAllAndOverride.mockReturnValue(['inspector']);
    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
