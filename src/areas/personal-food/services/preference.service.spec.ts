// Feature F16: Food Preference & Allergen Profile
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenceService } from './preference.service';
import { PreferenceProfile } from '../models/preference-profile.entity';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { Ingredient } from '../../food-catalog/models/ingredient.entity';
import { NutritionFact } from '../../food-catalog/models/nutrition-fact.entity';

describe('PreferenceService (Unit Tests)', () => {
  let service: PreferenceService;
  let repo: jest.Mocked<Repository<PreferenceProfile>>;

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

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferenceService,
        {
          provide: getRepositoryToken(PreferenceProfile),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<PreferenceService>(PreferenceService);
    repo = module.get(getRepositoryToken(PreferenceProfile));
  });

  describe('findByUserId', () => {
    it('should return the user profile when found (Arrange-Act-Assert)', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockProfile);

      // Act
      const result = await service.findByUserId(10);

      // Assert
      expect(result).toEqual(mockProfile);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: 10 } });
    });

    it('should return null when profile does not exist', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByUserId(99);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findOrCreate', () => {
    it('should return existing profile if present', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockProfile);

      // Act
      const result = await service.findOrCreate(10);

      // Assert
      expect(result).toEqual(mockProfile);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should create and save a new profile if not found', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);
      const newProfile = { ...mockProfile, id: 2, userId: 20, allergies: [] };
      repo.create.mockReturnValue(newProfile);
      repo.save.mockResolvedValue(newProfile);

      // Act
      const result = await service.findOrCreate(20);

      // Assert
      expect(result).toEqual(newProfile);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update and persist modified fields', async () => {
      // Arrange
      repo.findOne.mockResolvedValue({ ...mockProfile });
      repo.save.mockImplementation(async (entity) => entity as PreferenceProfile);

      const updateDto = {
        allergies: ['Gluten', 'Soy'],
        dietaryPreferences: ['Keto'],
        maxSugarPerServing: 2,
      };

      // Act
      const result = await service.updateProfile(10, updateDto);

      // Assert
      expect(result.allergies).toEqual(['Gluten', 'Soy']);
      expect(result.dietaryPreferences).toEqual(['Keto']);
      expect(result.maxSugarPerServing).toBe(2);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('evaluateProductConflict', () => {
    const baseProduct: FoodProduct = {
      id: 1,
      name: 'Organic Oat Milk',
      brand: 'PureHarvest',
      category: 'Dairy & Plant Milks',
      barcode: '1234567890123',
      imageUrl: '',
      description: 'Clean oat milk',
      servingSize: 200,
      servingUnit: 'ml',
      status: 'active',
      qualityScore: 90,
      manufacturerId: 1,
      dietaryTags: ['Vegan', 'Gluten-Free'],
      ingredients: [
        {
          id: 1,
          name: 'Filtered Water',
          isAllergen: false,
          allergenType: '',
          additiveCode: '',
          hazardLevel: 'safe',
          explanation: '',
          product: null as any,
        },
        {
          id: 2,
          name: 'Organic Whole Oats',
          isAllergen: false,
          allergenType: '',
          additiveCode: '',
          hazardLevel: 'safe',
          explanation: '',
          product: null as any,
        },
      ],
      nutritionFacts: [
        {
          id: 1,
          nutrient: 'Sugars',
          amountPer100g: 2.0,
          amountPerServing: 4.0,
          unit: 'g',
          dailyValuePercentage: 4,
          product: null as any,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return unconfigured status when profile is null', () => {
      // Act
      const result = service.evaluateProductConflict(null, baseProduct);

      // Assert
      expect(result.profileConfigured).toBe(false);
      expect(result.isSafeForUser).toBe(true);
      expect(result.hasConflicts).toBe(false);
    });

    it('should detect a critical allergen conflict when product contains declared allergen', () => {
      // Arrange: Product with peanut allergen
      const peanutProduct: FoodProduct = {
        ...baseProduct,
        name: 'Peanut Butter Granola',
        dietaryTags: [],
        ingredients: [
          {
            id: 3,
            name: 'Roasted Peanuts',
            isAllergen: true,
            allergenType: 'Peanut',
            additiveCode: '',
            hazardLevel: 'warning',
            explanation: 'Known allergen',
            product: null as any,
          },
        ],
      };

      // Act
      const result = service.evaluateProductConflict(mockProfile, peanutProduct);

      // Assert
      expect(result.hasAllergenConflict).toBe(true);
      expect(result.hasConflicts).toBe(true);
      expect(result.isSafeForUser).toBe(false);
      expect(result.matchedAllergies).toContain('peanut');
    });

    it('should detect a dietary mismatch when user is Vegan but product contains dairy', () => {
      // Arrange: Dairy product
      const dairyProduct: FoodProduct = {
        ...baseProduct,
        name: 'Dairy Yogurt',
        dietaryTags: [],
        ingredients: [
          {
            id: 4,
            name: 'Pasteurized Whole Milk',
            isAllergen: true,
            allergenType: 'Milk',
            additiveCode: '',
            hazardLevel: 'caution',
            explanation: '',
            product: null as any,
          },
        ],
      };

      // Act
      const result = service.evaluateProductConflict(mockProfile, dairyProduct);

      // Assert
      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Vegan');
      expect(result.isSafeForUser).toBe(false);
    });

    it('should detect when sugar per serving exceeds user preference limit', () => {
      // Arrange: High sugar product (12g per serving > user limit of 5g)
      const highSugarProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: ['Vegan'],
        nutritionFacts: [
          {
            id: 2,
            nutrient: 'Sugars',
            amountPer100g: 6,
            amountPerServing: 12,
            unit: 'g',
            dailyValuePercentage: 15,
            product: null as any,
          },
        ],
      };

      // Act
      const result = service.evaluateProductConflict(mockProfile, highSugarProduct);

      // Assert
      expect(result.hasNutritionWarning).toBe(true);
      expect(result.conflicts.some((c) => c.category === 'nutrition')).toBe(true);
    });

    it('should return safe clearance for compliant product with zero conflicts', () => {
      // Act
      const result = service.evaluateProductConflict(mockProfile, baseProduct);

      // Assert
      expect(result.isSafeForUser).toBe(true);
      expect(result.hasConflicts).toBe(false);
      expect(result.hasAllergenConflict).toBe(false);
      expect(result.hasDietaryConflict).toBe(false);
    });

    it('should handle edge cases cleanly (empty ingredients and missing nutrition facts)', () => {
      // Arrange: Empty product
      const emptyProduct: FoodProduct = {
        ...baseProduct,
        ingredients: [],
        nutritionFacts: [],
      };

      // Act
      const result = service.evaluateProductConflict(mockProfile, emptyProduct);

      // Assert
      expect(result).toBeDefined();
      expect(result.hasAllergenConflict).toBe(false);
    });

    it('should flag conflict when product protein is below user minProteinPerServing limit', () => {
      // Arrange: Product with 2g protein, user requires 10g
      const lowProteinProduct: FoodProduct = {
        ...baseProduct,
        nutritionFacts: [
          {
            id: 2,
            nutrient: 'Protein',
            amountPer100g: 1.0,
            amountPerServing: 2.0,
            unit: 'g',
            dailyValuePercentage: null,
            product: null as any,
          },
        ],
      };

      // Act
      const result = service.evaluateProductConflict(mockProfile, lowProteinProduct);

      // Assert
      expect(result.hasNutritionWarning).toBe(true);
      expect(result.conflicts.some((c) => c.title.includes('Protein'))).toBe(true);
    });

    it('should detect critical Halal conflict when product contains pork or bacon', () => {
      const halalProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Halal'],
        allergies: [],
      };
      const porkProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          {
            id: 10,
            name: 'Smoked Bacon Bits',
            isAllergen: false,
            allergenType: '',
            additiveCode: '',
            hazardLevel: 'safe',
            explanation: '',
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(halalProfile, porkProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Halal');
      expect(result.conflicts.some((c) => c.title.includes('Non-Halal Ingredient'))).toBe(true);
    });

    it('should detect critical Halal conflict when product contains alcohol', () => {
      const halalProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Halal'],
        allergies: [],
      };
      const alcoholProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          {
            id: 11,
            name: 'Red Wine Vinegar',
            isAllergen: false,
            allergenType: '',
            additiveCode: '',
            hazardLevel: 'safe',
            explanation: '',
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(halalProfile, alcoholProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Halal');
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
          {
            id: 12,
            name: 'Gelatin',
            isAllergen: false,
            allergenType: '',
            additiveCode: '',
            hazardLevel: 'safe',
            explanation: '',
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(halalProfile, gelatinProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.conflicts.some((c) => c.title.includes('Uncertified Halal Ingredient'))).toBe(
        true,
      );
    });

    it('should detect Kosher conflict when product contains shellfish', () => {
      const kosherProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Kosher'],
        allergies: [],
      };
      const shrimpProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          {
            id: 13,
            name: 'Dried Shrimp Powder',
            isAllergen: true,
            allergenType: 'Shellfish',
            additiveCode: '',
            hazardLevel: 'safe',
            explanation: '',
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(kosherProfile, shrimpProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Kosher');
    });

    it('should detect Kosher conflict when meat and dairy are mixed in the same product', () => {
      const kosherProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Kosher'],
        allergies: [],
      };
      const mixedProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        ingredients: [
          {
            id: 14,
            name: 'Cooked Beef Patty',
            isAllergen: false,
            allergenType: '',
            additiveCode: '',
            hazardLevel: 'safe',
            explanation: '',
            product: null as any,
          },
          {
            id: 15,
            name: 'Cheddar Cheese',
            isAllergen: true,
            allergenType: 'Milk',
            additiveCode: '',
            hazardLevel: 'safe',
            explanation: '',
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(kosherProfile, mixedProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Kosher');
      expect(result.conflicts.some((c) => c.title.includes('Meat & Dairy'))).toBe(true);
    });

    it('should detect Keto conflict when sugar or carbohydrates per serving are high', () => {
      const ketoProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Keto'],
        allergies: [],
      };
      const sugaryProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        nutritionFacts: [
          {
            id: 16,
            nutrient: 'Sugars',
            amountPer100g: 10,
            amountPerServing: 8,
            unit: 'g',
            dailyValuePercentage: null,
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(ketoProfile, sugaryProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Keto');
      expect(result.conflicts.some((c) => c.title.includes('Keto Mismatch: High Sugar'))).toBe(
        true,
      );
    });

    it('should detect Keto conflict when ingredients contain refined sugar or corn syrup', () => {
      const ketoProfile: PreferenceProfile = {
        ...mockProfile,
        dietaryPreferences: ['Keto'],
        allergies: [],
      };
      const syrupProduct: FoodProduct = {
        ...baseProduct,
        dietaryTags: [],
        nutritionFacts: [],
        ingredients: [
          {
            id: 17,
            name: 'High Fructose Corn Syrup',
            isAllergen: false,
            allergenType: '',
            additiveCode: '',
            hazardLevel: 'caution',
            explanation: '',
            product: null as any,
          },
        ],
      };

      const result = service.evaluateProductConflict(ketoProfile, syrupProduct);

      expect(result.hasDietaryConflict).toBe(true);
      expect(result.dietaryMismatches).toContain('Keto');
      expect(result.conflicts.some((c) => c.title.includes('Refined Sweetener'))).toBe(true);
    });
  });

  describe('calculateMetabolicPlan (Mifflin-St Jeor Engine)', () => {
    it('should return uncalculated with missing metrics when profile is null', () => {
      const plan = service.calculateMetabolicPlan(null);

      expect(plan.isCalculated).toBe(false);
      expect(plan.bmr).toBeNull();
      expect(plan.tdee).toBeNull();
      expect(plan.missingMetrics).toEqual(['age', 'gender', 'height', 'weight', 'activity level']);
    });

    it('should return uncalculated with missing metrics when required body fields are incomplete', () => {
      const incompleteProfile: PreferenceProfile = {
        ...mockProfile,
        age: 25,
        heightCm: 170,
        weightKg: null,
        gender: null,
        activityLevel: null,
      };

      const plan = service.calculateMetabolicPlan(incompleteProfile);

      expect(plan.isCalculated).toBe(false);
      expect(plan.missingMetrics).toContain('gender');
      expect(plan.missingMetrics).toContain('weight');
      expect(plan.missingMetrics).toContain('activity level');
    });

    it('should compute correct Mifflin-St Jeor BMR, TDEE, and macro splits for a male user', () => {
      // Male, 70kg, 175cm, 30 years old, moderate activity (multiplier 1.55)
      // BMR = 10(70) + 6.25(175) - 5(30) + 5 = 700 + 1093.75 - 150 + 5 = 1648.75 -> 1649 kcal
      // TDEE = 1649 * 1.55 = 2555.95 -> 2556 kcal
      const maleProfile: PreferenceProfile = {
        ...mockProfile,
        gender: 'male',
        weightKg: 70,
        heightCm: 175,
        age: 30,
        activityLevel: 'moderate',
        calorieGoal: null,
        maxSodiumPerServing: null,
      };

      const plan = service.calculateMetabolicPlan(maleProfile);

      expect(plan.isCalculated).toBe(true);
      expect(plan.bmr).toBe(1649);
      expect(plan.tdee).toBe(2556);
      expect(plan.dailyCalorieTarget).toBe(2556);
      expect(plan.goalLabel).toContain('Maintenance');
      expect(plan.macroSplit).toBeDefined();
      expect(plan.macroSplit?.proteinPercentage).toBe(25);
      expect(plan.macroSplit?.carbsPercentage).toBe(50);
      expect(plan.macroSplit?.fatPercentage).toBe(25);
      expect(plan.dailyCeilings?.maxSugarGrams).toBeLessThanOrEqual(25);
      expect(plan.dailyCeilings?.maxSodiumGrams).toBe(2.0);
    });

    it('should compute correct Mifflin-St Jeor BMR and TDEE for a female user', () => {
      // Female, 58kg, 168cm, 26 years old, light activity (multiplier 1.375)
      // BMR = 10(58) + 6.25(168) - 5(26) - 161 = 580 + 1050 - 130 - 161 = 1339 kcal
      // TDEE = 1339 * 1.375 = 1841.125 -> 1841 kcal
      const femaleProfile: PreferenceProfile = {
        ...mockProfile,
        gender: 'female',
        weightKg: 58,
        heightCm: 168,
        age: 26,
        activityLevel: 'light',
        calorieGoal: 1500, // Deficit goal
        maxSodiumPerServing: 1.5,
      };

      const plan = service.calculateMetabolicPlan(femaleProfile);

      expect(plan.isCalculated).toBe(true);
      expect(plan.bmr).toBe(1339);
      expect(plan.tdee).toBe(1841);
      expect(plan.dailyCalorieTarget).toBe(1500);
      expect(plan.calorieGoalSource).toBe('deficit');
      expect(plan.goalLabel).toContain('Deficit');
      expect(plan.dailyCeilings?.maxSodiumGrams).toBe(4.5);
    });

    it('should flag underage users with a pediatric advisory note', () => {
      const underageProfile: PreferenceProfile = {
        ...mockProfile,
        gender: 'female',
        weightKg: 45,
        heightCm: 155,
        age: 15,
        activityLevel: 'light',
        calorieGoal: 1600,
      };

      const plan = service.calculateMetabolicPlan(underageProfile);

      expect(plan.isCalculated).toBe(true);
      expect(plan.isUnderage).toBe(true);
      expect(plan.advisoryNote).toContain('under 18');
    });

    it('should flag calorie targets below the safe floor with a clinical warning', () => {
      const lowCalorieProfile: PreferenceProfile = {
        ...mockProfile,
        gender: 'male',
        weightKg: 75,
        heightCm: 180,
        age: 25,
        activityLevel: 'sedentary',
        calorieGoal: 1100, // Far below male safe floor of 1500 kcal
      };

      const plan = service.calculateMetabolicPlan(lowCalorieProfile);

      expect(plan.isCalculated).toBe(true);
      expect(plan.advisoryNote).toContain('safe floor');
    });
  });
});

