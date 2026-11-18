import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';

describe('AuthController (Unit Tests)', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      register: jest.fn(),
      findOrCreateDemoUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLoginPage', () => {
    it('should render login page when user is not authenticated', () => {
      const mockReq = { session: { user: null } } as any;
      const mockRes = { render: jest.fn() } as any;
      controller.getLoginPage(mockReq, mockRes);
      expect(mockRes.render).toHaveBeenCalledWith(
        'areas/identity/views/login',
        expect.objectContaining({
          title: 'Sign In — TrueLabel',
          user: null,
        }),
      );
    });

    it('should redirect to / if user is already authenticated', () => {
      const mockReq = { session: { user: { id: 1, role: 'consumer' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;
      controller.getLoginPage(mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('getRegisterPage', () => {
    it('should render register page when user is not authenticated', () => {
      const mockReq = { session: { user: null } } as any;
      const mockRes = { render: jest.fn() } as any;
      controller.getRegisterPage(mockReq, mockRes);
      expect(mockRes.render).toHaveBeenCalledWith(
        'areas/identity/views/register',
        expect.objectContaining({
          title: 'Create Account — TrueLabel',
          user: null,
        }),
      );
    });

    it('should redirect to / if user is already authenticated', () => {
      const mockReq = { session: { user: { id: 1, role: 'consumer' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;
      controller.getRegisterPage(mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('handleLogin', () => {
    it('should authenticate user and redirect to / on success', async () => {
      const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com', role: 'consumer' as const };
      (authService.validateUser as jest.Mock).mockResolvedValue(mockUser);

      const mockReq = { session: {} } as any;
      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as any;

      await controller.handleLogin(
        { email: 'alice@example.com', password: 'password123' },
        mockReq,
        mockRes,
      );

      expect(mockReq.session.user).toEqual(mockUser);
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });

    it('should render login page with error on invalid credentials', async () => {
      (authService.validateUser as jest.Mock).mockRejectedValue(new Error('Invalid email or password'));

      const mockReq = { session: {} } as any;
      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as any;

      await controller.handleLogin(
        { email: 'alice@example.com', password: 'wrong' },
        mockReq,
        mockRes,
      );

      expect(mockRes.render).toHaveBeenCalledWith(
        'areas/identity/views/login',
        expect.objectContaining({
          error: 'Invalid email or password',
          email: 'alice@example.com',
        }),
      );
    });
  });

  describe('handleRegister', () => {
    it('should register user and redirect to / on success', async () => {
      const mockUser = { id: 2, name: 'Bob', email: 'bob@example.com', role: 'manufacturer' as const };
      (authService.register as jest.Mock).mockResolvedValue(mockUser);

      const mockReq = { session: {} } as any;
      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as any;

      await controller.handleRegister(
        { name: 'Bob', email: 'bob@example.com', password: 'password123', role: 'manufacturer' as const },
        mockReq,
        mockRes,
      );

      expect(mockReq.session.user).toEqual(mockUser);
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('handleLogout', () => {
    it('should destroy session and redirect to /', () => {
      const mockReq = {
        session: {
          destroy: jest.fn((callback) => callback()),
        },
      } as any;
      const mockRes = { redirect: jest.fn() } as any;

      controller.handleLogout(mockReq, mockRes);

      expect(mockReq.session.destroy).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('demoSwitchRole', () => {
    it('should switch to persisted demo user and redirect when in non-production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      (authService.findOrCreateDemoUser as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'PureHarvest & Aarong Dairy',
        email: 'manufacturer@truelabel.demo',
        role: 'manufacturer',
        isVerified: true,
      });

      const mockReq = { session: {} } as any;
      const mockRes = { redirect: jest.fn() } as any;

      await controller.demoSwitchRole('manufacturer', mockReq, mockRes);

      expect(authService.findOrCreateDemoUser).toHaveBeenCalledWith('manufacturer');
      expect(mockReq.session.user).toBeDefined();
      expect(mockReq.session.user.id).toBe(2);
      expect(mockReq.session.user.role).toBe('manufacturer');
      expect(mockRes.redirect).toHaveBeenCalledWith('/');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw ForbiddenException in production when ENABLE_DEMO_SWITCHER is not true', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalFlag = process.env.ENABLE_DEMO_SWITCHER;
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_DEMO_SWITCHER;

      const mockReq = { session: {} } as any;
      const mockRes = { redirect: jest.fn() } as any;

      await expect(controller.demoSwitchRole('admin', mockReq, mockRes)).rejects.toThrow();

      process.env.NODE_ENV = originalEnv;
      process.env.ENABLE_DEMO_SWITCHER = originalFlag;
    });
  });
});

