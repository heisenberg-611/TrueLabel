// Feature F16: Food Preference & Allergen Profile
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenceProfile } from '../models/preference-profile.entity';
import { UpdatePreferenceProfileDto } from '../models/dto/update-preference-profile.dto';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';

export interface ConflictItem {
  category: 'allergen' | 'dietary' | 'nutrition';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  source: string;
}

export interface ConflictEvaluationResult {
  hasConflicts: boolean;
  hasAllergenConflict: boolean;
  hasDietaryConflict: boolean;
  hasNutritionWarning: boolean;
  conflicts: ConflictItem[];
  matchedAllergies: string[];
  dietaryMismatches: string[];
  isSafeForUser: boolean;
  profileConfigured: boolean;
}

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

export const STANDARD_ALLERGENS = [
  'Peanut',
  'Tree Nuts',
  'Milk',
  'Egg',
  'Gluten',
  'Soy',
  'Fish',
  'Shellfish',
  'Sesame',
];

export const STANDARD_DIETS = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Halal',
  'Kosher',
  'Keto',
];

@Injectable()
export class PreferenceService {
  constructor(
    @InjectRepository(PreferenceProfile)
    private readonly profileRepo: Repository<PreferenceProfile>,
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
    let profile = await this.findOrCreate(userId);

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
   * Evaluate a food product against user's health & allergen profile
   */
  evaluateProductConflict(
    profile: PreferenceProfile | null,
    product: FoodProduct,
  ): ConflictEvaluationResult {
    // If no profile or empty preferences configured
    const isConfigured = Boolean(
      profile &&
        ((profile.allergies && profile.allergies.length > 0) ||
          (profile.dietaryPreferences && profile.dietaryPreferences.length > 0) ||
          (profile.dislikedIngredients && profile.dislikedIngredients.length > 0) ||
          profile.maxSugarPerServing ||
          profile.maxSodiumPerServing ||
          profile.minProteinPerServing),
    );

    if (!isConfigured || !profile) {
      return {
        hasConflicts: false,
        hasAllergenConflict: false,
        hasDietaryConflict: false,
        hasNutritionWarning: false,
        conflicts: [],
        matchedAllergies: [],
        dietaryMismatches: [],
        isSafeForUser: true,
        profileConfigured: false,
      };
    }

    const conflicts: ConflictItem[] = [];
    const matchedAllergies: string[] = [];
    const dietaryMismatches: string[] = [];

    const userAllergies = (profile.allergies || []).map((a) => a.trim().toLowerCase());
    const ingredients = product.ingredients || [];
    const productTags = (product.dietaryTags || []).map((t) => t.trim().toLowerCase());

    // 1. ALLERGEN EVALUATION (Critical Severity)
    for (const allergy of userAllergies) {
      if (!allergy) continue;

      for (const ingredient of ingredients) {
        const ingName = ingredient.name.toLowerCase();
        const ingAllergenType = (ingredient.allergenType || '').toLowerCase();

        const matchesAllergenType =
          ingAllergenType.includes(allergy) || allergy.includes(ingAllergenType && ingAllergenType.length > 2 ? ingAllergenType : '___');
        const matchesName =
          ingName.includes(allergy) ||
          (allergy === 'milk' && (ingName.includes('dairy') || ingName.includes('whey') || ingName.includes('casein') || ingName.includes('butter') || ingName.includes('cheese') || ingName.includes('yogurt'))) ||
          (allergy === 'gluten' && (ingName.includes('wheat') || ingName.includes('barley') || ingName.includes('rye'))) ||
          (allergy === 'tree nuts' && (ingName.includes('almond') || ingName.includes('cashew') || ingName.includes('walnut') || ingName.includes('pistachio') || ingName.includes('hazelnut') || ingName.includes('pecan')));

        if (ingredient.isAllergen && (matchesAllergenType || matchesName)) {
          if (!matchedAllergies.includes(allergy)) {
            matchedAllergies.push(allergy);
          }
          conflicts.push({
            category: 'allergen',
            severity: 'critical',
            title: `Critical Allergen Match: ${ingredient.name}`,
            description: `Contains declared allergen ingredient "${ingredient.name}" (${ingredient.allergenType || allergy}) matching your allergy profile.`,
            source: ingredient.name,
          });
          break;
        } else if (matchesName) {
          if (!matchedAllergies.includes(allergy)) {
            matchedAllergies.push(allergy);
          }
          conflicts.push({
            category: 'allergen',
            severity: 'critical',
            title: `Potential Allergen Match: ${ingredient.name}`,
            description: `Ingredient "${ingredient.name}" contains or is derived from "${allergy}".`,
            source: ingredient.name,
          });
          break;
        }
      }
    }

    // 2. DISLIKED INGREDIENTS
    const disliked = (profile.dislikedIngredients || []).map((d) => d.trim().toLowerCase());
    for (const item of disliked) {
      if (!item) continue;
      for (const ingredient of ingredients) {
        if (ingredient.name.toLowerCase().includes(item)) {
          conflicts.push({
            category: 'dietary',
            severity: 'warning',
            title: `Avoided Ingredient: ${ingredient.name}`,
            description: `Contains "${ingredient.name}", which is on your custom avoid list.`,
            source: ingredient.name,
          });
          break;
        }
      }
    }

    // 3. DIETARY PREFERENCE EVALUATION
    const userDiets = (profile.dietaryPreferences || []).map((d) => d.trim().toLowerCase());

    for (const diet of userDiets) {
      if (!diet) continue;

      if (diet === 'vegan') {
        const isTaggedVegan = productTags.includes('vegan');
        if (!isTaggedVegan) {
          // Check for animal/dairy ingredients
          const animalIngredient = ingredients.find((i) => {
            const n = i.name.toLowerCase();
            return (
              n.includes('milk') ||
              n.includes('egg') ||
              n.includes('honey') ||
              n.includes('gelatin') ||
              n.includes('beef') ||
              n.includes('chicken') ||
              n.includes('pork') ||
              n.includes('fish') ||
              n.includes('whey') ||
              n.includes('cheese') ||
              n.includes('butter')
            );
          });

          if (animalIngredient) {
            dietaryMismatches.push('Vegan');
            conflicts.push({
              category: 'dietary',
              severity: 'warning',
              title: 'Dietary Mismatch: Vegan',
              description: `You prefer a Vegan diet, but this product contains "${animalIngredient.name}" and is not certified vegan.`,
              source: animalIngredient.name,
            });
          }
        }
      }

      if (diet === 'vegetarian') {
        const meatIngredient = ingredients.find((i) => {
          const n = i.name.toLowerCase();
          return (
            n.includes('beef') ||
            n.includes('chicken') ||
            n.includes('pork') ||
            n.includes('fish') ||
            n.includes('gelatin') ||
            n.includes('meat')
          );
        });
        if (meatIngredient) {
          dietaryMismatches.push('Vegetarian');
          conflicts.push({
            category: 'dietary',
            severity: 'warning',
            title: 'Dietary Mismatch: Vegetarian',
            description: `Contains animal-derived ingredient "${meatIngredient.name}".`,
            source: meatIngredient.name,
          });
        }
      }

      if (diet === 'gluten-free') {
        const isTaggedGf = productTags.includes('gluten-free');
        if (!isTaggedGf) {
          const glutenIng = ingredients.find((i) => {
            const n = i.name.toLowerCase();
            return n.includes('wheat') || n.includes('barley') || n.includes('rye') || n.includes('gluten');
          });
          if (glutenIng) {
            dietaryMismatches.push('Gluten-Free');
            conflicts.push({
              category: 'dietary',
              severity: 'warning',
              title: 'Dietary Mismatch: Gluten-Free',
              description: `Product contains "${glutenIng.name}" and is not tagged Gluten-Free.`,
              source: glutenIng.name,
            });
          }
        }
      }

      if (diet === 'dairy-free') {
        const isTaggedDf = productTags.includes('dairy-free') || productTags.includes('vegan');
        if (!isTaggedDf) {
          const dairyIng = ingredients.find((i) => {
            const n = i.name.toLowerCase();
            return (
              n.includes('milk') ||
              n.includes('whey') ||
              n.includes('casein') ||
              n.includes('butter') ||
              n.includes('cheese') ||
              n.includes('yogurt')
            );
          });
          if (dairyIng) {
            dietaryMismatches.push('Dairy-Free');
            conflicts.push({
              category: 'dietary',
              severity: 'warning',
              title: 'Dietary Mismatch: Dairy-Free',
              description: `Product contains dairy ingredient "${dairyIng.name}".`,
              source: dairyIng.name,
            });
          }
        }
      }

      // 3.5. HALAL EVALUATION
      if (diet === 'halal') {
        const isTaggedHalal = productTags.includes('halal');
        const porkKeywords = [
          'pork',
          'bacon',
          'ham',
          'lard',
          'prosciutto',
          'pancetta',
          'swine',
          'pork fat',
          'pork gelatin',
          'pepperoni',
        ];
        const alcoholKeywords = [
          'alcohol',
          'wine',
          'beer',
          'rum',
          'brandy',
          'liqueur',
          'ethanol',
          'spirit',
        ];

        const forbiddenIng = ingredients.find((i) => {
          const n = i.name.toLowerCase();
          return (
            porkKeywords.some((p) => n.includes(p)) ||
            alcoholKeywords.some((a) => n.includes(a))
          );
        });

        if (forbiddenIng) {
          dietaryMismatches.push('Halal');
          conflicts.push({
            category: 'dietary',
            severity: 'critical',
            title: `Non-Halal Ingredient: ${forbiddenIng.name}`,
            description: `Contains "${forbiddenIng.name}", which is strictly prohibited under Halal dietary standards.`,
            source: forbiddenIng.name,
          });
        } else if (!isTaggedHalal) {
          // If not certified halal, check for generic commercial gelatin or non-halal animal fats
          const questionableIng = ingredients.find((i) => {
            const n = i.name.toLowerCase();
            return (
              n === 'gelatin' ||
              n.includes('beef gelatin') ||
              n.includes('animal fat')
            );
          });
          if (questionableIng) {
            dietaryMismatches.push('Halal');
            conflicts.push({
              category: 'dietary',
              severity: 'warning',
              title: `Uncertified Halal Ingredient: ${questionableIng.name}`,
              description: `Contains "${questionableIng.name}" without certified Halal verification. Commercial gelatin is commonly porcine-derived.`,
              source: questionableIng.name,
            });
          }
        }
      }

      // 3.6. KOSHER EVALUATION
      if (diet === 'kosher') {
        const porkKeywords = ['pork', 'bacon', 'ham', 'lard', 'swine'];
        const shellfishKeywords = [
          'shrimp',
          'prawn',
          'crab',
          'lobster',
          'oyster',
          'clam',
          'mussel',
          'scallop',
          'squid',
          'octopus',
        ];

        const nonKosherIng = ingredients.find((i) => {
          const n = i.name.toLowerCase();
          return (
            porkKeywords.some((p) => n.includes(p)) ||
            shellfishKeywords.some((s) => n.includes(s))
          );
        });

        if (nonKosherIng) {
          dietaryMismatches.push('Kosher');
          conflicts.push({
            category: 'dietary',
            severity: 'warning',
            title: `Non-Kosher Ingredient: ${nonKosherIng.name}`,
            description: `Contains non-kosher ingredient "${nonKosherIng.name}" (pork or shellfish).`,
            source: nonKosherIng.name,
          });
        }

        // Basar b'Chalav: Prohibition against mixing meat and dairy in the same product
        const meatIng = ingredients.find((i) => {
          const n = i.name.toLowerCase();
          return (
            n.includes('beef') ||
            n.includes('chicken') ||
            n.includes('turkey') ||
            n.includes('lamb') ||
            n.includes('pork') ||
            n.includes('meat')
          );
        });
        const dairyIng = ingredients.find((i) => {
          const n = i.name.toLowerCase();
          return (
            n.includes('milk') ||
            n.includes('cheese') ||
            n.includes('butter') ||
            n.includes('whey') ||
            n.includes('casein') ||
            n.includes('cream') ||
            n.includes('yogurt')
          );
        });

        if (meatIng && dairyIng) {
          dietaryMismatches.push('Kosher');
          conflicts.push({
            category: 'dietary',
            severity: 'warning',
            title: 'Kosher Meat & Dairy Conflict',
            description: `Contains both meat ("${meatIng.name}") and dairy ("${dairyIng.name}"), violating kosher rules prohibiting mixing meat and milk.`,
            source: `${meatIng.name} + ${dairyIng.name}`,
          });
        }
      }

      // 3.7. KETO EVALUATION
      if (diet === 'keto') {
        const isTaggedKeto = productTags.includes('keto') || productTags.includes('low-carb');
        if (!isTaggedKeto) {
          let highCarbDetected = false;
          if (product.nutritionFacts && product.nutritionFacts.length > 0) {
            const sugarFact = product.nutritionFacts.find((n) =>
              n.nutrient.toLowerCase().includes('sugar'),
            );
            const carbFact = product.nutritionFacts.find(
              (n) =>
                n.nutrient.toLowerCase().includes('carbohydrate') ||
                n.nutrient.toLowerCase() === 'carbs',
            );

            if (sugarFact) {
              const servingSugar =
                sugarFact.amountPerServing !== null && sugarFact.amountPerServing !== undefined
                  ? sugarFact.amountPerServing
                  : (sugarFact.amountPer100g * (product.servingSize || 100)) / 100;
              if (servingSugar > 5) {
                highCarbDetected = true;
                dietaryMismatches.push('Keto');
                conflicts.push({
                  category: 'dietary',
                  severity: 'warning',
                  title: 'Keto Mismatch: High Sugar',
                  description: `Contains ${servingSugar.toFixed(1)}g sugar per serving, which exceeds standard ketogenic limits (≤5g/serving).`,
                  source: 'Nutrition Facts',
                });
              }
            }

            if (!highCarbDetected && carbFact) {
              const servingCarbs =
                carbFact.amountPerServing !== null && carbFact.amountPerServing !== undefined
                  ? carbFact.amountPerServing
                  : (carbFact.amountPer100g * (product.servingSize || 100)) / 100;
              if (servingCarbs > 15) {
                highCarbDetected = true;
                dietaryMismatches.push('Keto');
                conflicts.push({
                  category: 'dietary',
                  severity: 'warning',
                  title: 'Keto Mismatch: High Carbohydrates',
                  description: `Contains ${servingCarbs.toFixed(1)}g carbohydrates per serving, exceeding ketogenic net-carb thresholds (≤15g/serving).`,
                  source: 'Nutrition Facts',
                });
              }
            }
          }

          const refinedSweetener = ingredients.find((i) => {
            const n = i.name.toLowerCase();
            return (
              n.includes('high fructose corn syrup') ||
              n.includes('corn syrup') ||
              n.includes('glucose syrup') ||
              n.includes('cane sugar') ||
              n.includes('dextrose') ||
              n.includes('maltodextrin')
            );
          });

          if (refinedSweetener && !highCarbDetected) {
            dietaryMismatches.push('Keto');
            conflicts.push({
              category: 'dietary',
              severity: 'warning',
              title: `Keto Mismatch: Refined Sweetener (${refinedSweetener.name})`,
              description: `Contains refined glycemic ingredient "${refinedSweetener.name}", which disrupts ketosis.`,
              source: refinedSweetener.name,
            });
          }
        }
      }
    }

    // 4. NUTRITION THRESHOLD EVALUATION
    if (profile.maxSugarPerServing && profile.maxSugarPerServing > 0 && product.nutritionFacts) {
      const sugarFact = product.nutritionFacts.find((n) => n.nutrient.toLowerCase().includes('sugar'));
      if (sugarFact) {
        const servingSugar =
          sugarFact.amountPerServing !== null && sugarFact.amountPerServing !== undefined
            ? sugarFact.amountPerServing
            : (sugarFact.amountPer100g * (product.servingSize || 100)) / 100;

        if (servingSugar > profile.maxSugarPerServing) {
          conflicts.push({
            category: 'nutrition',
            severity: 'info',
            title: 'Sugar Target Exceeded',
            description: `${servingSugar.toFixed(1)}g sugar per serving exceeds your limit of ${profile.maxSugarPerServing}g.`,
            source: 'Nutrition Facts',
          });
        }
      }
    }

    if (profile.maxSodiumPerServing && profile.maxSodiumPerServing > 0 && product.nutritionFacts) {
      const saltFact = product.nutritionFacts.find(
        (n) => n.nutrient.toLowerCase().includes('salt') || n.nutrient.toLowerCase().includes('sodium'),
      );
      if (saltFact) {
        const servingSalt =
          saltFact.amountPerServing !== null && saltFact.amountPerServing !== undefined
            ? saltFact.amountPerServing
            : (saltFact.amountPer100g * (product.servingSize || 100)) / 100;

        if (servingSalt > profile.maxSodiumPerServing) {
          conflicts.push({
            category: 'nutrition',
            severity: 'info',
            title: 'Sodium/Salt Target Exceeded',
            description: `${servingSalt.toFixed(2)}g per serving exceeds your target limit of ${profile.maxSodiumPerServing}g.`,
            source: 'Nutrition Facts',
          });
        }
      }
    }

    if (profile.minProteinPerServing && profile.minProteinPerServing > 0 && product.nutritionFacts) {
      const proteinFact = product.nutritionFacts.find((n) =>
        n.nutrient.toLowerCase().includes('protein'),
      );
      if (proteinFact) {
        const servingProtein =
          proteinFact.amountPerServing !== null && proteinFact.amountPerServing !== undefined
            ? proteinFact.amountPerServing
            : (proteinFact.amountPer100g * (product.servingSize || 100)) / 100;

        if (servingProtein < profile.minProteinPerServing) {
          conflicts.push({
            category: 'nutrition',
            severity: 'info',
            title: 'Protein Target Inadequate',
            description: `${servingProtein.toFixed(1)}g protein per serving is below your target minimum of ${profile.minProteinPerServing}g.`,
            source: 'Nutrition Facts',
          });
        }
      }
    }

    const hasAllergenConflict = conflicts.some((c) => c.category === 'allergen');
    const hasDietaryConflict = conflicts.some((c) => c.category === 'dietary');
    const hasNutritionWarning = conflicts.some((c) => c.category === 'nutrition');

    return {
      hasConflicts: conflicts.length > 0,
      hasAllergenConflict,
      hasDietaryConflict,
      hasNutritionWarning,
      conflicts,
      matchedAllergies,
      dietaryMismatches,
      isSafeForUser: !hasAllergenConflict && !hasDietaryConflict,
      profileConfigured: true,
    };
  }

  /**
   * Feature N4 Preparation: Mifflin-St Jeor Metabolic Calculation Engine
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

