import { IngredientAnalyzerService } from './ingredient-analyzer.service';
import { FoodRule } from '../../admin/models/food-rule.entity';
import { Ingredient } from '../models/ingredient.entity';

describe('IngredientAnalyzerService (Feature F03 Unit Tests)', () => {
  let service: IngredientAnalyzerService;

  const makeRule = (overrides: Partial<FoodRule> = {}): FoodRule =>
    ({
      id: 1,
      name: 'Test Rule',
      pattern: 'test',
      ruleType: 'ingredient',
      additiveCode: null,
      allergenType: null,
      categoryScope: null,
      hazardLevel: 'safe',
      fdaStatus: 'GRAS Verified',
      euStatus: 'EU Authorized',
      explanation: 'Test explanation',
      source: 'FDA / EFSA',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as FoodRule;

  const sampleRules: FoodRule[] = [
    makeRule({
      id: 1,
      name: 'Whole Oats',
      pattern: 'whole oats, organic whole oats, oats, oat base',
      ruleType: 'ingredient',
      hazardLevel: 'safe',
      explanation: 'Minimally processed whole grain cereal rich in beta-glucan fiber.',
      source: 'USDA Whole Grain Standard',
    }),
    makeRule({
      id: 2,
      name: 'Dairy Milk',
      pattern: 'milk, cow milk, whole cow milk, whey, casein, butter, lactose',
      ruleType: 'allergen',
      allergenType: 'Milk',
      hazardLevel: 'warning',
      fdaStatus: 'FDA Major Allergen (FALCPA)',
      euStatus: 'EU Annex II Allergen',
      explanation: 'Contains bovine milk proteins capable of triggering IgE dairy allergies.',
      source: 'FDA FALCPA & EU Reg 1169/2011',
    }),
    makeRule({
      id: 3,
      name: 'Tree Nuts',
      pattern: 'almond, almonds, walnut, walnuts, cashew, cashews, hazelnut',
      ruleType: 'allergen',
      allergenType: 'Tree Nut',
      hazardLevel: 'warning',
      fdaStatus: 'FDA Major Allergen',
      euStatus: 'EU Annex II Allergen',
      explanation: 'Major tree nut allergen declared under statutory allergen labeling.',
      source: 'FDA / EU Annex II',
    }),
    makeRule({
      id: 4,
      name: 'Soy Lecithin',
      pattern: 'soy lecithin, soya lecithin, e322',
      ruleType: 'allergen',
      additiveCode: 'E322',
      allergenType: 'Soy',
      hazardLevel: 'caution',
      fdaStatus: 'FDA GRAS / Soy Allergen',
      euStatus: 'EFSA Approved (E322)',
      explanation: 'Emulsifier derived from soy; subject to allergen declaration.',
      source: 'EFSA / FDA',
    }),
    makeRule({
      id: 5,
      name: 'Phosphoric Acid (Beverage Limit)',
      pattern: 'phosphoric acid, e338',
      ruleType: 'category_restriction',
      additiveCode: 'E338',
      categoryScope: 'Beverages',
      hazardLevel: 'warning',
      fdaStatus: 'FDA Beverage Acidulant Limit',
      euStatus: 'EFSA ADI 40 mg/kg bw/day (E338)',
      explanation: 'Acidulant restricted in beverages due to dental enamel erosion and phosphate load.',
      source: 'EFSA ANS Panel (Beverages)',
    }),
    makeRule({
      id: 6,
      name: 'Phosphoric Acid (Global)',
      pattern: 'phosphoric acid, e338',
      ruleType: 'additive',
      additiveCode: 'E338',
      categoryScope: null,
      hazardLevel: 'caution',
      fdaStatus: 'FDA GRAS Acidulant',
      euStatus: 'EU Authorized (E338)',
      explanation: 'Inorganic phosphate acidulant.',
      source: 'EFSA General Additive Base',
    }),
    makeRule({
      id: 7,
      name: 'Caramel Color',
      pattern: 'caramel color, e150d',
      ruleType: 'additive',
      additiveCode: 'E150d',
      hazardLevel: 'caution',
      fdaStatus: 'FDA Color Additive Exempt',
      euStatus: 'EFSA Evaluated (E150d)',
      explanation: 'Sulfite ammonia caramel colorant.',
      source: 'EFSA / IARC',
    }),
    makeRule({
      id: 8,
      name: 'Inactive Experimental Rule',
      pattern: 'exotic berry',
      ruleType: 'ingredient',
      hazardLevel: 'safe',
      isActive: false,
      explanation: 'Should never match when inactive.',
    }),
  ];

  beforeEach(() => {
    service = new IngredientAnalyzerService();
  });

  describe('splitRawIngredientList', () => {
    it('should split comma/semicolon/newline lists while preserving nested parentheses and brackets', () => {
      // Arrange
      const raw =
        'Oat Base (Water, Oats 10% [Organic, Whole]), Phosphoric Acid (E338); Sea Salt.\nNatural Berry Extract';

      // Act
      const tokens = service.splitRawIngredientList(raw);

      // Assert
      expect(tokens).toEqual([
        'Oat Base (Water, Oats 10% [Organic, Whole])',
        'Phosphoric Acid (E338)',
        'Sea Salt',
        'Natural Berry Extract',
      ]);
    });

    it('should return an empty array for empty or whitespace input', () => {
      // Arrange & Act & Assert
      expect(service.splitRawIngredientList('')).toEqual([]);
      expect(service.splitRawIngredientList('   ')).toEqual([]);
      expect(service.splitRawIngredientList(undefined)).toEqual([]);
    });
  });

  describe('extractAdditiveCodes', () => {
    it('should extract and normalize E-numbers, INS codes, and CI color codes without duplicates', () => {
      // Arrange
      const text = 'Caramel Color (E150d), Acidulant (INS 338), Dye (CI 12055), duplicate e150d';

      // Act
      const codes = service.extractAdditiveCodes(text);

      // Assert
      expect(codes).toEqual(['E150d', 'E338', 'CI 12055']);
    });
  });

  describe('analyzeSingleIngredient (Rule Matching, Boundary & Plant Milk Guards)', () => {
    it('should prevent plant milk false-positive matches against dairy Milk allergen rules', () => {
      // Arrange
      const input = { name: 'Organic Almondmilk (Water, Almonds)' };

      // Act
      const result = service.analyzeSingleIngredient(input, sampleRules, 'Dairy & Plant Milks');

      // Assert
      expect(result.analysisStatus).toBe('matched');
      expect(result.allergenType).toBe('Tree Nut');
      expect(result.allergenType).not.toBe('Milk');
    });

    it('should protect against substring false positives like Nutmeg matching nut rules', () => {
      // Arrange
      const nutRule = makeRule({
        id: 20,
        name: 'Peanut',
        pattern: 'peanut, nut',
        ruleType: 'allergen',
        allergenType: 'Peanut',
        hazardLevel: 'warning',
      });

      // Act
      const result = service.analyzeSingleIngredient({ name: 'Ground Nutmeg' }, [nutRule]);

      // Assert
      expect(result.analysisStatus).toBe('unknown');
      expect(result.isAllergen).toBe(false);
    });

    it('should apply category-specific rules with priority over global rules', () => {
      // Arrange
      const input = { name: 'Phosphoric Acid (INS 338)' };

      // Act
      const bevResult = service.analyzeSingleIngredient(input, sampleRules, 'Beverages');
      const pantryResult = service.analyzeSingleIngredient(input, sampleRules, 'Pantry & Condiments');

      // Assert
      expect(bevResult.analysisStatus).toBe('matched');
      expect(bevResult.hazardLevel).toBe('warning');
      expect(bevResult.additiveCode).toBe('E338');
      expect(bevResult.categoryRuleApplied).toBe(true);
      expect(bevResult.ruleSource).toContain('Category Rule: Beverages');

      expect(pantryResult.analysisStatus).toBe('matched');
      expect(pantryResult.hazardLevel).toBe('caution');
      expect(pantryResult.categoryRuleApplied).toBe(false);
    });

    it('should explicitly isolate unknown/unclassified ingredients and never treat them as safe', () => {
      // Arrange
      const input = { name: 'Exotic Berry Flavor Blend' };

      // Act
      const result = service.analyzeSingleIngredient(input, sampleRules, 'Beverages');

      // Assert
      expect(result.analysisStatus).toBe('unknown');
      expect(result.hazardLevel).toBe('caution');
      expect(result.hazardLevel).not.toBe('safe');
      expect(result.matchedRuleId).toBeNull();
      expect(result.ruleSource).toContain('Unclassified');
      expect(result.fdaStatus).toBe('Unverified in Rule Base');
      expect(result.euStatus).toBe('Unverified in Rule Base');
    });

    it('should ignore inactive rules during evaluation', () => {
      // Arrange & Act
      const result = service.analyzeSingleIngredient(
        { name: 'Exotic Berry' },
        sampleRules,
        'Beverages',
      );

      // Assert
      expect(result.analysisStatus).toBe('unknown');
      expect(result.matchedRuleId).toBeNull();
    });
  });

  describe('buildProductAnalysisReport', () => {
    it('should cleanly partition recognized ingredients from unknown items and compute accurate counts', () => {
      // Arrange
      const ingredients = [
        { id: 1, name: 'Whole Oats' },
        { id: 2, name: 'Soy Lecithin (E322)' },
        { id: 3, name: 'Phosphoric Acid (E338)' },
        { id: 4, name: 'Proprietary Botanical Essence' },
      ] as Ingredient[];

      // Act
      const report = service.buildProductAnalysisReport(ingredients, sampleRules, 'Beverages');

      // Assert
      expect(report.totalCount).toBe(4);
      expect(report.recognizedIngredients).toHaveLength(3);
      expect(report.unknownIngredients).toHaveLength(1);
      expect(report.unknownIngredients[0].name).toBe('Proprietary Botanical Essence');
      expect(report.unknownIngredients[0].isUnknown).toBe(true);
      expect(report.unknownIngredients[0].isSafe).toBe(false);

      expect(report.counts.total).toBe(4);
      expect(report.counts.recognized).toBe(3);
      expect(report.counts.unknown).toBe(1);
      expect(report.counts.safe).toBe(1);
      expect(report.counts.caution).toBe(1);
      expect(report.counts.warning).toBe(1);
      expect(report.counts.allergens).toBe(1);
      expect(report.counts.additives).toBe(2);
      expect(report.counts.coveragePercent).toBe(75);
      expect(report.hasUnknownIngredients).toBe(true);
      expect(report.hasWarnings).toBe(true);
      expect(report.categoryNotes).toHaveLength(1);
      expect(report.categoryNotes[0]).toContain('Phosphoric Acid (E338)');
    });
  });

  describe('buildNutritionFactsFromForm', () => {
    it('should calculate per-serving nutrient values from per-100g form fields', () => {
      // Arrange
      const formBody = {
        servingSize: '250',
        nutrition_energy: '48',
        nutrition_fat: '1.5',
        nutrition_sugars: '4',
      };

      // Act
      const facts = service.buildNutritionFactsFromForm(formBody);

      // Assert
      expect(facts).toHaveLength(8);
      const energy = facts.find((f) => f.nutrient === 'Energy');
      const sugars = facts.find((f) => f.nutrient === 'Sugars');
      expect(energy).toEqual({
        nutrient: 'Energy',
        amountPer100g: 48,
        amountPerServing: 120,
        unit: 'kcal',
      });
      expect(sugars?.amountPerServing).toBe(10);
    });
  });
});
