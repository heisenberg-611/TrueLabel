// Feature F16 / N4 Preparation: Mifflin-St Jeor Metabolic Calculation Engine
import { Injectable } from '@nestjs/common';
import { PreferenceProfile } from '../models/preference-profile.entity';

export interface MacroSplit {
  proteinGrams: number;
  proteinCalories: number;
  proteinPercentage: number;
  carbsGrams: number;
  carbsCalories: number;
  carbsPercentage: number;
  fatGrams: number;
  fatCalories: number;
  fatPercentage: number;
}

export interface DailyCeilings {
  maxSugarGrams: number;
  maxSodiumGrams: number;
}

export interface MetabolicProfileResult {
  isCalculated: boolean;
  bmr: number | null;
  tdee: number | null;
  activityMultiplier: number | null;
  activityLabel: string | null;
  dailyCalorieTarget: number | null;
  calorieGoalSource: 'custom' | 'tdee_maintenance' | 'deficit' | 'surplus' | null;
  goalLabel: string | null;
  macroSplit: MacroSplit | null;
  dailyCeilings: DailyCeilings | null;
  missingMetrics: string[];
  isUnderage: boolean;
  advisoryNote: string | null;
  formulaDescription: string | null;
}

export const ACTIVITY_MULTIPLIERS: Record<string, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentary (Little/no exercise)' },
  light: { factor: 1.375, label: 'Lightly Active (1–3 days/week)' },
  moderate: { factor: 1.55, label: 'Moderately Active (3–5 days/week)' },
  active: { factor: 1.725, label: 'Very Active (6–7 days/week)' },
  very_active: { factor: 1.9, label: 'Extra Active (Physical job or 2x training)' },
};

/**
 * Pure calculation engine for BMR, TDEE, macronutrient distribution, and nutritional ceilings.
 * Adheres to the Mifflin-St Jeor equation and WHO nutritional guidelines with zero database dependencies.
 */
@Injectable()
export class MetabolicCalculatorService {
  /**
   * Computes BMR, TDEE, and Recommended Caloric/Macronutrient Blueprint from body metrics
   */
  calculateMetabolicPlan(profile: PreferenceProfile | null): MetabolicProfileResult {
    const missingMetrics: string[] = [];

    if (!profile) {
      return {
        isCalculated: false,
        bmr: null,
        tdee: null,
        activityMultiplier: null,
        activityLabel: null,
        dailyCalorieTarget: null,
        calorieGoalSource: null,
        goalLabel: null,
        macroSplit: null,
        dailyCeilings: null,
        missingMetrics: ['age', 'gender', 'height', 'weight', 'activity level'],
        isUnderage: false,
        advisoryNote:
          'Configure your body metrics to calculate your personalized metabolic rate and daily nutrition targets.',
        formulaDescription: null,
      };
    }

    if (!profile.age || profile.age <= 0) missingMetrics.push('age');
    if (!profile.gender) missingMetrics.push('gender');
    if (!profile.heightCm || profile.heightCm <= 0) missingMetrics.push('height');
    if (!profile.weightKg || profile.weightKg <= 0) missingMetrics.push('weight');
    if (!profile.activityLevel) missingMetrics.push('activity level');

    if (missingMetrics.length > 0) {
      return {
        isCalculated: false,
        bmr: null,
        tdee: null,
        activityMultiplier: null,
        activityLabel: null,
        dailyCalorieTarget: null,
        calorieGoalSource: null,
        goalLabel: null,
        macroSplit: null,
        dailyCeilings: null,
        missingMetrics,
        isUnderage: false,
        advisoryNote: `Please provide your ${missingMetrics.join(', ')} in the body metrics section to calculate your personalized metabolic rate.`,
        formulaDescription: null,
      };
    }

    const age = Number(profile.age);
    const weight = Number(profile.weightKg);
    const height = Number(profile.heightCm);
    const gender = String(profile.gender).toLowerCase();
    const isUnderage = age < 18;

    // Mifflin-St Jeor Equation:
    // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + s
    // s = +5 for male, -161 for female, -78 for other/neutral
    let s = -78;
    if (gender === 'male') {
      s = 5;
    } else if (gender === 'female') {
      s = -161;
    }

    const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + s);

    const activityInfo =
      ACTIVITY_MULTIPLIERS[profile.activityLevel] || {
        factor: 1.2,
        label: 'Sedentary (Little/no exercise)',
      };
    const tdee = Math.round(bmr * activityInfo.factor);

    // Target Calorie Determination
    let dailyCalorieTarget = tdee;
    let calorieGoalSource: 'custom' | 'tdee_maintenance' | 'deficit' | 'surplus' =
      'tdee_maintenance';
    let goalLabel = 'Weight Maintenance (TDEE)';

    if (profile.calorieGoal && profile.calorieGoal >= 800) {
      dailyCalorieTarget = Math.round(profile.calorieGoal);
      calorieGoalSource = 'custom';
      const diff = dailyCalorieTarget - tdee;
      if (diff <= -250) {
        goalLabel = `Calorie Deficit (${Math.abs(diff)} kcal/day below TDEE)`;
        calorieGoalSource = 'deficit';
      } else if (diff >= 250) {
        goalLabel = `Calorie Surplus (+${diff} kcal/day above TDEE)`;
        calorieGoalSource = 'surplus';
      } else {
        goalLabel = 'Maintenance Target';
      }
    }

    // Clinical Safe Floor Advisory (1500 kcal for male, 1200 kcal for female/other)
    const safeFloor = gender === 'male' ? 1500 : 1200;
    let advisoryNote: string | null = null;
    if (dailyCalorieTarget < safeFloor) {
      advisoryNote = `Your daily calorie target (${dailyCalorieTarget} kcal) is below the clinical safe floor (${safeFloor} kcal). Low energy intake should be monitored by a healthcare professional.`;
    } else if (isUnderage) {
      advisoryNote =
        'Nutritional requirements for individuals under 18 should be guided by a pediatrician or dietitian. Calculations are provided for educational reference only.';
    }

    // Balanced Macronutrient Distribution (25% Protein, 50% Carbohydrates, 25% Healthy Fats)
    const proteinCalories = Math.round(dailyCalorieTarget * 0.25);
    const carbsCalories = Math.round(dailyCalorieTarget * 0.5);
    const fatCalories = Math.round(dailyCalorieTarget * 0.25);

    const macroSplit: MacroSplit = {
      proteinGrams: Math.round(proteinCalories / 4),
      proteinCalories,
      proteinPercentage: 25,
      carbsGrams: Math.round(carbsCalories / 4),
      carbsCalories,
      carbsPercentage: 50,
      fatGrams: Math.round(fatCalories / 9),
      fatCalories,
      fatPercentage: 25,
    };

    // Safe Daily Ceilings:
    // WHO: Added sugars <= 10% total calories capped at 25g/day; Sodium <= 2.0g/day
    const maxSugarGrams = profile.maxSugarPerServing
      ? Math.round(profile.maxSugarPerServing * 3)
      : Math.min(25, Math.round((dailyCalorieTarget * 0.1) / 4));

    const maxSodiumGrams = profile.maxSodiumPerServing
      ? Number(profile.maxSodiumPerServing * 3)
      : 2.0;

    const genderSNotation = s >= 0 ? `+${s}` : `${s}`;
    const formulaDescription = `BMR = (10×${weight}kg) + (6.25×${height}cm) - (5×${age}y) ${genderSNotation} = ${bmr} kcal/day · TDEE = ${bmr} × ${activityInfo.factor} = ${tdee} kcal/day`;

    return {
      isCalculated: true,
      bmr,
      tdee,
      activityMultiplier: activityInfo.factor,
      activityLabel: activityInfo.label,
      dailyCalorieTarget,
      calorieGoalSource,
      goalLabel,
      macroSplit,
      dailyCeilings: {
        maxSugarGrams,
        maxSodiumGrams: Number(maxSodiumGrams.toFixed(1)),
      },
      missingMetrics: [],
      isUnderage,
      advisoryNote,
      formulaDescription,
    };
  }
}

// Alias for convenience
export const MetabolicCalculator = MetabolicCalculatorService;
export type MetabolicCalculator = MetabolicCalculatorService;
