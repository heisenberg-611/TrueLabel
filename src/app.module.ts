import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { IdentityModule } from './areas/identity/identity.module';
import { FoodCatalogModule } from './areas/food-catalog/food-catalog.module';
import { PersonalFoodModule } from './areas/personal-food/personal-food.module';
import { FoodSafetyModule } from './areas/food-safety/food-safety.module';
import { HomeModule } from './areas/home/home.module';
import { SupabaseModule } from './config/supabase.module';
import { SeedService } from './config/seed.service';
import { CommunityModule } from './areas/community/community.module';
import { AdminModule } from './areas/admin/admin.module';
import { FoodReview } from './areas/community/models/food-review.entity';
import { FoodReport } from './areas/community/models/food-report.entity';
import { ReportEvidence } from './areas/community/models/report-evidence.entity';
import { User } from './areas/identity/models/user.entity';
import { FoodProduct } from './areas/food-catalog/models/food-product.entity';
import { Ingredient } from './areas/food-catalog/models/ingredient.entity';
import { NutritionFact } from './areas/food-catalog/models/nutrition-fact.entity';
import { ScoringConfig } from './areas/food-catalog/models/scoring-config.entity';
import { FoodScoreSnapshot } from './areas/food-catalog/models/food-score-snapshot.entity';
import { PreferenceProfile } from './areas/personal-food/models/preference-profile.entity';
import { FoodSafetyDocument } from './areas/food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from './areas/food-safety/models/manufacturer-licence.entity';
import { FoodRule } from './areas/admin/models/food-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot(getDatabaseConfig()),
    TypeOrmModule.forFeature([
      User,
      FoodProduct,
      Ingredient,
      NutritionFact,
      ScoringConfig,
      FoodScoreSnapshot,
      PreferenceProfile,
      FoodSafetyDocument,
      ManufacturerLicence,
      FoodReview,
      FoodReport,
      ReportEvidence,
      FoodRule,
    ]),
    SupabaseModule,
    IdentityModule,
    FoodCatalogModule,
    PersonalFoodModule,
    FoodSafetyModule,
    CommunityModule,
    AdminModule,
    HomeModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
