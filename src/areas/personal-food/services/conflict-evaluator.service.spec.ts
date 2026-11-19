// Feature F16: ConflictEvaluatorService Unit Tests (Pure Domain Screening Engine)
import { ConflictEvaluatorService } from './conflict-evaluator.service';
import { PreferenceProfile } from '../models/preference-profile.entity';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';

describe('ConflictEvaluatorService (Pure Domain Engine)', () => {
  let evaluator: ConflictEvaluatorService;

  const mockProfile: PreferenceProfile = {
    id: 1,
    userId: 10,
    allergies: ['Peanut', 'Milk'],
    dietaryPreferences: ['Vegan'],
    dislikedIngredients: ['Cilantro'],
    calorieGoal: 2000,
    maxSugarPerServing: 5,
    maxSodiumPerServing: 1.5,
    minProteinPerServing: 10,
    age: 28,
    gender: 'female',
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseProduct: FoodProduct = {
    id: 100,
    barcode: '1234567890123',
    name: 'Organic Almond Bar',
    brand: 'NutriGood',
    description: 'Clean energy snack',
    servingSize: 40,
    servingUnit: 'g',
    qualityScore: 92,
    verificationStatus: 'verified',
    recallStatus: 'clear',
    dietaryTags: ['Vegan', 'Gluten-Free'],
    category: 'Snacks',
    imageUrl: null,
    status: 'active',
    manufacturerId: 1,
    ingredients: [
      { id: 1, name: 'Almonds', isAllergen: true, allergenType: 'Tree Nuts', orderIndex: 1, additiveCode: '', hazardLevel: 'safe', explanation: '', product: null as any },
      { id: 2, name: 'Oats', isAllergen: false, allergenType: null, orderIndex: 2, additiveCode: '', hazardLevel: 'safe', explanation: '', product: null as any },
    ],
    nutritionFacts: [
      { id: 1, nutrient: 'Sugar', amountPer100g: 8, amountPerServing: 3.2, unit: 'g', dailyValuePercentage: 4, product: null as any },
      { id: 2, nutrient: 'Protein', amountPer100g: 28, amountPerServing: 11.2, unit: 'g', dailyValuePercentage: 22, product: null as any },
      { id: 3, nutrient: 'Sodium', amountPer100g: 0.1, amountPerServing: 0.04, unit: 'g', dailyValuePercentage: 2, product: null as any },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  beforeEach(() => {
    // Pure domain engine with zero database dependencies
    evaluator = new ConflictEvaluatorService();
  });

  describe('Unconfigured & Boundary Checks', () => {
    it('should return unconfigured status when profile is null', () => {
      const result = evaluator.evaluateProductConflict(null, baseProduct);
      expect(result.profileConfigured).toBe(false);
      expect(result.hasConflicts).toBe(false);
      expect(result.isSafeForUser).toBe(true);
    });

    it('should return unconfigured status when profile has empty preferences', () => {
      const emptyProfile = {
        ...mockProfile,
        allergies: [],
        dietaryPreferences: [],
        dislikedIngredients: [],
        maxSugarPerServing: null,
        maxSodiumPerServing: null,
        minProteinPerServing: null,
      } as PreferenceProfile;

      const result = evaluator.evaluateProductConflict(emptyProfile, baseProduct);
      expect(result.profileConfigured).toBe(false);
      expect(result.isSafeForUser).toBe(true);
    });

    it('should return safe clearance for compliant product with zero conflicts', () => {
      const result = evaluator.evaluateProductConflict(mockProfile, baseProduct);
      expect(result.profileConfigured).toBe(true);
      expect(result.hasConflicts).toBe(false);
      expect(result.hasAllergenConflict).toBe(false);
      expect(result.hasDietaryConflict).toBe(false);
      expect(result.isSafeForUser).toBe(true);
    });

    it('should handle product with empty ingredients and missing nutrition facts cleanly', () => {
      const emptyProduct = {
        ...baseProduct,
        ingredients: [],
        nutritionFacts: [],
      } as FoodProduct;

      const result = evaluator.evaluateProductConflict(mockProfile, emptyProduct);
      expect(result.profileConfigured).toBe(true);
      expect(result.hasConflicts).toBe(false);
      expect(result.isSafeForUser).toBe(true);
    });
  });

  describe('Allergen Screening (Critical Severity)', () => {
    it('should detect declared allergen match with critical severity', () => {
      const peanutProduct: FoodProduct = {
        ...baseProduct,
        ingredients: [
          { id: 1, name: 'Peanut Butter', isAllergen: true, allergenType: 'Peanut', orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, peanutProduct);
      expect(result.hasConflicts).toBe(true);
      expect(result.hasAllergenConflict).toBe(true);
      expect(result.isSafeForUser).toBe(false);
      expect(result.matchedAllergies).toContain('peanut');
      expect(result.conflicts[0].severity).toBe('critical');
    });

    it('should detect derived dairy allergen for milk allergy', () => {
      const dairyProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Whey Protein', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, dairyProduct);
      expect(result.hasAllergenConflict).toBe(true);
      expect(result.matchedAllergies).toContain('milk');
      expect(result.isSafeForUser).toBe(false);
    });
  });

  describe('Disliked Ingredients', () => {
    it('should flag warning for avoided custom ingredients', () => {
      const cilantroProduct: FoodProduct = {
        ...baseProduct,
        ingredients: [
          { id: 1, name: 'Fresh Cilantro', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, cilantroProduct);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.title.includes('Avoided Ingredient'))).toBe(true);
    });
  });

  describe('Lifestyle Dietary Preferences', () => {
    it('should detect dietary mismatch when user is Vegan but product contains dairy', () => {
      const dairyProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: ['Vegetarian'],
        ingredients: [
          { id: 1, name: 'Milk Solids', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, dairyProduct);
      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Vegan');
      expect(result.isSafeForUser).toBe(false);
    });

    it('should detect vegetarian conflict when product contains meat or gelatin', () => {
      const vegProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Vegetarian'],
        allergies: [],
      };
      const chickenProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Chicken Extract', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(vegProfile, chickenProduct);
      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Vegetarian');
    });

    it('should detect gluten-free conflict when product contains wheat or barley', () => {
      const gfProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Gluten-Free'],
        allergies: [],
      };
      const wheatProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Wheat Flour', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(gfProfile, wheatProduct);
      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Gluten-Free');
    });

    it('should detect critical Halal conflict when product contains pork or alcohol', () => {
      const halalProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Halal'],
        allergies: [],
      };

      const porkProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Bacon bits', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };
      const alcoholProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Red wine vinegar extract', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const porkResult = evaluator.evaluateProductConflict(halalProfile, porkProduct);
      expect(porkResult.hasDietaryConflict).toBe(true);
      expect(porkResult.dietaryMismatches).toContain('Halal');
      expect(porkResult.conflicts.some((c) => c.severity === 'critical')).toBe(true);

      const alcoholResult = evaluator.evaluateProductConflict(halalProfile, alcoholProduct);
      expect(alcoholResult.hasDietaryConflict).toBe(true);
      expect(alcoholResult.dietaryMismatches).toContain('Halal');
    });

    it('should flag warning for uncertified gelatin when user prefers Halal', () => {
      const halalProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Halal'],
        allergies: [],
      };
      const gelatinProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Gelatin', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(halalProfile, gelatinProduct);
      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Halal');
      expect(result.conflicts.some((c) => c.severity === 'warning' && c.title.includes('Uncertified Halal'))).toBe(true);
    });

    it('should detect Kosher conflict when product contains shellfish or mixes meat and dairy', () => {
      const kosherProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Kosher'],
        allergies: [],
      };

      const shrimpProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Shrimp Paste', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };
      const mixedProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'Beef Tallow', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
          { id: 2, name: 'Cheese Powder', isAllergen: false, allergenType: null, orderIndex: 2 } as any,
        ],
      };

      const shrimpResult = evaluator.evaluateProductConflict(kosherProfile, shrimpProduct);
      expect(shrimpResult.hasDietaryConflict).toBe(true);
      expect(shrimpResult.dietaryMismatches).toContain('Kosher');

      const mixedResult = evaluator.evaluateProductConflict(kosherProfile, mixedProduct);
      expect(mixedResult.hasDietaryConflict).toBe(true);
      expect(mixedResult.dietaryMismatches).toContain('Kosher');
      expect(mixedResult.conflicts.some((c) => c.title.includes('Meat & Dairy'))).toBe(true);
    });

    it('should detect Keto conflict for high sugar, high carbs, or refined glycemic syrups', () => {
      const ketoProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Keto'],
        allergies: [],
      };

      const sugaryProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        nutritionFacts: [
          { id: 1, nutrient: 'Sugar', amountPerServing: 12, amountPer100g: 30, unit: 'g', dailyValuePercentage: 24 } as any,
        ],
      };
      const syrupProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          { id: 1, name: 'High fructose corn syrup', isAllergen: false, allergenType: null, orderIndex: 1 } as any,
        ],
      };

      const sugaryResult = evaluator.evaluateProductConflict(ketoProfile, sugaryProduct);
      expect(sugaryResult.hasDietaryConflict).toBe(true);
      expect(sugaryResult.dietaryMismatches).toContain('Keto');

      const syrupResult = evaluator.evaluateProductConflict(ketoProfile, syrupProduct);
      expect(syrupResult.hasDietaryConflict).toBe(true);
      expect(syrupResult.dietaryMismatches).toContain('Keto');
    });
  });

  describe('Nutritional Guardrails', () => {
    it('should detect when sugar per serving exceeds user limit', () => {
      const highSugarProduct: FoodProduct = {
        ...baseProduct,
        nutritionFacts: [
          { id: 1, nutrient: 'Sugar', amountPerServing: 12, amountPer100g: 30, unit: 'g', dailyValuePercentage: 24 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, highSugarProduct);
      expect(result.hasNutritionWarning).toBe(true);
      expect(result.conflicts.some((c) => c.title.includes('Sugar Target Exceeded'))).toBe(true);
    });

    it('should detect when sodium exceeds limit', () => {
      const highSodiumProduct: FoodProduct = {
        ...baseProduct,
        nutritionFacts: [
          { id: 1, nutrient: 'Sodium', amountPerServing: 2.5, amountPer100g: 5.0, unit: 'g', dailyValuePercentage: 50 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, highSodiumProduct);
      expect(result.hasNutritionWarning).toBe(true);
      expect(result.conflicts.some((c) => c.title.includes('Sodium/Salt Target Exceeded'))).toBe(true);
    });

    it('should flag conflict when product protein is below user minimum threshold', () => {
      const lowProteinProduct: FoodProduct = {
        ...baseProduct,
        nutritionFacts: [
          { id: 1, nutrient: 'Protein', amountPerServing: 2, amountPer100g: 5, unit: 'g', dailyValuePercentage: 4 } as any,
        ],
      };

      const result = evaluator.evaluateProductConflict(mockProfile, lowProteinProduct);
      expect(result.hasNutritionWarning).toBe(true);
      expect(result.conflicts.some((c) => c.title.includes('Protein Target Inadequate'))).toBe(true);
    });
  });
});
