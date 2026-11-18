import {
  Controller, Get, Post, Body, Param, Query, ParseIntPipe, Req, Res,
  Render, UseGuards, UsePipes, ValidationPipe,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { EvidenceUpload } from '../services/report-evidence.service';
import { CreateReportDto, UpdateReportStatusDto } from '../models/dto/create-report.dto';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

// Feature F13: Thin MVC Controller for Food Complaints & Suspected Counterfeit Reporting
@Controller('community')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Get('products/:productId/report')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('consumer')
  @Render('areas/community/views/report-form')
  async form(@Param('productId', ParseIntPipe) id: number, @Req() req: Request) {
    const product = await this.reports.getProduct(id);
    return {
      title: `Report a product issue — ${product.name}`,
      activeNav: 'reports',
      product,
      user: req.session.user,
    };
  }

  @Post('products/:productId/report')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('consumer')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 3 * 1024 * 1024 } }))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Param('productId', ParseIntPipe) id: number,
    @Body() dto: CreateReportDto,
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFile() photo?: EvidenceUpload,
  ) {
    try {
      const saved = await this.reports.create(id, req.session.user.id, dto, photo);
      const query = saved?.referenceNumber
        ? `?submitted=${encodeURIComponent(saved.referenceNumber)}`
        : '';
      return res.redirect(`/community/reports/mine${query}`);
    } catch (err: any) {
      const product = await this.reports.getProduct(id);
      return res.status(400).render('areas/community/views/report-form', {
        title: `Report a product issue — ${product.name}`,
        activeNav: 'reports',
        product,
        user: req.session.user,
        formData: dto,
        error: err.message || 'Could not submit your complaint. Please check the fields and try again.',
      });
    }
  }

  @Get('reports/mine')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('consumer')
  @Render('areas/community/views/my-reports')
  async mine(@Req() req: Request, @Query('submitted') submitted?: string) {
    return {
      title: 'My Food Safety Reports — TrueLabel',
      activeNav: 'reports',
      user: req.session.user,
      submittedRef: submitted || null,
      reports: await this.reports.forConsumer(req.session.user.id),
    };
  }

  @Get('reports/queue')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('inspector', 'admin')
  @Render('areas/community/views/report-queue')
  async queue(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('success') success?: string,
  ) {
    const { reports, stats } = await this.reports.getQueueWithStats({ status, category });
    return {
      title: 'Food Complaint Investigation Queue — TrueLabel',
      activeNav: 'complaints',
      user: req.session.user,
      reports,
      stats,
      selectedStatus: status || 'all',
      selectedCategory: category || 'all',
      success: success || null,
    };
  }

  @Get('reports/:reportId/evidence')
  @UseGuards(AuthenticatedGuard)
  async evidence(
    @Param('reportId', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { access, mimeType } = await this.reports.getEvidenceAccess(id, req.session.user);
    if (access.mode === 'redirect') {
      return res.redirect(access.url);
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(access.absolutePath);
  }

  @Post('reports/:reportId/status')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('inspector', 'admin')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async status(
    @Param('reportId', ParseIntPipe) id: number,
    @Body() dto: UpdateReportStatusDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.reports.updateStatus(id, dto.status, req.session.user.role);
    return res.redirect(
      `/community/reports/queue?success=${encodeURIComponent(`Complaint #${id} status updated to ${dto.status}.`)}`,
    );
  }
}
