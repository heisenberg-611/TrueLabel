// Feature F16: Food Preference & Allergen Profile Orchestrator
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenceProfile } from '../models/preference-profile.entity';
import { UpdatePreferenceProfileDto } from '../models/dto/update-preference-profile.dto';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import {
  ConflictEvaluatorService,
  ConflictEvaluationResult,
  ConflictItem,
  STANDARD_ALLERGENS,
  STANDARD_DIETS,
} from './conflict-evaluator.service';
import {
  MetabolicCalculatorService,
  MetabolicProfileResult,
  MacroSplit,
  DailyCeilings,
  ACTIVITY_MULTIPLIERS,
} from './metabolic-calculator.service';

// Re-export domain contracts & constants for backward compatibility across all callers
export {
  ConflictItem,
  ConflictEvaluationResult,
  STANDARD_ALLERGENS,
  STANDARD_DIETS,
} from './conflict-evaluator.service';
export {
  MacroSplit,
  DailyCeilings,
  MetabolicProfileResult,
  ACTIVITY_MULTIPLIERS,
} from './metabolic-calculator.service';

@Injectable()
export class PreferenceService {
  constructor(
    @InjectRepository(PreferenceProfile)
    private readonly profileRepo: Repository<PreferenceProfile>,
    private readonly conflictEvaluator: ConflictEvaluatorService,
    private readonly metabolicCalculator: MetabolicCalculatorService,
  ) {}

  /**
   * Find profile by user ID
   */
  async findByUserId(userId: number): Promise<PreferenceProfile | null> {
    return this.profileRepo.findOne({ where: { userId } });
  }

  /**
   * Find or initialize a default profile for user
   */
  async findOrCreate(userId: number): Promise<PreferenceProfile> {
    let profile = await this.findByUserId(userId);
    if (!profile) {
      profile = this.profileRepo.create({
        userId,
        allergies: [],
        dietaryPreferences: [],
        dislikedIngredients: [],
        calorieGoal: null,
        maxSugarPerServing: null,
        maxSodiumPerServing: null,
        minProteinPerServing: null,
      });
      profile = await this.profileRepo.save(profile);
    }
    return profile;
  }

  /**
   * Update or create user's preference and allergen profile
   */
  async updateProfile(
    userId: number,
    dto: UpdatePreferenceProfileDto,
  ): Promise<PreferenceProfile> {
    const profile = await this.findOrCreate(userId);

    if (dto.allergies !== undefined) {
      profile.allergies = dto.allergies || [];
    }
    if (dto.dietaryPreferences !== undefined) {
      profile.dietaryPreferences = dto.dietaryPreferences || [];
    }
    if (dto.dislikedIngredients !== undefined) {
      profile.dislikedIngredients = dto.dislikedIngredients || [];
    }
    if (dto.calorieGoal !== undefined) {
      profile.calorieGoal =
        dto.calorieGoal !== null && dto.calorieGoal !== undefined ? Number(dto.calorieGoal) : null;
    }
    if (dto.maxSugarPerServing !== undefined) {
      profile.maxSugarPerServing =
        dto.maxSugarPerServing !== null && dto.maxSugarPerServing !== undefined
          ? Number(dto.maxSugarPerServing)
          : null;
    }
    if (dto.maxSodiumPerServing !== undefined) {
      profile.maxSodiumPerServing =
        dto.maxSodiumPerServing !== null && dto.maxSodiumPerServing !== undefined
          ? Number(dto.maxSodiumPerServing)
          : null;
    }
    if (dto.minProteinPerServing !== undefined) {
      profile.minProteinPerServing =
        dto.minProteinPerServing !== null && dto.minProteinPerServing !== undefined
          ? Number(dto.minProteinPerServing)
          : null;
    }
    if (dto.age !== undefined) {
      profile.age = dto.age !== null && dto.age !== undefined ? Number(dto.age) : null;
    }
    if (dto.gender !== undefined) {
      profile.gender = (dto.gender || null) as any;
    }
    if (dto.heightCm !== undefined) {
      profile.heightCm =
        dto.heightCm !== null && dto.heightCm !== undefined ? Number(dto.heightCm) : null;
    }
    if (dto.weightKg !== undefined) {
      profile.weightKg =
        dto.weightKg !== null && dto.weightKg !== undefined ? Number(dto.weightKg) : null;
    }
    if (dto.activityLevel !== undefined) {
      profile.activityLevel = (dto.activityLevel || null) as any;
    }

    return this.profileRepo.save(profile);
  }

  /**
   * Evaluate a food product against user's health & allergen profile.
   * Delegates evaluation directly to ConflictEvaluatorService.
   */
  evaluateProductConflict(
    profile: PreferenceProfile | null,
    product: FoodProduct,
  ): ConflictEvaluationResult {
    return this.conflictEvaluator.evaluateProductConflict(profile, product);
  }

  /**
   * Feature N4 Preparation: Mifflin-St Jeor Metabolic Calculation Engine.
   * Delegates calculation directly to MetabolicCalculatorService.
   */
  calculateMetabolicPlan(profile: PreferenceProfile | null): MetabolicProfileResult {
    return this.metabolicCalculator.calculateMetabolicPlan(profile);
  }
}
