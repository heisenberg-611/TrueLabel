import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodProduct } from './models/food-product.entity';
import { Ingredient } from './models/ingredient.entity';
import { NutritionFact } from './models/nutrition-fact.entity';
import { ScoringConfig } from './models/scoring-config.entity';
import { FoodScoreSnapshot } from './models/food-score-snapshot.entity';
import { FoodRule } from '../admin/models/food-rule.entity';
import { FoodSafetyDocument } from '../food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from '../food-safety/models/manufacturer-licence.entity';
import { FoodReview } from '../community/models/food-review.entity';
import { FoodReport } from '../community/models/food-report.entity';
import { CatalogService } from './services/catalog.service';
import { IngredientAnalyzerService } from './services/ingredient-analyzer.service';
import { FoodScoreService } from './services/food-score.service';
import { FoodComparisonEngine } from './services/food-comparison.engine';
import { FoodComparisonService } from './services/food-comparison.service';
import { FoodComparisonController } from './controllers/food-comparison.controller';
import { FoodCatalogController } from './controllers/food-catalog.controller';
import { PersonalFoodModule } from '../personal-food/personal-food.module';
import { FoodSafetyModule } from '../food-safety/food-safety.module';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FoodProduct,
      Ingredient,
      NutritionFact,
      ScoringConfig,
      FoodScoreSnapshot,
      FoodRule,
      FoodSafetyDocument,
      ManufacturerLicence,
      FoodReview,
      FoodReport,
    ]),
    PersonalFoodModule,
    FoodSafetyModule,
    CommunityModule,
  ],
  controllers: [FoodComparisonController, FoodCatalogController],
  providers: [
    CatalogService,
    IngredientAnalyzerService,
    FoodScoreService,
    FoodComparisonEngine,
    FoodComparisonService,
  ],
  exports: [
    CatalogService,
    IngredientAnalyzerService,
    FoodScoreService,
    FoodComparisonEngine,
    FoodComparisonService,
  ],
})
export class FoodCatalogModule {}
