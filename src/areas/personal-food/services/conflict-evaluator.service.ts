// Feature F16: Food Preference & Allergen Screening Engine
import { Injectable } from '@nestjs/common';
import { PreferenceProfile } from '../models/preference-profile.entity';
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

/**
 * Pure domain evaluation engine for food allergens, lifestyle diets, and personal nutritional guardrails.
 * Zero database dependencies for fast, deterministic, isolated execution.
 */
@Injectable()
export class ConflictEvaluatorService {
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
    this.checkAllergens(userAllergies, ingredients, matchedAllergies, conflicts);

    // 2. DISLIKED INGREDIENTS
    this.checkDislikedIngredients(profile.dislikedIngredients || [], ingredients, conflicts);

    // 3. DIETARY PREFERENCE EVALUATION
    const userDiets = (profile.dietaryPreferences || []).map((d) => d.trim().toLowerCase());
    for (const diet of userDiets) {
      if (!diet) continue;
      this.checkDietaryPreference(diet, productTags, ingredients, product, dietaryMismatches, conflicts);
    }

    // 4. NUTRITION THRESHOLD EVALUATION
    this.checkNutritionThresholds(profile, product, conflicts);

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

  private checkAllergens(
    userAllergies: string[],
    ingredients: any[],
    matchedAllergies: string[],
    conflicts: ConflictItem[],
  ): void {
    for (const allergy of userAllergies) {
      if (!allergy) continue;

      for (const ingredient of ingredients) {
        const ingName = ingredient.name.toLowerCase();
        const ingAllergenType = (ingredient.allergenType || '').toLowerCase();

        const matchesAllergenType =
          ingAllergenType.includes(allergy) ||
          allergy.includes(ingAllergenType && ingAllergenType.length > 2 ? ingAllergenType : '___');
        const matchesName =
          ingName.includes(allergy) ||
          (allergy === 'milk' &&
            (ingName.includes('dairy') ||
              ingName.includes('whey') ||
              ingName.includes('casein') ||
              ingName.includes('butter') ||
              ingName.includes('cheese') ||
              ingName.includes('yogurt'))) ||
          (allergy === 'gluten' &&
            (ingName.includes('wheat') || ingName.includes('barley') || ingName.includes('rye'))) ||
          (allergy === 'tree nuts' &&
            (ingName.includes('almond') ||
              ingName.includes('cashew') ||
              ingName.includes('walnut') ||
              ingName.includes('pistachio') ||
              ingName.includes('hazelnut') ||
              ingName.includes('pecan')));

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
  }

  private checkDislikedIngredients(
    dislikedIngredients: string[],
    ingredients: any[],
    conflicts: ConflictItem[],
  ): void {
    const disliked = dislikedIngredients.map((d) => d.trim().toLowerCase());
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
  }

  private checkDietaryPreference(
    diet: string,
    productTags: string[],
    ingredients: any[],
    product: FoodProduct,
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
    switch (diet) {
      case 'vegan':
        this.checkVegan(productTags, ingredients, dietaryMismatches, conflicts);
        break;
      case 'vegetarian':
        this.checkVegetarian(ingredients, dietaryMismatches, conflicts);
        break;
      case 'gluten-free':
        this.checkGlutenFree(productTags, ingredients, dietaryMismatches, conflicts);
        break;
      case 'dairy-free':
        this.checkDairyFree(productTags, ingredients, dietaryMismatches, conflicts);
        break;
      case 'halal':
        this.checkHalal(productTags, ingredients, dietaryMismatches, conflicts);
        break;
      case 'kosher':
        this.checkKosher(ingredients, dietaryMismatches, conflicts);
        break;
      case 'keto':
        this.checkKeto(productTags, ingredients, product, dietaryMismatches, conflicts);
        break;
    }
  }

  private checkVegan(
    productTags: string[],
    ingredients: any[],
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
    const isTaggedVegan = productTags.includes('vegan');
    if (!isTaggedVegan) {
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

  private checkVegetarian(
    ingredients: any[],
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
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

  private checkGlutenFree(
    productTags: string[],
    ingredients: any[],
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
    const isTaggedGf = productTags.includes('gluten-free');
    if (!isTaggedGf) {
      const glutenIng = ingredients.find((i) => {
        const n = i.name.toLowerCase();
        return (
          n.includes('wheat') ||
          n.includes('barley') ||
          n.includes('rye') ||
          n.includes('gluten')
        );
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

  private checkDairyFree(
    productTags: string[],
    ingredients: any[],
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
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

  private checkHalal(
    productTags: string[],
    ingredients: any[],
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
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

  private checkKosher(
    ingredients: any[],
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
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

  private checkKeto(
    productTags: string[],
    ingredients: any[],
    product: FoodProduct,
    dietaryMismatches: string[],
    conflicts: ConflictItem[],
  ): void {
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

  private checkNutritionThresholds(
    profile: PreferenceProfile,
    product: FoodProduct,
    conflicts: ConflictItem[],
  ): void {
    if (profile.maxSugarPerServing && profile.maxSugarPerServing > 0 && product.nutritionFacts) {
      const sugarFact = product.nutritionFacts.find((n) =>
        n.nutrient.toLowerCase().includes('sugar'),
      );
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
        (n) =>
          n.nutrient.toLowerCase().includes('salt') ||
          n.nutrient.toLowerCase().includes('sodium'),
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
  }
}

// Alias for convenience
export const ConflictEvaluator = ConflictEvaluatorService;
export type ConflictEvaluator = ConflictEvaluatorService;
