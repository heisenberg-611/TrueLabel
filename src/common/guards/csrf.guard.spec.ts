import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    guard = new CsrfGuard();
  });

  const createMockContext = (
    method: string,
    sessionToken?: string,
    clientToken?: string,
    source: 'body' | 'header' | 'query' = 'body',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          session: sessionToken ? { csrfToken: sessionToken } : {},
          body: source === 'body' && clientToken ? { _csrf: clientToken } : {},
          headers: source === 'header' && clientToken ? { 'x-csrf-token': clientToken } : {},
          query: source === 'query' && clientToken ? { _csrf: clientToken } : {},
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow GET requests unconditionally', () => {
    const context = createMockContext('GET', 'secret123');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST when client body token matches session token', () => {
    const context = createMockContext('POST', 'valid-token-123', 'valid-token-123', 'body');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST when header x-csrf-token matches session token', () => {
    const context = createMockContext('POST', 'valid-token-123', 'valid-token-123', 'header');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST when query _csrf matches session token (e.g. multipart uploads)', () => {
    const context = createMockContext('POST', 'valid-token-123', 'valid-token-123', 'query');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException on POST when CSRF token is missing', () => {
    const context = createMockContext('POST', 'valid-token-123', undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException on POST when CSRF token does not match', () => {
    const context = createMockContext('POST', 'valid-token-123', 'invalid-token-456');
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
