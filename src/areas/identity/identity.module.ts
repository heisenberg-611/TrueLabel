import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './models/user.entity';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { DashboardService } from './services/dashboard.service';
import { DashboardController } from './controllers/dashboard.controller';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { FoodSafetyModule } from '../food-safety/food-safety.module';
import { PersonalFoodModule } from '../personal-food/personal-food.module';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    FoodCatalogModule,
    FoodSafetyModule,
    PersonalFoodModule,
    CommunityModule,
  ],
  controllers: [AuthController, DashboardController],
  providers: [AuthService, DashboardService],
  exports: [AuthService, DashboardService],
})
export class IdentityModule {}

