// Feature F16: Food Preference & Allergen Profile
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenceProfile } from './models/preference-profile.entity';
import { PreferenceService } from './services/preference.service';
import { PreferenceController } from './controllers/preference.controller';
import { ConflictEvaluatorService } from './services/conflict-evaluator.service';
import { MetabolicCalculatorService } from './services/metabolic-calculator.service';

@Module({
  imports: [TypeOrmModule.forFeature([PreferenceProfile])],
  controllers: [PreferenceController],
  providers: [
    PreferenceService,
    ConflictEvaluatorService,
    MetabolicCalculatorService,
  ],
  exports: [
    PreferenceService,
    ConflictEvaluatorService,
    MetabolicCalculatorService,
  ],
})
export class PersonalFoodModule {}
