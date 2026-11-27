import { Controller, Get, Query, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { FoodComparisonService } from '../services/food-comparison.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import {
  CompareFoodsDto,
  parseCompareProductIds,
} from '../models/dto/compare-foods.dto';

@Controller('catalog/compare')
export class FoodComparisonController {
  constructor(
    private readonly comparisonService: FoodComparisonService,
    private readonly preferenceService: PreferenceService,
  ) {}

  /**
   * Feature F05: Side-by-side Same-Category Food Comparison Engine (2–3 items)
   */
  @Get()
  @Render('areas/food-catalog/views/compare')
  async getComparisonPage(
    @Query() queryDto: CompareFoodsDto,
    @Req() req: Request,
  ) {
    const ids = parseCompareProductIds(queryDto?.ids);

    let userProfile = null;
    if (req.session?.user && req.session.user.role === 'consumer') {
      userProfile = await this.preferenceService.findByUserId(req.session.user.id);
    }

    const data = await this.comparisonService.compareFoods(ids, {
      userProfile,
      evaluateConflictFn: userProfile
        ? (profile, product) =>
            this.preferenceService.evaluateProductConflict(profile, product)
        : undefined,
      pickerCategory: queryDto?.category,
    });

    return {
      title: 'Compare Packaged Foods — TrueLabel',
      activeNav: 'compare',
      user: req.session?.user || null,
      userProfile,
      requestedIdsRaw: ids.join(','),
      ...data,
    };
  }
}
