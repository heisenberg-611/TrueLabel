import {
  ComparisonCertificationSummary,
  FoodComparisonCandidateInput,
  FoodComparisonEngine,
} from './food-comparison.engine';
import { FoodProduct } from '../models/food-product.entity';
import { FoodScoreBreakdown } from './food-score.service';
import { IngredientAnalysisReport } from './ingredient-analyzer.service';

describe('FoodComparisonEngine (Feature F05 Pure Engine Unit Tests)', () => {
  let engine: FoodComparisonEngine;

  beforeEach(() => {
    engine = new FoodComparisonEngine();
  });

  const makeScoreBreakdown = (
    totalScore: number,
    pillarOverrides: Partial<Record<string, number>> = {},
  ): FoodScoreBreakdown => {
    const comp = (
      key: 'ingredient' | 'nutrition' | 'verification' | 'recall' | 'community',
      label: string,
      shortLabel: string,
      weight: number,
      provisional = false,
    ) => {
      const score = pillarOverrides[key] ?? totalScore;
      const weightedContribution = (score * weight) / 100;
      return {
        key,
        label,
        shortLabel,
        weight,
        score,
        weightedContribution,
        weightedContributionFormatted: weightedContribution.toFixed(1),
        provisional,
        provisionalNote: provisional ? 'Baseline used' : null,
        rationale: `${label} evaluation`,
        evidenceSummary: `${label} evidence`,
        statusTone: (provisional ? 'provisional' : 'positive') as
          | 'positive'
          | 'caution'
          | 'warning'
          | 'provisional',
        barColorClass: 'bg-emerald-600',
      };
    };

    return {
      totalScore,
      rawWeightedScore: totalScore,
      quarantineCapApplied: false,
      tierNumber: totalScore >= 80 ? 1 : totalScore >= 60 ? 2 : 3,
      tierLabel:
        totalScore >= 80
          ? 'Tier 1: High transparency'
          : totalScore >= 60
            ? 'Tier 2: Moderate quality'
            : 'Tier 3: Elevated risk or processing',
      isProvisional: false,
      provisionalComponents: [],
      provisionalDisclaimer: null,
      weights: {
        ingredientWeight: 35,
        nutritionWeight: 30,
        verificationWeight: 15,
        recallWeight: 10,
        communityWeight: 10,
      },
      components: [
        comp('ingredient', 'Ingredient & allergen transparency', 'Ingredients', 35),
        comp('nutrition', 'Nutrition profile', 'Nutrition', 30),
        comp('verification', 'Verification & certification', 'Verification', 15),
        comp('recall', 'Recall & safety incidents', 'Recalls', 10),
        comp('community', 'Community feedback', 'Community', 10, true),
      ],
    };
  };

  const makeReport = (
    recognized: any[],
    unknown: any[] = [],
  ): IngredientAnalysisReport => {
    const all = [...recognized, ...unknown];
    return {
      totalCount: all.length,
      counts: {
        total: all.length,
        recognized: recognized.length,
        unknown: unknown.length,
        safe: recognized.filter((i) => i.hazardLevel === 'safe').length,
        caution: recognized.filter((i) => i.hazardLevel === 'caution').length,
        warning: recognized.filter((i) => i.hazardLevel === 'warning').length,
        allergens: all.filter((i) => i.isAllergen).length,
        additives: all.filter((i) => Boolean(i.additiveCode)).length,
        coveragePercent:
          all.length > 0 ? Math.round((recognized.length / all.length) * 100) : 0,
      },
      recognizedIngredients: recognized,
      unknownIngredients: unknown,
      allergens: all.filter((i) => i.isAllergen),
      additives: all.filter((i) => Boolean(i.additiveCode)),
      hasUnknownIngredients: unknown.length > 0,
      hasWarnings: all.some((i) => i.hazardLevel === 'warning'),
      hasCautions: all.some((i) => i.hazardLevel === 'caution'),
      categoryNotes: [],
    };
  };

  const makeCertSummary = (
    overrides: Partial<ComparisonCertificationSummary> = {},
  ): ComparisonCertificationSummary => ({
    approvedCount: 1,
    pendingCount: 0,
    rejectedCount: 0,
    docLabels: ['ISO 22000'],
    licenceNumber: 'MFG-101',
    licenceAuthority: 'BSTI',
    licenceStatus: 'valid',
    licenceValid: true,
    verificationStanding: 'Verified documents & active licence',
    ...overrides,
  });

  const makeOatly = (): FoodComparisonCandidateInput => ({
    product: {
      id: 1,
      name: 'Barista Edition Oat Drink',
      brand: 'Oatly',
      category: 'Dairy & Plant Milks',
      barcode: '7394376311482',
      servingSize: 250,
      servingUnit: 'ml',
      status: 'active',
      qualityScore: 86,
      dietaryTags: ['Vegan', 'Dairy-Free'],
      nutritionFacts: [
        { nutrient: 'Energy', amountPer100g: 60, amountPerServing: 150, unit: 'kcal' } as any,
        { nutrient: 'Total Fat', amountPer100g: 3.0, amountPerServing: 7.5, unit: 'g' } as any,
        { nutrient: 'Saturated Fat', amountPer100g: 0.3, amountPerServing: 0.8, unit: 'g' } as any,
        { nutrient: 'Carbohydrates', amountPer100g: 6.7, amountPerServing: 16.8, unit: 'g' } as any,
        { nutrient: 'Sugars', amountPer100g: 3.4, amountPerServing: 8.5, unit: 'g' } as any,
        { nutrient: 'Dietary Fiber', amountPer100g: 0.8, amountPerServing: 2.0, unit: 'g' } as any,
        { nutrient: 'Protein', amountPer100g: 1.0, amountPerServing: 2.5, unit: 'g' } as any,
        { nutrient: 'Sodium', amountPer100g: 0.04, amountPerServing: 0.1, unit: 'g' } as any,
      ],
    } as FoodProduct,
    ingredientReport: makeReport([
      { name: 'Water', additiveCode: null, isAllergen: false, allergenType: null, hazardLevel: 'safe', isUnknown: false },
      { name: 'Whole Oats (10%)', additiveCode: null, isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe', isUnknown: false },
      { name: 'Dipotassium Phosphate', additiveCode: 'E340', isAllergen: false, allergenType: null, hazardLevel: 'caution', isUnknown: false },
    ]),
    scoreBreakdown: makeScoreBreakdown(86, { ingredient: 90, nutrition: 84, verification: 88, recall: 100, community: 80 }),
    certificationSummary: makeCertSummary({ approvedCount: 2, docLabels: ['ISO 22000', 'HACCP'] }),
    userConflict: {
      hasConflicts: false,
      hasAllergenConflict: false,
      hasDietaryConflict: false,
      hasNutritionWarning: false,
      conflicts: [],
      matchedAllergies: [],
      dietaryMismatches: [],
      isSafeForUser: true,
      profileConfigured: true,
    },
  });

  const makeChobani = (): FoodComparisonCandidateInput => ({
    product: {
      id: 2,
      name: 'Non-Fat Plain Greek Yogurt',
      brand: 'Chobani',
      category: 'Dairy & Plant Milks',
      barcode: '089470001382',
      servingSize: 150,
      servingUnit: 'g',
      status: 'active',
      qualityScore: 81,
      dietaryTags: ['High Protein', 'Vegetarian'],
      nutritionFacts: [
        { nutrient: 'Energy', amountPer100g: 59, amountPerServing: 89, unit: 'kcal' } as any,
        { nutrient: 'Total Fat', amountPer100g: 0, amountPerServing: 0, unit: 'g' } as any,
        { nutrient: 'Saturated Fat', amountPer100g: 0, amountPerServing: 0, unit: 'g' } as any,
        { nutrient: 'Carbohydrates', amountPer100g: 3.6, amountPerServing: 5.4, unit: 'g' } as any,
        { nutrient: 'Sugars', amountPer100g: 2.7, amountPerServing: 4.1, unit: 'g' } as any,
        // Dietary Fiber intentionally omitted to assert Not declared handling
        { nutrient: 'Protein', amountPer100g: 10.0, amountPerServing: 15.0, unit: 'g' } as any,
        { nutrient: 'Salt', amountPer100g: 0.1, amountPerServing: 0.15, unit: 'g' } as any,
      ],
    } as FoodProduct,
    ingredientReport: makeReport(
      [
        { name: 'Skim Milk', additiveCode: null, isAllergen: true, allergenType: 'Milk', hazardLevel: 'warning', isUnknown: false },
        { name: 'Live Cultures', additiveCode: null, isAllergen: false, allergenType: null, hazardLevel: 'safe', isUnknown: false },
      ],
      [
        { name: 'Water', additiveCode: null, isAllergen: false, allergenType: null, hazardLevel: 'safe', isUnknown: true },
      ],
    ),
    scoreBreakdown: makeScoreBreakdown(81, { ingredient: 78, nutrition: 92, verification: 80, recall: 100, community: 80 }),
    certificationSummary: makeCertSummary({ approvedCount: 1, docLabels: ['Lab Test Report'] }),
    userConflict: {
      hasConflicts: true,
      hasAllergenConflict: true,
      hasDietaryConflict: true,
      hasNutritionWarning: false,
      conflicts: [],
      matchedAllergies: ['Milk'],
      dietaryMismatches: ['Vegan'],
      isSafeForUser: false,
      profileConfigured: true,
    },
  });

  const makeCola = (): FoodComparisonCandidateInput => ({
    product: {
      id: 3,
      name: 'Original Taste Carbonated Cola',
      brand: 'Coca-Cola',
      category: 'Beverages',
      barcode: '5449000000996',
      servingSize: 330,
      servingUnit: 'ml',
      status: 'active',
      qualityScore: 42,
      dietaryTags: ['Vegan'],
      nutritionFacts: [],
    } as FoodProduct,
    ingredientReport: makeReport([
      { name: 'Carbonated Water', additiveCode: null, isAllergen: false, allergenType: null, hazardLevel: 'safe', isUnknown: false },
      { name: 'Phosphoric Acid', additiveCode: 'E338', isAllergen: false, allergenType: null, hazardLevel: 'warning', isUnknown: false },
    ]),
    scoreBreakdown: makeScoreBreakdown(42),
    certificationSummary: makeCertSummary({ approvedCount: 0, licenceValid: false, licenceNumber: null }),
  });

  it('returns empty mode when no candidates are provided and formats missingIds notice when present', () => {
    const emptyResult = engine.compare([]);
    expect(emptyResult.mode).toBe('empty');
    expect(emptyResult.canCompare).toBe(false);
    expect(emptyResult.validationError).toBeNull();

    const missingOnly = engine.compare([], [999, 1000]);
    expect(missingOnly.mode).toBe('empty');
    expect(missingOnly.validationError).toContain('999, 1000');
  });

  it('returns insufficient mode when only 1 candidate is selected', () => {
    const result = engine.compare([makeOatly()]);
    expect(result.mode).toBe('insufficient');
    expect(result.canCompare).toBe(false);
    expect(result.activeCategory).toBe('Dairy & Plant Milks');
    expect(result.validationError).toContain('at least 2');
  });

  it('returns too_many mode when more than 3 same-category candidates are selected', () => {
    const base = makeOatly();
    const fourItems = [10, 11, 12, 13].map((id) => ({
      ...base,
      product: { ...base.product, id, name: `Oat Drink ${id}` } as FoodProduct,
    }));

    const result = engine.compare(fourItems);
    expect(result.mode).toBe('too_many');
    expect(result.canCompare).toBe(false);
    expect(result.selectedCount).toBe(4);
    expect(result.validationError).toContain('up to 3 foods');
  });

  it('blocks cross-category comparison and returns 1-click categoryQuickFixes without building matrices', () => {
    const result = engine.compare([makeOatly(), makeChobani(), makeCola()]);

    expect(result.mode).toBe('cross_category_blocked');
    expect(result.canCompare).toBe(false);
    expect(result.isCrossCategoryBlocked).toBe(true);
    expect(result.blockedCategories).toEqual(['Dairy & Plant Milks', 'Beverages']);
    expect(result.nutritionMatrix).toBeNull();
    expect(result.scoreMatrix).toEqual([]);
    expect(result.categoryQuickFixes).toHaveLength(2);
    expect(result.categoryQuickFixes[0]).toMatchObject({
      category: 'Dairy & Plant Milks',
      count: 2,
      canCompareImmediately: true,
      url: '/catalog/compare?ids=1,2',
    });
    expect(result.categoryQuickFixes[1]).toMatchObject({
      category: 'Beverages',
      count: 1,
      canCompareImmediately: false,
      url: '/catalog/compare?ids=3',
    });
  });

  it('compares 2 same-category products accurately across score, nutrition, ingredients, allergens, and certifications', () => {
    const result = engine.compare([makeOatly(), makeChobani()]);

    expect(result.mode).toBe('ready');
    expect(result.canCompare).toBe(true);
    expect(result.activeCategory).toBe('Dairy & Plant Milks');
    expect(result.products[0].isHighestScore).toBe(true);
    expect(result.products[1].isHighestScore).toBe(false);

    // Nutrition checks: declared 0 vs Not declared, sodium*2.5 fallback, mixed g/ml warning
    expect(result.nutritionMatrix).not.toBeNull();
    expect(result.nutritionMatrix!.hasMixedUnits).toBe(true);
    expect(result.nutritionMatrix!.lowestSugarProduct).toBe('Non-Fat Plain Greek Yogurt');
    expect(result.nutritionMatrix!.highestProteinProduct).toBe('Non-Fat Plain Greek Yogurt');

    const totalFatRow = result.nutritionMatrix!.rows.find((r) => r.key === 'fat')!;
    expect(totalFatRow.cells[1].declared).toBe(true);
    expect(totalFatRow.cells[1].rawValue).toBe(0);
    expect(totalFatRow.cells[1].displayValue).toBe('0 g');
    expect(totalFatRow.cells[1].isLeader).toBe(true);

    const fiberRow = result.nutritionMatrix!.rows.find((r) => r.key === 'fiber')!;
    expect(fiberRow.cells[0].declared).toBe(true);
    expect(fiberRow.cells[0].displayValue).toBe('0.8 g');
    expect(fiberRow.cells[1].declared).toBe(false);
    expect(fiberRow.cells[1].displayValue).toBe('Not declared');
    expect(fiberRow.cells[0].isLeader).toBe(false); // Only 1 declared value: cannot crown winner

    const saltRow = result.nutritionMatrix!.rows.find((r) => r.key === 'salt')!;
    expect(saltRow.cells[0].rawValue).toBe(0.1); // 0.04 sodium * 2.5 = 0.1
    expect(saltRow.cells[1].rawValue).toBe(0.1);
    expect(saltRow.allTied).toBe(true);

    // Ingredient checks: shared "Water" normalized across both, unique ingredients & additives
    expect(result.ingredientMatrix!.sharedIngredients).toEqual(['Water']);
    expect(result.ingredientMatrix!.perProduct[0].uniqueIngredients).toContain('Whole Oats (10%)');
    expect(result.ingredientMatrix!.additiveRows).toHaveLength(1);
    expect(result.ingredientMatrix!.additiveRows[0].codeOrName).toContain('E340');
    expect(result.ingredientMatrix!.additiveRows[0].cells[0].present).toBe(true);
    expect(result.ingredientMatrix!.additiveRows[0].cells[1].present).toBe(false);

    // Allergen & F16 consumer safety checks
    expect(result.allergenMatrix!.hasAnyAllergens).toBe(true);
    expect(result.allergenMatrix!.consumerSafetyActive).toBe(true);
    expect(result.allergenMatrix!.consumerCells[0].tone).toBe('safe');
    expect(result.allergenMatrix!.consumerCells[1].tone).toBe('danger');
    const milkRow = result.allergenMatrix!.rows.find((r) => r.allergenLabel === 'Milk')!;
    expect(milkRow.cells[1].declared).toBe(true);
    expect(milkRow.cells[1].personalMatch).toBe(true);

    // Certification checks
    expect(result.certificationMatrix[0].docLabels).toEqual(['ISO 22000', 'HACCP']);
    expect(result.certificationMatrix[1].licenceLabel).toContain('MFG-101');
  });

  it('handles 3-way tied overall quality scores without awarding false winner badges', () => {
    const a = makeOatly();
    const b = {
      ...makeOatly(),
      product: { ...makeOatly().product, id: 10, name: 'Oat Milk B', qualityScore: 86 } as FoodProduct,
    };
    const c = {
      ...makeOatly(),
      product: { ...makeOatly().product, id: 11, name: 'Oat Milk C', qualityScore: 86 } as FoodProduct,
    };

    const result = engine.compare([a, b, c]);
    expect(result.mode).toBe('ready');
    expect(result.selectedCount).toBe(3);
    expect(result.products.every((p) => !p.isHighestScore && !p.isTiedTopScore)).toBe(true);
    expect(result.scoreMatrix[0].allTied).toBe(true);
  });
});
