import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodRule } from './models/food-rule.entity';
import { RuleManagementService } from './services/rule-management.service';
import { AdminRulesController } from './controllers/admin-rules.controller';
import { AdminScoringController } from './controllers/admin-scoring.controller';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';

@Module({
  imports: [TypeOrmModule.forFeature([FoodRule]), FoodCatalogModule],
  controllers: [AdminRulesController, AdminScoringController],
  providers: [RuleManagementService],
  exports: [RuleManagementService],
})
export class AdminModule {}
