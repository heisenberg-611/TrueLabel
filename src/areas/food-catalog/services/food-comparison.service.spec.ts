import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FoodComparisonService } from './food-comparison.service';
import { FoodComparisonEngine } from './food-comparison.engine';
import { FoodProduct } from '../models/food-product.entity';
import { FoodRule } from '../../admin/models/food-rule.entity';
import { FoodSafetyDocument } from '../../food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from '../../food-safety/models/manufacturer-licence.entity';
import { FoodReview } from '../../community/models/food-review.entity';
import { FoodReport } from '../../community/models/food-report.entity';
import { IngredientAnalyzerService } from './ingredient-analyzer.service';
import { DEFAULT_SCORING_WEIGHTS, FoodScoreService } from './food-score.service';

describe('FoodComparisonService (Feature F05 Unit Tests)', () => {
  let service: FoodComparisonService;
  let productRepo: any;
  let qbMock: any;
  let foodRuleRepo: any;
  let documentRepo: any;
  let licenceRepo: any;
  let reviewRepo: any;
  let reportRepo: any;
  let foodScoreService: any;

  const lightweightList = [
    {
      id: 1,
      name: 'Barista Edition Oat Drink',
      brand: 'Oatly',
      category: 'Dairy & Plant Milks',
      barcode: '7394376311482',
      qualityScore: 86,
      servingSize: 250,
      servingUnit: 'ml',
      status: 'active',
    },
    {
      id: 2,
      name: 'Non-Fat Plain Greek Yogurt',
      brand: 'Chobani',
      category: 'Dairy & Plant Milks',
      barcode: '089470001382',
      qualityScore: 82,
      servingSize: 150,
      servingUnit: 'g',
      status: 'active',
    },
    {
      id: 3,
      name: 'Original Taste Carbonated Cola',
      brand: 'Coca-Cola',
      category: 'Beverages',
      barcode: '5449000000996',
      qualityScore: 44,
      servingSize: 330,
      servingUnit: 'ml',
      status: 'active',
    },
  ];

  const fullProducts: FoodProduct[] = [
    {
      ...(lightweightList[0] as any),
      manufacturerId: 10,
      dietaryTags: ['Vegan'],
      ingredients: [{ id: 1, name: 'Water', isAllergen: false, hazardLevel: 'safe' }],
      nutritionFacts: [{ id: 1, nutrient: 'Sugars', amountPer100g: 3.4, amountPerServing: 8.5, unit: 'g' }],
    },
    {
      ...(lightweightList[1] as any),
      manufacturerId: 11,
      dietaryTags: ['High Protein'],
      ingredients: [{ id: 2, name: 'Skim Milk', isAllergen: true, allergenType: 'Milk', hazardLevel: 'warning' }],
      nutritionFacts: [{ id: 2, nutrient: 'Sugars', amountPer100g: 2.7, amountPerServing: 4.1, unit: 'g' }],
    },
  ];

  beforeEach(async () => {
    qbMock = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(lightweightList),
    };

    productRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      find: jest.fn().mockResolvedValue(fullProducts),
    };

    foodRuleRepo = { find: jest.fn().mockResolvedValue([]) };
    documentRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          manufacturerId: 10,
          companyName: 'Oatly AB',
          documentType: 'iso22000',
          status: 'approved',
          expiryDate: new Date('2030-01-01'),
        },
      ]),
    };
    licenceRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          companyName: 'Oatly AB',
          licenceNumber: 'SE-OAT-991',
          authority: 'Livsmedelsverket',
          status: 'valid',
          expiryDate: new Date('2030-01-01'),
        },
      ]),
    };
    reviewRepo = { find: jest.fn().mockResolvedValue([]) };
    reportRepo = { find: jest.fn().mockResolvedValue([]) };

    foodScoreService = {
      getActiveConfig: jest.fn().mockResolvedValue(DEFAULT_SCORING_WEIGHTS),
      computeScoreBreakdown: jest.fn((input: { product: FoodProduct }) => ({
        totalScore: input.product.qualityScore,
        rawWeightedScore: input.product.qualityScore,
        quarantineCapApplied: false,
        tierNumber: 1,
        tierLabel: 'Tier 1: High transparency',
        isProvisional: false,
        provisionalComponents: [],
        provisionalDisclaimer: null,
        weights: DEFAULT_SCORING_WEIGHTS,
        components: [
          {
            key: 'verification',
            label: 'Verification & certification',
            weight: 20,
            score: 85,
            weightedContribution: 17,
            weightedContributionFormatted: '17.0',
            provisional: false,
            explanation: 'Verified',
            tone: 'blue',
          },
        ],
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodComparisonService,
        FoodComparisonEngine,
        IngredientAnalyzerService,
        { provide: getRepositoryToken(FoodProduct), useValue: productRepo },
        { provide: getRepositoryToken(FoodRule), useValue: foodRuleRepo },
        { provide: getRepositoryToken(FoodSafetyDocument), useValue: documentRepo },
        { provide: getRepositoryToken(ManufacturerLicence), useValue: licenceRepo },
        { provide: getRepositoryToken(FoodReview), useValue: reviewRepo },
        { provide: getRepositoryToken(FoodReport), useValue: reportRepo },
        { provide: FoodScoreService, useValue: foodScoreService },
      ],
    }).compile();

    service = module.get<FoodComparisonService>(FoodComparisonService);
  });

  it('fetches lightweight picker candidates with bounded columns and no eager relations', async () => {
    const result = await service.compareFoods([]);

    expect(productRepo.createQueryBuilder).toHaveBeenCalledWith('product');
    expect(qbMock.select).toHaveBeenCalled();
    expect(qbMock.take).toHaveBeenCalledWith(100);
    expect(productRepo.find).not.toHaveBeenCalled();
    expect(result.comparison.mode).toBe('empty');
    expect(result.categories).toEqual(['Dairy & Plant Milks', 'Beverages']);
    expect(result.pickerGroups).toHaveLength(2);
    expect(result.pickerGroups[0].quickCompareUrl).toBe('/catalog/compare?ids=1,2');
  });

  it('orchestrates selected products, preserves requested order, and tracks missing IDs', async () => {
    const evaluateConflictFn = jest.fn((_profile, product: FoodProduct) => ({
      hasConflicts: product.id === 2,
      hasAllergenConflict: product.id === 2,
      hasDietaryConflict: false,
      hasNutritionWarning: false,
      conflicts: [],
      matchedAllergies: product.id === 2 ? ['Milk'] : [],
      dietaryMismatches: [],
      isSafeForUser: product.id !== 2,
      profileConfigured: true,
    }));

    const result = await service.compareFoods([2, 1, 999], {
      userProfile: { allergies: ['Milk'] },
      evaluateConflictFn,
    });

    expect(productRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['ingredients', 'nutritionFacts'] }),
    );
    expect(result.comparison.mode).toBe('ready');
    expect(result.comparison.missingIds).toEqual([999]);
    // Requested order preserved: Chobani (2) first, Oatly (1) second
    expect(result.comparison.products.map((p) => p.id)).toEqual([2, 1]);
    expect(result.comparison.allergenMatrix!.consumerSafetyActive).toBe(true);
    expect(result.comparison.certificationMatrix[1].docLabels).toContain('ISO 22000');
    expect(result.comparison.certificationMatrix[1].licenceLabel).toContain('SE-OAT-991');
    expect(evaluateConflictFn).toHaveBeenCalledTimes(2);
  });

  it('filters picker groups to active category and marks other categories as different', async () => {
    const result = await service.compareFoods([1, 2], { pickerCategory: 'Beverages' });

    expect(result.selectedCategoryFilter).toBe('Beverages');
    expect(result.pickerGroups).toHaveLength(1);
    expect(result.pickerGroups[0].category).toBe('Beverages');
    expect(result.pickerGroups[0].products[0].isDifferentCategory).toBe(true);
  });
});
