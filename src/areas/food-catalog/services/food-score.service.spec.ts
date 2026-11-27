import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DEFAULT_SCORING_WEIGHTS,
  FoodScoreService,
  ScoreEvaluationInputs,
} from './food-score.service';
import { IngredientAnalyzerService } from './ingredient-analyzer.service';
import { ScoringConfig } from '../models/scoring-config.entity';
import { FoodScoreSnapshot } from '../models/food-score-snapshot.entity';
import { FoodProduct } from '../models/food-product.entity';
import { FoodRule } from '../../admin/models/food-rule.entity';
import { FoodSafetyDocument } from '../../food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from '../../food-safety/models/manufacturer-licence.entity';
import { FoodReview } from '../../community/models/food-review.entity';
import { FoodReport } from '../../community/models/food-report.entity';

describe('FoodScoreService (Feature F04 Unit Tests)', () => {
  let service: FoodScoreService;
  let analyzer: IngredientAnalyzerService;
  let scoringConfigRepo: any;
  let snapshotRepo: any;
  let productRepo: any;
  let foodRuleRepo: any;
  let documentRepo: any;
  let licenceRepo: any;
  let reviewRepo: any;
  let reportRepo: any;

  const baseConfig: ScoringConfig = {
    id: 1,
    configKey: 'default',
    ...DEFAULT_SCORING_WEIGHTS,
    updatedBy: null,
    notes: 'Default 5-component weights',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const makeHealthyProduct = (): FoodProduct =>
    ({
      id: 101,
      name: 'Barista Edition Oat Drink',
      brand: 'Oatly',
      category: 'Dairy & Plant Milks',
      barcode: '7394376311482',
      servingSize: 250,
      servingUnit: 'ml',
      status: 'active',
      banReason: null,
      qualityScore: 85,
      manufacturerId: 10,
      dietaryTags: ['Vegan'],
      ingredients: [
        { id: 1, name: 'Water', isAllergen: false, hazardLevel: 'safe', analysisStatus: 'matched' } as any,
        { id: 2, name: 'Whole Oats', isAllergen: false, hazardLevel: 'safe', analysisStatus: 'matched' } as any,
      ],
      nutritionFacts: [
        { id: 1, nutrient: 'Energy', amountPer100g: 60, amountPerServing: 150, unit: 'kcal' } as any,
        { id: 2, nutrient: 'Sugars', amountPer100g: 3.5, amountPerServing: 8.8, unit: 'g' } as any,
        { id: 3, nutrient: 'Saturated Fat', amountPer100g: 0.2, amountPerServing: 0.5, unit: 'g' } as any,
        { id: 4, nutrient: 'Sodium', amountPer100g: 0.04, amountPerServing: 0.1, unit: 'g' } as any,
        { id: 5, nutrient: 'Protein', amountPer100g: 1.0, amountPerServing: 2.5, unit: 'g' } as any,
        { id: 6, nutrient: 'Dietary Fiber', amountPer100g: 0.8, amountPerServing: 2.0, unit: 'g' } as any,
      ],
    }) as FoodProduct;

  beforeEach(async () => {
    scoringConfigRepo = {
      findOne: jest.fn().mockResolvedValue({ ...baseConfig }),
      create: jest.fn((data) => ({ id: 1, ...data })),
      save: jest.fn(async (cfg) => ({ ...cfg })),
    };

    snapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => ({ id: 1, createdAt: new Date('2026-02-01T00:00:00Z'), ...data })),
      save: jest.fn(async (data) => data),
      count: jest.fn().mockResolvedValue(0),
    };

    productRepo = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    foodRuleRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    documentRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    licenceRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    reviewRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    reportRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodScoreService,
        IngredientAnalyzerService,
        { provide: getRepositoryToken(ScoringConfig), useValue: scoringConfigRepo },
        { provide: getRepositoryToken(FoodScoreSnapshot), useValue: snapshotRepo },
        { provide: getRepositoryToken(FoodProduct), useValue: productRepo },
        { provide: getRepositoryToken(FoodRule), useValue: foodRuleRepo },
        { provide: getRepositoryToken(FoodSafetyDocument), useValue: documentRepo },
        { provide: getRepositoryToken(ManufacturerLicence), useValue: licenceRepo },
        { provide: getRepositoryToken(FoodReview), useValue: reviewRepo },
        { provide: getRepositoryToken(FoodReport), useValue: reportRepo },
      ],
    }).compile();

    service = module.get<FoodScoreService>(FoodScoreService);
    analyzer = module.get<IngredientAnalyzerService>(IngredientAnalyzerService);
  });

  describe('Deterministic 5-component scoring math', () => {
    it('computes reproducible 0-100 score and weighted contributions under default 35/30/15/10/10 weights', () => {
      const product = makeHealthyProduct();
      const ingredientReport = analyzer.buildProductAnalysisReport(product.ingredients, [], product.category);
      ingredientReport.counts.total = 2;
      ingredientReport.counts.recognized = 2;
      ingredientReport.counts.unknown = 0;
      ingredientReport.counts.safe = 2;
      ingredientReport.counts.coveragePercent = 100;

      const inputs: ScoreEvaluationInputs = {
        product,
        ingredientReport,
        documents: [
          {
            id: 1,
            manufacturerId: 10,
            companyName: 'Oatly Food Co',
            status: 'approved',
            expiryDate: new Date('2099-01-01'),
          } as any,
        ],
        licences: [
          {
            id: 1,
            companyName: 'Oatly Food Co',
            licenceNumber: 'BSTI-FOOD-2024-001',
            authority: 'BSTI',
            status: 'valid',
            expiryDate: new Date('2099-01-01'),
          } as any,
        ],
        reviews: [
          { id: 1, rating: 5, credibilityWeight: 2, visibility: 'visible' } as any,
          { id: 2, rating: 4, credibilityWeight: 1, visibility: 'visible' } as any,
        ],
        reports: [],
      };

      const firstRun = service.computeScoreBreakdown(inputs, DEFAULT_SCORING_WEIGHTS);
      const secondRun = service.computeScoreBreakdown(inputs, DEFAULT_SCORING_WEIGHTS);

      expect(firstRun).toEqual(secondRun);
      expect(firstRun.components).toHaveLength(5);
      expect(firstRun.weights).toEqual(DEFAULT_SCORING_WEIGHTS);
      expect(firstRun.totalScore).toBeGreaterThanOrEqual(85);
      expect(firstRun.tierNumber).toBe(1);
      expect(firstRun.quarantineCapApplied).toBe(false);

      // Sum of weighted contributions equals rawWeightedScore (within rounding precision)
      const sumWeighted = firstRun.components.reduce((acc, c) => acc + c.weightedContribution, 0);
      expect(Math.abs(sumWeighted - firstRun.rawWeightedScore)).toBeLessThanOrEqual(0.2);

      // Recall pillar remains honestly flagged as provisional pending Sprint 3 F08 recall feed
      const recallComp = firstRun.components.find((c) => c.key === 'recall');
      const communityComp = firstRun.components.find((c) => c.key === 'community');
      expect(recallComp?.provisional).toBe(true);
      expect(communityComp?.provisional).toBe(false);
    });

    it('separates unclassified ingredients, missing nutrition, missing verification, and 0 reviews as provisional baselines', () => {
      const bareProduct = {
        id: 202,
        name: 'Experimental Snack',
        brand: 'NewBrand',
        category: 'Snacks',
        status: 'active',
        manufacturerId: 55,
        servingUnit: 'g',
        banReason: null,
        ingredients: [{ name: 'Mystery Binder X', analysisStatus: 'unknown', hazardLevel: 'caution' }],
        nutritionFacts: [],
      } as any;

      const ingredientReport = analyzer.buildProductAnalysisReport(bareProduct.ingredients, [], bareProduct.category);
      const result = service.computeScoreBreakdown({
        product: bareProduct,
        ingredientReport,
        documents: [],
        licences: [],
        reviews: [],
        reports: [],
      });

      expect(result.isProvisional).toBe(true);
      expect(result.provisionalComponents).toEqual(
        expect.arrayContaining(['ingredient', 'nutrition', 'verification', 'recall', 'community']),
      );
      expect(result.provisionalDisclaimer).toContain('5 components use a clearly labelled provisional baseline');
    });

    it('enforces statutory quarantine cap <= 35 when product status is banned', () => {
      const bannedProduct = {
        ...makeHealthyProduct(),
        status: 'banned' as const,
        banReason: 'Sudan Red IV contamination detected',
      };
      const ingredientReport = analyzer.buildProductAnalysisReport(bannedProduct.ingredients, [], bannedProduct.category);
      ingredientReport.counts = {
        total: 2,
        recognized: 2,
        unknown: 0,
        safe: 2,
        caution: 0,
        warning: 0,
        allergens: 0,
        additives: 0,
        coveragePercent: 100,
      };

      const breakdown = service.computeScoreBreakdown({
        product: bannedProduct,
        ingredientReport,
        documents: [
          {
            id: 1,
            manufacturerId: 10,
            companyName: 'Oatly',
            status: 'approved',
            expiryDate: new Date('2099-01-01'),
          } as any,
        ],
        licences: [],
        reviews: [{ id: 1, rating: 5, credibilityWeight: 2, visibility: 'visible' } as any],
        reports: [{ id: 1, status: 'investigating', category: 'contaminated', batchCode: 'B1' } as any],
      });

      expect(breakdown.quarantineCapApplied).toBe(true);
      expect(breakdown.totalScore).toBeLessThanOrEqual(35);
      expect(breakdown.tierNumber).toBe(3);

      const recallComp = breakdown.components.find((c) => c.key === 'recall');
      expect(recallComp?.score).toBe(0);
      expect(recallComp?.provisional).toBe(false);
    });

    it('penalizes open F13 complaints and batch complaint clusters in recall pillar', () => {
      const product = makeHealthyProduct();
      const ingredientReport = analyzer.buildProductAnalysisReport([], [], product.category);

      const clean = service.computeScoreBreakdown({
        product,
        ingredientReport,
        documents: [],
        licences: [],
        reviews: [],
        reports: [],
      });

      const troubled = service.computeScoreBreakdown({
        product,
        ingredientReport,
        documents: [],
        licences: [],
        reviews: [],
        reports: [
          { id: 1, status: 'pending', category: 'contaminated', batchCode: 'LOT-99' } as any,
          { id: 2, status: 'investigating', category: 'spoiled', batchCode: 'LOT-99' } as any,
        ],
      });

      const cleanRecall = clean.components.find((c) => c.key === 'recall')!.score;
      const troubledRecall = troubled.components.find((c) => c.key === 'recall')!.score;
      expect(cleanRecall).toBe(95);
      expect(troubledRecall).toBeLessThan(cleanRecall - 40);
      expect(troubled.components.find((c) => c.key === 'recall')!.rationale).toContain('batch anomaly cluster');
    });

    it('converts Sodium to Salt equivalent (Sodium * 2.5) when Salt row is absent', () => {
      const product = {
        ...makeHealthyProduct(),
        nutritionFacts: [
          { nutrient: 'Sugars', amountPer100g: 2.0, unit: 'g' } as any,
          { nutrient: 'Saturated Fat', amountPer100g: 0.8, unit: 'g' } as any,
          { nutrient: 'Sodium', amountPer100g: 0.8, unit: 'g' } as any, // 0.8 * 2.5 = 2.0g salt eq -> high salt penalty
        ],
      } as FoodProduct;

      const breakdown = service.computeScoreBreakdown({
        product,
        ingredientReport: analyzer.buildProductAnalysisReport([], [], product.category),
        documents: [],
        licences: [],
        reviews: [],
        reports: [],
      });

      const nutComp = breakdown.components.find((c) => c.key === 'nutrition')!;
      expect(nutComp.rationale).toContain('Salt eq. 2g');
      expect(nutComp.provisional).toBe(false);
    });
  });

  describe('Admin scoring weights & catalog recalculation', () => {
    it('rejects weights that do not sum to 100%', async () => {
      await expect(
        service.updateWeights(
          {
            ingredientWeight: 40,
            nutritionWeight: 30,
            verificationWeight: 15,
            recallWeight: 10,
            communityWeight: 10, // sum = 105
          },
          { id: 1, role: 'admin' },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(scoringConfigRepo.save).not.toHaveBeenCalled();
    });

    it('rejects negative or out-of-range weights', async () => {
      await expect(
        service.updateWeights(
          {
            ingredientWeight: -5,
            nutritionWeight: 50,
            verificationWeight: 25,
            recallWeight: 20,
            communityWeight: 10,
          },
          { id: 1, role: 'admin' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists valid 100% weights and recalculates all catalog products', async () => {
      const product = makeHealthyProduct();
      productRepo.find.mockResolvedValue([product]);

      const res = await service.updateWeights(
        {
          ingredientWeight: 40,
          nutritionWeight: 25,
          verificationWeight: 15,
          recallWeight: 10,
          communityWeight: 10,
          notes: 'Emphasize F03 ingredient safety',
        },
        { id: 99, role: 'admin' },
      );

      expect(scoringConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientWeight: 40,
          nutritionWeight: 25,
          updatedBy: 99,
          notes: 'Emphasize F03 ingredient safety',
        }),
      );
      expect(res.recalculation.productsEvaluated).toBe(1);
      expect(res.recalculation.snapshotsRecorded).toBe(1);
      expect(snapshotRepo.save).toHaveBeenCalled();
    });
  });

  describe('Snapshot history synchronization', () => {
    it('records snapshot on initial evaluation and skips duplicate when scores and weights are unchanged', async () => {
      const product = makeHealthyProduct();

      // First sync: no prior snapshot exists
      snapshotRepo.findOne.mockResolvedValueOnce(null);
      const first = await service.evaluateAndSyncProduct(product, { trigger: 'product_create' });
      expect(first.snapshotCreated).toBe(true);
      expect(snapshotRepo.save).toHaveBeenCalledTimes(1);

      // Build matching existing latest snapshot
      const getScore = (key: string) =>
        first.breakdown.components.find((c) => c.key === key)!.score;
      const latestSnap: Partial<FoodScoreSnapshot> = {
        id: 1,
        productId: product.id,
        totalScore: first.breakdown.totalScore,
        tierNumber: first.breakdown.tierNumber,
        ingredientScore: getScore('ingredient'),
        nutritionScore: getScore('nutrition'),
        verificationScore: getScore('verification'),
        recallScore: getScore('recall'),
        communityScore: getScore('community'),
        ingredientWeight: 35,
        nutritionWeight: 30,
        verificationWeight: 15,
        recallWeight: 10,
        communityWeight: 10,
      };

      snapshotRepo.findOne.mockResolvedValueOnce(latestSnap);
      const second = await service.evaluateAndSyncProduct(product, { trigger: 'signal_sync' });
      expect(second.snapshotCreated).toBe(false);
      expect(snapshotRepo.save).toHaveBeenCalledTimes(1);
    });

    it('computes score delta labels across chronological snapshots', async () => {
      snapshotRepo.find.mockResolvedValue([
        {
          id: 2,
          totalScore: 84,
          tierNumber: 1,
          trigger: 'rule_update',
          isProvisional: true,
          ingredientWeight: 35,
          nutritionWeight: 30,
          verificationWeight: 15,
          recallWeight: 10,
          communityWeight: 10,
          ingredientScore: 90,
          nutritionScore: 80,
          verificationScore: 82,
          recallScore: 95,
          communityScore: 70,
          createdAt: new Date('2026-02-10T00:00:00Z'),
        },
        {
          id: 1,
          totalScore: 76,
          tierNumber: 2,
          trigger: 'seed',
          isProvisional: true,
          ingredientWeight: 35,
          nutritionWeight: 30,
          verificationWeight: 15,
          recallWeight: 10,
          communityWeight: 10,
          ingredientScore: 75,
          nutritionScore: 80,
          verificationScore: 70,
          recallScore: 95,
          communityScore: 70,
          createdAt: new Date('2026-02-01T00:00:00Z'),
        },
      ]);

      const history = await service.getProductScoreHistory(101);
      expect(history).toHaveLength(2);
      expect(history[0].deltaFromPrevious).toBe(8);
      expect(history[0].deltaLabel).toBe('+8');
      expect(history[0].deltaPositive).toBe(true);
      expect(history[0].triggerLabel).toBe('Food rule base updated');
      expect(history[1].deltaFromPrevious).toBeNull();
    });

    it('returns catalog tier distribution and average score', async () => {
      productRepo.find.mockResolvedValue([
        { id: 1, qualityScore: 90 },
        { id: 2, qualityScore: 72 },
        { id: 3, qualityScore: 45 },
      ]);
      snapshotRepo.count.mockResolvedValue(6);

      const stats = await service.getCatalogTierStats();
      expect(stats).toEqual({
        total: 3,
        averageScore: 69,
        tier1: 1,
        tier2: 1,
        tier3: 1,
        snapshotCount: 6,
      });
    });
  });
});
