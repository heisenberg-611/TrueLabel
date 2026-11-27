import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodProduct } from './models/food-product.entity';
import { Ingredient } from './models/ingredient.entity';
import { NutritionFact } from './models/nutrition-fact.entity';
import { FoodRule } from '../admin/models/food-rule.entity';
import { CatalogService } from './services/catalog.service';
import { IngredientAnalyzerService } from './services/ingredient-analyzer.service';
import { FoodCatalogController } from './controllers/food-catalog.controller';
import { PersonalFoodModule } from '../personal-food/personal-food.module';
import { FoodSafetyModule } from '../food-safety/food-safety.module';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FoodProduct, Ingredient, NutritionFact, FoodRule]),
    PersonalFoodModule,
    FoodSafetyModule,
    CommunityModule,
  ],
  controllers: [FoodCatalogController],
  providers: [CatalogService, IngredientAnalyzerService],
  exports: [CatalogService, IngredientAnalyzerService],
})
export class FoodCatalogModule {}
