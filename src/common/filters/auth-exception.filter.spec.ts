import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthExceptionFilter } from './auth-exception.filter';

describe('AuthExceptionFilter (Unit Tests)', () => {
  let filter: AuthExceptionFilter;

  beforeEach(() => {
    filter = new AuthExceptionFilter();
  });

  const createMockHost = (
    acceptsHtml: boolean,
    url = '/test-path',
    sessionUser: any = { id: 1, name: 'Alice', email: 'alice@example.com', role: 'consumer' },
  ) => {
    const mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const mockRequest = {
      url,
      accepts: jest.fn().mockReturnValue(acceptsHtml ? 'html' : 'json'),
      session: { user: sessionUser },
    };

    const mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    return { mockHost, mockRequest, mockResponse };
  };

  describe('HTML Requests', () => {
    it('should redirect to /auth/login?unauthorized=true on 401 Unauthorized', () => {
      const { mockHost, mockResponse } = createMockHost(true);
      const exception = new UnauthorizedException('Please log in');

      filter.catch(exception, mockHost);

      expect(mockResponse.redirect).toHaveBeenCalledWith('/auth/login?unauthorized=true');
    });

    it('should render shared/views/forbidden with 403 status on ForbiddenException', () => {
      const { mockHost, mockResponse } = createMockHost(true);
      const exception = new ForbiddenException('Access denied');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.render).toHaveBeenCalledWith(
        'shared/views/forbidden',
        expect.objectContaining({
          title: 'Access Forbidden — TrueLabel',
          heading: 'You cannot complete this action',
          message: 'Access denied',
        }),
      );
    });

    it('should render inspector-friendly guidance when an inspector visits /safety/documents/upload', () => {
      const { mockHost, mockResponse } = createMockHost(true, '/safety/documents/upload', {
        id: 3,
        name: 'Dr. Marcus Vance',
        email: 'inspector@truelabel.demo',
        role: 'inspector',
      });
      const exception = new ForbiddenException({
        message: 'This page is only available to Food Manufacturer or Administrator accounts.',
        isRoleRestriction: true,
        requiredRoles: ['manufacturer', 'admin'],
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.render).toHaveBeenCalledWith(
        'shared/views/forbidden',
        expect.objectContaining({
          heading: 'Submitting certificates is for food manufacturers',
          currentRoleLabel: 'Safety Inspector',
          primaryAction: { label: 'Review safety documents', href: '/safety/documents' },
          secondaryAction: { label: 'Go to your dashboard', href: '/dashboard' },
        }),
      );
      const viewModel = mockResponse.render.mock.calls[0][1];
      expect(viewModel.message).toContain('Safety Inspector account');
      expect(viewModel.message).not.toContain('lacks permission');
    });

    it('should render consumer-friendly guidance when a consumer visits /safety/documents/upload', () => {
      const { mockHost, mockResponse } = createMockHost(true, '/safety/documents/upload', {
        id: 2,
        name: 'Sarah Chen',
        email: 'consumer@truelabel.demo',
        role: 'consumer',
      });
      const exception = new ForbiddenException({
        message: 'This page is only available to Food Manufacturer or Administrator accounts.',
        isRoleRestriction: true,
        requiredRoles: ['manufacturer', 'admin'],
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.render).toHaveBeenCalledWith(
        'shared/views/forbidden',
        expect.objectContaining({
          heading: 'Submitting certificates is for food manufacturers',
          currentRoleLabel: 'Consumer',
          primaryAction: { label: 'Browse safety documents', href: '/safety/documents' },
          secondaryAction: { label: 'Explore food catalog', href: '/catalog' },
        }),
      );
      const viewModel = mockResponse.render.mock.calls[0][1];
      expect(viewModel.message).toContain('Consumer account');
    });

    it('should render role-aware guidance for catalog management and inspector queue routes', () => {
      const { mockHost: catalogHost, mockResponse: catalogRes } = createMockHost(
        true,
        '/catalog/manage/create',
      );
      const roleError = new ForbiddenException({
        message: 'This page is only available to Food Manufacturer or Administrator accounts.',
        isRoleRestriction: true,
        requiredRoles: ['manufacturer', 'admin'],
      });

      filter.catch(roleError, catalogHost);
      expect(catalogRes.render).toHaveBeenCalledWith(
        'shared/views/forbidden',
        expect.objectContaining({
          heading: 'Managing food listings is for food manufacturers',
          primaryAction: { label: 'Explore food catalog', href: '/catalog' },
        }),
      );

      const { mockHost: queueHost, mockResponse: queueRes } = createMockHost(
        true,
        '/community/reports/queue',
      );
      filter.catch(roleError, queueHost);
      expect(queueRes.render).toHaveBeenCalledWith(
        'shared/views/forbidden',
        expect.objectContaining({
          heading: 'This review bench is for safety inspectors',
        }),
      );
    });

    it('should render shared/views/not-found with 404 status on NotFoundException', () => {
      const { mockHost, mockResponse } = createMockHost(true, '/catalog/product/9999');
      const exception = new NotFoundException('Food product not found');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.render).toHaveBeenCalledWith(
        'shared/views/not-found',
        expect.objectContaining({
          title: 'Page Not Found — TrueLabel',
          message: 'Food product not found',
          path: '/catalog/product/9999',
        }),
      );
    });

    it('should render shared/views/not-found with 400 status on BadRequestException', () => {
      const { mockHost, mockResponse } = createMockHost(true, '/catalog/product/abc');
      const exception = new BadRequestException('Validation failed (numeric string is expected)');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.render).toHaveBeenCalledWith(
        'shared/views/not-found',
        expect.objectContaining({
          title: 'Invalid Request — TrueLabel',
          message: 'Validation failed (numeric string is expected)',
          path: '/catalog/product/abc',
        }),
      );
    });

    it('should format array of validation error messages into a readable string on BadRequestException', () => {
      const { mockHost, mockResponse } = createMockHost(true, '/catalog/manage/create');
      const exception = new BadRequestException({
        message: ['Serving size must be a valid number', 'Barcode is required'],
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.render).toHaveBeenCalledWith(
        'shared/views/not-found',
        expect.objectContaining({
          title: 'Invalid Request — TrueLabel',
          statusCode: 400,
          message: 'Serving size must be a valid number. Barcode is required',
        }),
      );
    });
  });

  describe('JSON Requests', () => {
    it('should return JSON format on 404 NotFoundException for API requests', () => {
      const { mockHost, mockResponse } = createMockHost(false);
      const exception = new NotFoundException('Item not found');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Item not found',
        error: 'Not Found',
      });
    });

    it('should return JSON format on 401 UnauthorizedException for API requests', () => {
      const { mockHost, mockResponse } = createMockHost(false);
      const exception = new UnauthorizedException('Token required');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: 'Token required',
        error: 'Unauthorized',
      });
    });
  });
});
