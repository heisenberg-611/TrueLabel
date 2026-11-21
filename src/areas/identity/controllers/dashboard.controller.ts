import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Render,
  UseGuards,
  Query,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../models/user.entity';

@Controller('dashboard')
@UseGuards(AuthenticatedGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Central Dashboard Dispatcher: Automatically routes each authenticated user to their role's workspace
   */
  @Get()
  async getDashboard(@Req() req: Request, @Res() res: Response) {
    const role = req.session.user.role;
    switch (role) {
      case 'manufacturer':
        return res.redirect('/dashboard/manufacturer');
      case 'inspector':
        return res.redirect('/dashboard/inspector');
      case 'admin':
        return res.redirect('/dashboard/admin');
      case 'consumer':
      default:
        return res.redirect('/dashboard/consumer');
    }
  }

  /**
   * Consumer Health & Dietary Shield Dashboard
   */
  @Get('consumer')
  @Roles('consumer', 'admin')
  @Render('areas/identity/views/dashboard/consumer')
  async getConsumerDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getConsumerDashboardData(req.session.user.id);
    return {
      title: 'Consumer Health & Nutrition Dashboard — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }

  /**
   * Manufacturer Compliance & Product Console
   */
  @Get('manufacturer')
  @Roles('manufacturer', 'admin')
  @Render('areas/identity/views/dashboard/manufacturer')
  async getManufacturerDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getManufacturerDashboardData(req.session.user);
    return {
      title: 'Manufacturer Compliance & Catalog Console — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }

  /**
   * Inspector Verification Queue & Audit Dashboard
   */
  @Get('inspector')
  @Roles('inspector', 'admin')
  @Render('areas/identity/views/dashboard/inspector')
  async getInspectorDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getInspectorDashboardData();
    return {
      title: 'Food Safety Inspector Audit Queue — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }

  /**
   * System Administrator Command Center
   */
  @Get('admin')
  @Roles('admin')
  @Render('areas/identity/views/dashboard/admin')
  async getAdminDashboard(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('role') role?: string,
    @Query('q') q?: string,
    @Query('success') success?: string,
    @Query('error') error?: string,
    @Query('tab') tab?: 'users' | 'catalog',
    @Query('productQ') productQ?: string,
    @Query('productStatus') productStatus?: string,
    @Query('productPage') productPage?: string,
  ) {
    const data = await this.dashboardService.getAdminDashboardData({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      sort,
      order,
      role,
      search: q,
      ...(tab ? { tab } : {}),
      ...(productQ ? { productQ } : {}),
      ...(productStatus ? { productStatus } : {}),
      ...(productPage ? { productPage: parseInt(productPage, 10) } : {}),
    });
    return {
      title: 'System Administrator Command Center — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      success,
      error,
      ...data,
    };
  }

  /**
   * Admin User CRUD: Create User Account
   */
  @Post('admin/users/create')
  @Roles('admin')
  async createAdminUser(
    @Body()
    body: {
      name: string;
      email: string;
      role: UserRole;
      password?: string;
      isVerified?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const isVerified = body.isVerified === 'on' || body.isVerified === 'true';
      await this.dashboardService.createAdminUser({
        name: body.name,
        email: body.email,
        role: body.role,
        password: body.password,
        isVerified,
      });
      return res.redirect(
        '/dashboard/admin?success=' +
          encodeURIComponent(`User account "${body.name}" was successfully created.`),
      );
    } catch (err: any) {
      return res.redirect(
        '/dashboard/admin?error=' +
          encodeURIComponent(err.message || 'Failed to create user account.'),
      );
    }
  }

  /**
   * Admin User CRUD: Update User Account
   */
  @Post('admin/users/:id/update')
  @Roles('admin')
  async updateAdminUser(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      email?: string;
      role?: UserRole;
      password?: string;
      isVerified?: string;
      _hasVerifiedField?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const isVerified = body._hasVerifiedField
        ? body.isVerified === 'on' || body.isVerified === 'true'
        : undefined;

      await this.dashboardService.updateAdminUser(id, {
        name: body.name,
        email: body.email,
        role: body.role,
        password: body.password,
        isVerified,
      });
      return res.redirect(
        '/dashboard/admin?success=' +
          encodeURIComponent(`User account #${id} was successfully updated.`),
      );
    } catch (err: any) {
      return res.redirect(
        '/dashboard/admin?error=' +
          encodeURIComponent(err.message || 'Failed to update user account.'),
      );
    }
  }

  /**
   * Admin User CRUD: Delete User Account
   */
  @Post('admin/users/:id/delete')
  @Roles('admin')
  async deleteAdminUser(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.dashboardService.deleteAdminUser(id, req.session.user.id);
      return res.redirect(
        '/dashboard/admin?success=' +
          encodeURIComponent(`User account #${id} has been permanently deleted.`),
      );
    } catch (err: any) {
      return res.redirect(
        '/dashboard/admin?error=' +
          encodeURIComponent(err.message || 'Failed to delete user account.'),
      );
    }
  }
}
