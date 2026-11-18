import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Render,
  UsePipes,
  ValidationPipe,
  Param,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../models/dto/login.dto';
import { RegisterDto } from '../models/dto/register.dto';
import { UserRole } from '../models/user.entity';
import { AuthThrottlerGuard } from '../../../common/guards/auth-throttler.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  getLoginPage(
    @Req() req: Request,
    @Res() res: Response,
    @Query('unauthorized') unauthorized?: string,
  ) {
    if (req.session?.user) {
      return res.redirect('/');
    }
    return res.render('areas/identity/views/login', {
      title: 'Sign In — TrueLabel',
      user: req.session?.user,
      unauthorized: unauthorized === 'true',
    });
  }

  @Post('login')
  @UseGuards(AuthThrottlerGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleLogin(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = await this.authService.validateUser(loginDto);
      req.session.user = user;
      return res.redirect('/');
    } catch (err) {
      return res.render('areas/identity/views/login', {
        title: 'Sign In — TrueLabel',
        error: err.message || 'Invalid credentials',
        email: loginDto.email,
      });
    }
  }

  @Get('register')
  getRegisterPage(@Req() req: Request, @Res() res: Response) {
    if (req.session?.user) {
      return res.redirect('/');
    }
    return res.render('areas/identity/views/register', {
      title: 'Create Account — TrueLabel',
      user: req.session?.user,
    });
  }

  @Post('register')
  @UseGuards(AuthThrottlerGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleRegister(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = await this.authService.register(registerDto);
      req.session.user = user;
      return res.redirect('/');
    } catch (err) {
      return res.render('areas/identity/views/register', {
        title: 'Create Account — TrueLabel',
        error: err.message || 'Could not complete registration',
        name: registerDto.name,
        email: registerDto.email,
        role: registerDto.role,
      });
    }
  }

  @Post('logout')
  handleLogout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }

  // Quick Switch for CSE470 Evaluation / Demo Viva (Gated in production)
  @Get('switch-role/:role')
  async demoSwitchRole(
    @Param('role') role: UserRole,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDemoEnabled = process.env.ENABLE_DEMO_SWITCHER === 'true';

    if (isProduction && !isDemoEnabled) {
      throw new ForbiddenException(
        'Demo persona switcher is strictly disabled in production environments.',
      );
    }

    const validRoles: UserRole[] = ['consumer', 'manufacturer', 'inspector', 'admin'];
    const chosenRole = validRoles.includes(role) ? role : 'consumer';

    req.session.user = await this.authService.findOrCreateDemoUser(chosenRole);

    return res.redirect('/');
  }
}

