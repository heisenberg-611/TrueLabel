import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  Render,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RuleManagementService } from '../services/rule-management.service';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { CreateFoodRuleDto } from '../models/dto/create-food-rule.dto';
import { SearchFoodRuleDto } from '../models/dto/search-food-rule.dto';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

/**
 * Feature F03: Administrative Food Rule Base Controller
 * Thin controller enforcing Admin RBAC, DTO validation, and redirect-with-feedback flows.
 */
@Controller('admin/rules')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin')
export class AdminRulesController {
  constructor(
    private readonly ruleManagementService: RuleManagementService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  @Render('areas/admin/views/rules')
  async getRulesRegistry(
    @Query() searchDto: SearchFoodRuleDto,
    @Req() req: Request,
    @Query('success') success?: string,
    @Query('error') error?: string,
  ) {
    const [result, filterOptions] = await Promise.all([
      this.ruleManagementService.searchRules(searchDto),
      this.catalogService.getFilterOptions(),
    ]);

    return {
      title: 'Food Rule Base & Ingredient Analysis — TrueLabel',
      activeNav: 'rules',
      user: req.session?.user || null,
      rules: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      stats: result.stats,
      query: searchDto.q || '',
      currentFilter: {
        status: searchDto.status || 'all',
        type: searchDto.type || 'all',
      },
      selectedHazard: searchDto.hazardLevel || 'all',
      selectedScope: searchDto.categoryScope || 'all',
      categories: filterOptions.categories,
      allergenTypes: [
        'Milk',
        'Peanut',
        'Tree Nut',
        'Gluten',
        'Soy',
        'Egg',
        'Fish',
        'Shellfish',
        'Sesame',
        'Celery',
      ],
      success: success ? decodeURIComponent(success) : null,
      error: error ? decodeURIComponent(error) : null,
    };
  }

  @Post('create')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Invalid food rule submission',
        );
      },
    }),
  )
  async handleCreateRule(
    @Body() dto: CreateFoodRuleDto,
    @Res() res: Response,
  ) {
    try {
      const { rule, recalculation } =
        await this.ruleManagementService.createRule(dto);
      const message = `Rule "${rule.name}" added. Recalculated ${recalculation.ingredientsEvaluated} ingredients across ${recalculation.productsEvaluated} catalog products (${recalculation.ingredientsUpdated} updated).`;
      return res.redirect(`/admin/rules?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/rules?error=${encodeURIComponent(err.message || 'Failed to create food rule')}`,
      );
    }
  }

  @Post(':id/update')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Invalid food rule update',
        );
      },
    }),
  )
  async handleUpdateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFoodRuleDto,
    @Res() res: Response,
  ) {
    try {
      const { rule, recalculation } =
        await this.ruleManagementService.updateRule(id, dto);
      const message = `Rule "${rule.name}" updated. Recalculated ${recalculation.productsEvaluated} products (${recalculation.ingredientsUpdated} ingredient rows updated).`;
      return res.redirect(`/admin/rules?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/rules?error=${encodeURIComponent(err.message || 'Failed to update food rule')}`,
      );
    }
  }

  @Post(':id/toggle')
  async handleToggleRule(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    try {
      const { rule, recalculation } =
        await this.ruleManagementService.toggleRuleActive(id);
      const stateLabel = rule.isActive ? 'activated' : 'deactivated';
      const message = `Rule "${rule.name}" ${stateLabel}. Re-evaluated ${recalculation.productsEvaluated} catalog products (${recalculation.ingredientsUpdated} ingredients updated).`;
      return res.redirect(`/admin/rules?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/rules?error=${encodeURIComponent(err.message || 'Failed to toggle rule status')}`,
      );
    }
  }

  @Post(':id/delete')
  async handleDeleteRule(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    try {
      const { recalculation } =
        await this.ruleManagementService.deleteRule(id);
      const message = `Rule #${id} deleted. Re-evaluated ${recalculation.productsEvaluated} catalog products (${recalculation.ingredientsUpdated} ingredients updated).`;
      return res.redirect(`/admin/rules?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/rules?error=${encodeURIComponent(err.message || 'Failed to delete food rule')}`,
      );
    }
  }

  @Post('recalculate')
  async handleManualRecalculate(@Res() res: Response) {
    try {
      const summary =
        await this.ruleManagementService.triggerFullRecalculation();
      const message = `Full catalog analysis completed: ${summary.matchedCount} matched and ${summary.unknownCount} unclassified ingredients across ${summary.productsEvaluated} products (${summary.ingredientsUpdated} updated).`;
      return res.redirect(`/admin/rules?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/rules?error=${encodeURIComponent(err.message || 'Failed to recalculate catalog ingredients')}`,
      );
    }
  }
}
