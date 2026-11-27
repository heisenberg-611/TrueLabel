import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Optional,
  Post,
  Query,
  Render,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FoodScoreService } from '../../food-catalog/services/food-score.service';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { UpdateScoringWeightsDto } from '../models/dto/update-scoring-weights.dto';

/**
 * Feature F04: Administrative Food Quality Score Configuration Controller
 * Manages configurable 5-pillar weights (summing to 100%) and full catalog recalculation.
 */
@Controller('admin/scoring')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin')
export class AdminScoringController {
  constructor(
    private readonly foodScoreService: FoodScoreService,
    @Optional() private readonly catalogService?: CatalogService,
  ) {}

  @Get()
  @Render('areas/admin/views/scoring')
  async getScoringConsole(
    @Req() req: Request,
    @Query('success') success?: string,
    @Query('error') error?: string,
  ) {
    const [config, tierStats, catalogSample] = await Promise.all([
      this.foodScoreService.getActiveConfig(),
      this.foodScoreService.getCatalogTierStats(),
      this.catalogService
        ? this.catalogService.searchAndFilter({ limit: 3, status: 'all' })
        : Promise.resolve({ items: [], total: 0, page: 1, totalPages: 1 }),
    ]);

    const sampleBreakdowns = await Promise.all(
      (catalogSample.items || []).slice(0, 3).map(async (prod) => ({
        product: prod,
        breakdown: await this.foodScoreService.evaluateProduct(prod, undefined, config),
      })),
    );

    const totalWeight =
      Number(config.ingredientWeight) +
      Number(config.nutritionWeight) +
      Number(config.verificationWeight) +
      Number(config.recallWeight) +
      Number(config.communityWeight);

    return {
      title: 'Food Quality Score Formula & Weights — TrueLabel',
      activeNav: 'scoring',
      user: req.session?.user || null,
      config,
      tierStats,
      totalWeight,
      sampleBreakdowns,
      success: success ? decodeURIComponent(success) : null,
      error: error ? decodeURIComponent(error) : null,
    };
  }

  @Post('weights')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Invalid scoring weight submission',
        );
      },
    }),
  )
  async handleUpdateWeights(
    @Body() dto: UpdateScoringWeightsDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = req.session?.user || { id: 1, role: 'admin' };
      const { config, recalculation } = await this.foodScoreService.updateWeights(dto, user);
      const message = `Updated scoring weights (${config.ingredientWeight}/${config.nutritionWeight}/${config.verificationWeight}/${config.recallWeight}/${config.communityWeight}). Re-scored ${recalculation.productsEvaluated} products (${recalculation.productsUpdated} score changes, ${recalculation.snapshotsRecorded} snapshots saved).`;
      return res.redirect(`/admin/scoring?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/scoring?error=${encodeURIComponent(err.message || 'Failed to update scoring weights')}`,
      );
    }
  }

  @Post('recalculate')
  async handleManualRecalculate(@Res() res: Response) {
    try {
      const summary = await this.foodScoreService.recalculateAllScores('manual');
      const message = `Recalculated ${summary.productsEvaluated} catalog products: ${summary.productsUpdated} product scores synced and ${summary.snapshotsRecorded} snapshots persisted (Tier 1: ${summary.tierCounts.tier1}, Tier 2: ${summary.tierCounts.tier2}, Tier 3: ${summary.tierCounts.tier3}).`;
      return res.redirect(`/admin/scoring?success=${encodeURIComponent(message)}`);
    } catch (err: any) {
      return res.redirect(
        `/admin/scoring?error=${encodeURIComponent(err.message || 'Failed to recalculate catalog quality scores')}`,
      );
    }
  }
}
