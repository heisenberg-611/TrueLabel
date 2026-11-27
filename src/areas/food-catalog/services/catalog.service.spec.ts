import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { IngredientAnalyzerService } from './ingredient-analyzer.service';
import { FoodScoreService } from './food-score.service';
import { FoodProduct } from '../models/food-product.entity';
import { Ingredient } from '../models/ingredient.entity';
import { NutritionFact } from '../models/nutrition-fact.entity';
import { FoodScoreSnapshot } from '../models/food-score-snapshot.entity';
import { FoodRule } from '../../admin/models/food-rule.entity';

describe('CatalogService (Unit Tests)', () => {
  let service: CatalogService;
  let productRepo: jest.Mocked<Partial<Repository<FoodProduct>>>;
  let ingredientRepo: jest.Mocked<Partial<Repository<Ingredient>>>;
  let nutritionRepo: jest.Mocked<Partial<Repository<NutritionFact>>>;
  let foodRuleRepo: jest.Mocked<Partial<Repository<FoodRule>>>;

  const mockProduct: FoodProduct = {
    id: 1,
    name: 'Pure Oat Milk',
    brand: 'OatLand',
    category: 'Dairy & Plant Milks',
    barcode: '8901234567890',
    imageUrl: '/images/oat-milk.png',
    description: 'Unsweetened whole oat drink',
    servingSize: 200,
    servingUnit: 'ml',
    status: 'active',
    banReason: null,
    bannedAt: null,
    bannedBy: null,
    qualityScore: 88,
    manufacturerId: 10,
    dietaryTags: ['Vegan', 'Gluten-Free'],
    ingredients: [],
    nutritionFacts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    productRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    ingredientRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    nutritionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    foodRuleRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        IngredientAnalyzerService,
        {
          provide: getRepositoryToken(FoodProduct),
          useValue: productRepo,
        },
        {
          provide: getRepositoryToken(Ingredient),
          useValue: ingredientRepo,
        },
        {
          provide: getRepositoryToken(NutritionFact),
          useValue: nutritionRepo,
        },
        {
          provide: getRepositoryToken(FoodRule),
          useValue: foodRuleRepo,
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('create (Feature F01)', () => {
    it('should successfully create a new food product with ingredients and nutrition', async () => {
      // Arrange
      const dto = {
        name: 'Pure Oat Milk',
        brand: 'OatLand',
        category: 'Dairy & Plant Milks',
        barcode: '8901234567890',
        servingSize: 200,
        servingUnit: 'ml',
        dietaryTags: ['Vegan'],
        ingredients: [
          { name: 'Oats', isAllergen: false, hazardLevel: 'safe' as const },
          { name: 'Water', isAllergen: false, hazardLevel: 'safe' as const },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 45, unit: 'kcal' },
          { nutrient: 'Sugars', amountPer100g: 3.2, unit: 'g' },
        ],
      };

      (productRepo.findOne as jest.Mock).mockResolvedValue(null);
      (productRepo.create as jest.Mock).mockReturnValue({ ...mockProduct, id: 1 });
      (productRepo.save as jest.Mock).mockResolvedValue({ ...mockProduct, id: 1 });
      (ingredientRepo.create as jest.Mock).mockImplementation((item) => item);
      (ingredientRepo.save as jest.Mock).mockResolvedValue([
        { id: 1, name: 'Oats' },
        { id: 2, name: 'Water' },
      ]);
      (nutritionRepo.create as jest.Mock).mockImplementation((item) => item);
      (nutritionRepo.save as jest.Mock).mockResolvedValue([
        { id: 1, nutrient: 'Energy', amountPer100g: 45 },
      ]);

      // Act
      const result = await service.create(dto, 10);

      // Assert
      expect(result).toBeDefined();
      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { barcode: '8901234567890' },
      });
      expect(productRepo.save).toHaveBeenCalled();
      expect(ingredientRepo.save).toHaveBeenCalled();
      expect(nutritionRepo.save).toHaveBeenCalled();
    });

    it('should reject creation with ConflictException if barcode is duplicate', async () => {
      // Arrange
      const dto = {
        name: 'Another Food',
        brand: 'BrandX',
        category: 'Snacks',
        barcode: '8901234567890',
      };

      (productRepo.findOne as jest.Mock).mockResolvedValue(mockProduct);

      // Act & Assert
      await expect(service.create(dto, 10)).rejects.toThrow(ConflictException);
      expect(productRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findByBarcode (Feature F01)', () => {
    it('should return product when active product with barcode exists', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await service.findByBarcode('8901234567890');

      // Assert
      expect(result).toEqual(mockProduct);
      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { barcode: '8901234567890' },
        relations: ['ingredients', 'nutritionFacts'],
      });
    });

    it('should return banned product when barcode is scanned so consumer sees regulatory warning', async () => {
      // Arrange
      const banned = { ...mockProduct, status: 'banned' as const, banReason: 'Toxic additive' };
      (productRepo.findOne as jest.Mock).mockResolvedValue(banned);

      // Act
      const result = await service.findByBarcode('8901234567890');

      // Assert
      expect(result).toEqual(banned);
      expect(result?.status).toBe('banned');
    });

    it('should return null when barcode does not exist (enables request-to-add page)', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.findByBarcode('0000000000000');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findById (Feature F01)', () => {
    it('should return product with full relations when id is found', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await service.findById(1);

      // Assert
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when id is not found', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (Feature F01)', () => {
    it('should allow owner manufacturer to update their own product', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue({ ...mockProduct });
      (productRepo.save as jest.Mock).mockImplementation(async (p) => p);

      // Act
      const result = await service.update(
        1,
        { name: 'Updated Oat Milk' },
        { id: 10, role: 'manufacturer' },
      );

      // Assert
      expect(result.name).toBe('Updated Oat Milk');
      expect(productRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if manufacturer attempts to update another manufacturer product', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue({
        ...mockProduct,
        manufacturerId: 999, // Different owner
      });

      // Act & Assert
      await expect(
        service.update(1, { name: 'Hack' }, { id: 10, role: 'manufacturer' }),
      ).rejects.toThrow(ForbiddenException);
      expect(productRepo.save).not.toHaveBeenCalled();
    });

    it('should allow admin to update any product', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue({
        ...mockProduct,
        manufacturerId: 999,
      });
      (productRepo.save as jest.Mock).mockImplementation(async (p) => p);

      // Act
      const result = await service.update(
        1,
        { name: 'Admin Edited Name' },
        { id: 1, role: 'admin' },
      );

      // Assert
      expect(result.name).toBe('Admin Edited Name');
    });
  });

  describe('archive (Feature F01)', () => {
    it('should set status to archived when owner requests', async () => {
      // Arrange
      const activeProd = { ...mockProduct, status: 'active' as const };
      (productRepo.findOne as jest.Mock).mockResolvedValue(activeProd);
      (productRepo.save as jest.Mock).mockImplementation(async (p) => p);

      // Act
      const result = await service.archive(1, { id: 10, role: 'manufacturer' });

      // Assert
      expect(result.status).toBe('archived');
      expect(productRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-owner manufacturer attempts to archive', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue({
        ...mockProduct,
        manufacturerId: 50,
      });

      // Act & Assert
      await expect(
        service.archive(1, { id: 10, role: 'manufacturer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchAndFilter (Feature F01)', () => {
    it('should execute query builder and return paginated products', async () => {
      // Arrange
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockProduct], 1]),
      };
      (productRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.searchAndFilter({ q: 'Oat', category: 'Dairy & Plant Milks' });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should filter by dietary tag in query builder', async () => {
      // Arrange
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockProduct], 1]),
      };
      (productRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.searchAndFilter({ tag: 'Vegan' });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(product.dietaryTags) LIKE :tag',
        { tag: '%vegan%' },
      );
    });
  });

  describe('getQualityScoreTier (Quality Scoring & Tier Logic)', () => {
    it('should classify high scores (>= 80) as Tier 1 with emerald styling', () => {
      const tier80 = service.getQualityScoreTier(80);
      const tier92 = service.getQualityScoreTier(92);

      expect(tier80.tierNumber).toBe(1);
      expect(tier80.tierLabel).toContain('Tier 1');
      expect(tier80.textColorClass).toContain('text-emerald-700');
      expect(tier80.badgeClass).toBe('score-badge-high');
      expect(tier80.isHigh).toBe(true);

      expect(tier92.tierNumber).toBe(1);
      expect(tier92.isHigh).toBe(true);
    });

    it('should classify moderate scores (60-79) as Tier 2 with amber styling', () => {
      const tier60 = service.getQualityScoreTier(60);
      const tier75 = service.getQualityScoreTier(75);

      expect(tier60.tierNumber).toBe(2);
      expect(tier60.tierLabel).toContain('Tier 2');
      expect(tier60.textColorClass).toContain('text-amber-700');
      expect(tier60.badgeClass).toBe('score-badge-mid');
      expect(tier60.isMid).toBe(true);

      expect(tier75.tierNumber).toBe(2);
      expect(tier75.isMid).toBe(true);
    });

    it('should classify low scores (< 60) such as 54 as Tier 3 with rose/crimson styling (NOT emerald)', () => {
      const tier54 = service.getQualityScoreTier(54);
      const tier59 = service.getQualityScoreTier(59);

      // Score 54 must be Tier 3 and Rose, never Tier 1 or Emerald
      expect(tier54.score).toBe(54);
      expect(tier54.tierNumber).toBe(3);
      expect(tier54.tierLabel).toContain('Tier 3');
      expect(tier54.textColorClass).toContain('text-rose-700');
      expect(tier54.textColorClass).not.toContain('text-emerald');
      expect(tier54.badgeClass).toBe('score-badge-low');
      expect(tier54.isLow).toBe(true);
      expect(tier54.isHigh).toBe(false);

      expect(tier59.tierNumber).toBe(3);
      expect(tier59.isLow).toBe(true);
    });
  });

  describe('buildDossierSpecimen (Forensic Specimen Generator)', () => {
    it('should return null if product is null or undefined', () => {
      expect(service.buildDossierSpecimen(null as any)).toBeNull();
    });

    it('should generate accurate forensic analysis for clean specimen (score 92)', () => {
      const cleanProduct: FoodProduct = {
        ...mockProduct,
        qualityScore: 92,
        ingredients: [
          { id: 1, name: 'Water', hazardLevel: 'safe', isAllergen: false } as any,
          { id: 2, name: 'Oats', hazardLevel: 'safe', isAllergen: true, allergenType: 'Gluten' } as any,
        ],
        nutritionFacts: [
          { id: 1, nutrient: 'Sugars', amountPer100g: 3.5, unit: 'g' } as any,
        ],
      };

      const specimen = service.buildDossierSpecimen(cleanProduct, 'BSTI-FOOD-2024-001');

      expect(specimen).not.toBeNull();
      expect(specimen?.tierInfo.tierNumber).toBe(1);
      expect(specimen?.tierInfo.textColorClass).toContain('text-emerald-700');
      expect(specimen?.additivesSummary.count).toBe(0);
      expect(specimen?.additivesSummary.label).toContain('0 Detected (Clean Label)');
      expect(specimen?.allergensSummary.count).toBe(1);
      expect(specimen?.allergensSummary.label).toContain('Gluten Declared');
      expect(specimen?.sugarSummary.status).toBe('safe');
      expect(specimen?.sugarSummary.label).toContain('Low Density');
      expect(specimen?.nationalLicence).toBe('BSTI-FOOD-2024-001 (Valid)');
    });

    it('should generate accurate forensic analysis for additive-dense low score specimen (score 54)', () => {
      const sodaProduct: FoodProduct = {
        ...mockProduct,
        id: 4,
        name: 'Sparkling Dark Citrus Soda',
        brand: 'FizzCraft',
        qualityScore: 54,
        servingUnit: 'ml',
        ingredients: [
          { id: 1, name: 'Carbonated Water', hazardLevel: 'safe', isAllergen: false } as any,
          { id: 2, name: 'High Fructose Corn Syrup', hazardLevel: 'caution', isAllergen: false } as any,
          { id: 3, name: 'Caramel Color', additiveCode: 'E150d', hazardLevel: 'caution', isAllergen: false } as any,
          { id: 4, name: 'Phosphoric Acid', additiveCode: 'E338', hazardLevel: 'caution', isAllergen: false } as any,
        ],
        nutritionFacts: [
          { id: 1, nutrient: 'Sugars', amountPer100g: 10.6, unit: 'g' } as any,
        ],
      };

      const specimen = service.buildDossierSpecimen(sodaProduct);

      expect(specimen).not.toBeNull();
      expect(specimen?.tierInfo.score).toBe(54);
      expect(specimen?.tierInfo.tierNumber).toBe(3);
      expect(specimen?.tierInfo.textColorClass).toContain('text-rose-700');
      expect(specimen?.tierInfo.textColorClass).not.toContain('text-emerald');
      expect(specimen?.additivesSummary.count).toBe(3); // Corn syrup (caution), E150d, E338
      expect(specimen?.additivesSummary.status).toBe('hazard');
      expect(specimen?.additivesSummary.label).toContain('Detected');
      expect(specimen?.allergensSummary.count).toBe(0);
      expect(specimen?.allergensSummary.label).toContain('0 Declared');
      expect(specimen?.sugarSummary.status).toBe('hazard');
      expect(specimen?.sugarSummary.label).toContain('High Density / Flagged');
    });

    it('should exclude unknown unclassified ingredients (without additiveCode) from synthetic additives count', () => {
      const mixedProduct: FoodProduct = {
        ...mockProduct,
        ingredients: [
          { id: 1, name: 'Water', hazardLevel: 'safe', analysisStatus: 'matched', isAllergen: false } as any,
          { id: 2, name: 'Exotic Berry Flavor', hazardLevel: 'caution', analysisStatus: 'unknown', additiveCode: null, isAllergen: false } as any,
        ],
      };

      const specimen = service.buildDossierSpecimen(mixedProduct);

      expect(specimen?.additivesSummary.count).toBe(0);
      expect(specimen?.additivesSummary.label).toContain('0 Detected');
    });
  });

  describe('Feature F03: Rule-Based Ingredient Analysis & Recalculation', () => {
    const activeRules: FoodRule[] = [
      {
        id: 11,
        name: 'Whole Oats',
        pattern: 'oats, whole oats',
        ruleType: 'ingredient',
        additiveCode: null,
        allergenType: null,
        categoryScope: null,
        hazardLevel: 'safe',
        fdaStatus: 'GRAS Verified',
        euStatus: 'EU Authorized',
        explanation: 'Whole grain oats.',
        source: 'USDA Standard',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 12,
        name: 'Phosphoric Acid (Beverage Limit)',
        pattern: 'phosphoric acid, e338',
        ruleType: 'category_restriction',
        additiveCode: 'E338',
        allergenType: null,
        categoryScope: 'Beverages',
        hazardLevel: 'warning',
        fdaStatus: 'FDA Limit',
        euStatus: 'EFSA ADI 40 mg/kg',
        explanation: 'Restricted acidulant in beverages.',
        source: 'EFSA Panel',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('create() should evaluate ingredients against FoodRule base and penalize unknown ingredients', async () => {
      // Arrange
      (foodRuleRepo.find as jest.Mock).mockResolvedValue(activeRules);
      (productRepo.findOne as jest.Mock).mockResolvedValue(null);
      (productRepo.create as jest.Mock).mockImplementation((p) => ({ id: 50, ...p }));
      (productRepo.save as jest.Mock).mockImplementation(async (p) => p);
      (ingredientRepo.create as jest.Mock).mockImplementation((i) => i);
      (ingredientRepo.save as jest.Mock).mockImplementation(async (items) => items);

      const dto = {
        name: 'Oat Citrus Tonic',
        brand: 'Botanica',
        category: 'Beverages',
        barcode: '991122334455',
        ingredients: [
          { name: 'Whole Oats' },
          { name: 'Phosphoric Acid (E338)' },
          { name: 'Exotic Yuzu Essence' },
        ],
      };

      // Act
      const created = await service.create(dto as any, 10);

      // Assert
      // Baseline 88 - 16 (warning E338) - 6 (unknown Exotic Yuzu Essence) = 66
      expect(created.qualityScore).toBe(66);
      expect(created.ingredients).toHaveLength(3);
      expect(created.ingredients[0].analysisStatus).toBe('matched');
      expect(created.ingredients[1].hazardLevel).toBe('warning');
      expect(created.ingredients[2].analysisStatus).toBe('unknown');
      expect(created.ingredients[2].hazardLevel).toBe('caution');
    });

    it('analyzeProductIngredients() should partition matched and unknown ingredients cleanly', async () => {
      // Arrange
      (foodRuleRepo.find as jest.Mock).mockResolvedValue(activeRules);
      const product = {
        ...mockProduct,
        category: 'Beverages',
        ingredients: [
          { id: 1, name: 'Whole Oats' },
          { id: 2, name: 'Exotic Mystery Root' },
        ],
      } as any;

      // Act
      const report = await service.analyzeProductIngredients(product);

      // Assert
      expect(report.recognizedIngredients).toHaveLength(1);
      expect(report.unknownIngredients).toHaveLength(1);
      expect(report.counts.coveragePercent).toBe(50);
    });

    it('recalculateAllWithRules() should update changed ingredients across catalog products', async () => {
      // Arrange
      const catalogProducts = [
        {
          ...mockProduct,
          id: 1,
          category: 'Beverages',
          ingredients: [
            {
              id: 101,
              name: 'Whole Oats',
              isAllergen: false,
              allergenType: null,
              additiveCode: null,
              hazardLevel: 'safe',
              explanation: 'Whole grain oats.',
              analysisStatus: 'matched',
              matchedRuleId: 11,
              ruleSource: 'USDA Standard',
              fdaStatus: 'GRAS Verified',
              euStatus: 'EU Authorized',
            },
            {
              id: 102,
              name: 'Exotic Berry Flavor',
              isAllergen: false,
              allergenType: null,
              additiveCode: null,
              hazardLevel: 'caution',
              explanation: 'Unclassified',
              analysisStatus: 'unknown',
              matchedRuleId: null,
              ruleSource: 'Unclassified',
              fdaStatus: 'Unverified',
              euStatus: 'Unverified',
            },
          ],
        },
      ];
      (productRepo.find as jest.Mock).mockResolvedValue(catalogProducts);
      (ingredientRepo.save as jest.Mock).mockImplementation(async (rows) => rows);

      const expandedRules: FoodRule[] = [
        ...activeRules,
        {
          id: 99,
          name: 'Exotic Berry Flavor',
          pattern: 'exotic berry flavor',
          ruleType: 'ingredient',
          additiveCode: null,
          allergenType: null,
          categoryScope: null,
          hazardLevel: 'safe',
          fdaStatus: 'FDA Flavoring Approved',
          euStatus: 'EFSA Flavouring Verified',
          explanation: 'Verified botanical berry flavor.',
          source: 'Admin Rule Base',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Act
      const summary = await service.recalculateAllWithRules(expandedRules);

      // Assert
      expect(summary.productsEvaluated).toBe(1);
      expect(summary.productsUpdated).toBe(1);
      expect(summary.ingredientsEvaluated).toBe(2);
      expect(summary.ingredientsUpdated).toBe(1);
      expect(summary.matchedCount).toBe(2);
      expect(summary.unknownCount).toBe(0);
      expect(ingredientRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 102,
            analysisStatus: 'matched',
            matchedRuleId: 99,
            hazardLevel: 'safe',
          }),
        ]),
      );
    });
  });

  describe('Feature F04: FoodScoreService & Snapshot Lifecycle Integration', () => {
    it('delegates create, ban, unban, recalculateAllWithRules, and delete snapshot cleanup when FoodScoreService is wired', async () => {
      const mockScoreService: jest.Mocked<Partial<FoodScoreService>> = {
        evaluateAndSyncProduct: jest.fn().mockResolvedValue({
          breakdown: { totalScore: 81 } as any,
          history: [],
          config: {} as any,
          updatedProductScore: true,
          snapshotCreated: true,
        }),
        recalculateAllScores: jest.fn().mockResolvedValue({
          productsEvaluated: 1,
          productsUpdated: 1,
          snapshotsRecorded: 1,
          tierCounts: { tier1: 1, tier2: 0, tier3: 0 },
        }),
      };
      const mockSnapshotRepo = { delete: jest.fn().mockResolvedValue({ affected: 2 }) };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CatalogService,
          IngredientAnalyzerService,
          { provide: getRepositoryToken(FoodProduct), useValue: productRepo },
          { provide: getRepositoryToken(Ingredient), useValue: ingredientRepo },
          { provide: getRepositoryToken(NutritionFact), useValue: nutritionRepo },
          { provide: getRepositoryToken(FoodRule), useValue: foodRuleRepo },
          { provide: getRepositoryToken(FoodScoreSnapshot), useValue: mockSnapshotRepo },
          { provide: FoodScoreService, useValue: mockScoreService },
        ],
      }).compile();

      const wiredService = module.get<CatalogService>(CatalogService);

      (productRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      (productRepo.create as jest.Mock).mockReturnValue({ ...mockProduct, id: 77 });
      (productRepo.save as jest.Mock).mockImplementation((p) => Promise.resolve(p));
      await wiredService.create(
        { name: 'Wired Food', brand: 'Brand', category: 'Beverages', barcode: '77777777' } as any,
        10,
      );
      expect(mockScoreService.evaluateAndSyncProduct).toHaveBeenCalledWith(
        expect.objectContaining({ id: 77 }),
        expect.objectContaining({ trigger: 'product_create', forceSnapshot: true }),
      );

      (productRepo.findOne as jest.Mock).mockResolvedValueOnce({ ...mockProduct, id: 77 });
      await wiredService.ban(77, 'Recall detected', { id: 99, role: 'admin' });
      expect(mockScoreService.evaluateAndSyncProduct).toHaveBeenCalledWith(
        expect.objectContaining({ id: 77, status: 'banned' }),
        expect.objectContaining({ trigger: 'product_ban', forceSnapshot: true }),
      );

      (productRepo.findOne as jest.Mock).mockResolvedValueOnce({ ...mockProduct, id: 77, status: 'banned' });
      await wiredService.unban(77, { id: 99, role: 'admin' });
      expect(mockScoreService.evaluateAndSyncProduct).toHaveBeenCalledWith(
        expect.objectContaining({ id: 77, status: 'active' }),
        expect.objectContaining({ trigger: 'product_unban', forceSnapshot: true }),
      );

      (productRepo.find as jest.Mock).mockResolvedValue([]);
      const ruleSummary = await wiredService.recalculateAllWithRules([]);
      expect(mockScoreService.recalculateAllScores).toHaveBeenCalledWith('rule_update', []);
      expect(ruleSummary.scoresUpdated).toBe(1);
      expect(ruleSummary.snapshotsRecorded).toBe(1);

      (productRepo.findOne as jest.Mock).mockResolvedValueOnce({ ...mockProduct, id: 77 });
      (productRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      await wiredService.delete(77, { id: 99, role: 'admin' });
      expect(mockSnapshotRepo.delete).toHaveBeenCalledWith({ productId: 77 });
    });
  });

  describe('ban (Feature F01: Admin Regulatory Governance)', () => {
    it('should allow admin to ban a product with valid regulatory reason', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue({ ...mockProduct });
      (productRepo.save as jest.Mock).mockImplementation((prod) => Promise.resolve(prod));

      // Act
      const result = await service.ban(1, 'Detected unlisted allergen peanut protein', {
        id: 99,
        role: 'admin',
      });

      // Assert
      expect(result.status).toBe('banned');
      expect(result.banReason).toBe('Detected unlisted allergen peanut protein');
      expect(result.bannedBy).toBe(99);
      expect(result.bannedAt).toBeDefined();
    });

    it('should throw ForbiddenException when non-admin attempts to ban a product', async () => {
      // Act & Assert
      await expect(
        service.ban(1, 'Contaminated batch', { id: 10, role: 'manufacturer' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when ban reason is missing or too short', async () => {
      // Act & Assert
      await expect(
        service.ban(1, 'bad', { id: 99, role: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unban (Feature F01: Admin Regulatory Governance)', () => {
    it('should allow admin to reinstate a banned product to active status', async () => {
      // Arrange
      const bannedProduct = {
        ...mockProduct,
        status: 'banned' as const,
        banReason: 'Under investigation',
        bannedAt: '2026-11-20T00:00:00.000Z',
        bannedBy: 99,
      };
      (productRepo.findOne as jest.Mock).mockResolvedValue(bannedProduct);
      (productRepo.save as jest.Mock).mockImplementation((prod) => Promise.resolve(prod));

      // Act
      const result = await service.unban(1, { id: 99, role: 'admin' });

      // Assert
      expect(result.status).toBe('active');
      expect(result.banReason).toBeNull();
      expect(result.bannedAt).toBeNull();
      expect(result.bannedBy).toBeNull();
    });

    it('should throw ForbiddenException when non-admin attempts to unban', async () => {
      await expect(
        service.unban(1, { id: 10, role: 'consumer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete (Feature F01: Admin Regulatory Governance)', () => {
    it('should permanently delete product and its ingredients and nutrition facts', async () => {
      // Arrange
      (productRepo.findOne as jest.Mock).mockResolvedValue({ ...mockProduct });
      (ingredientRepo.delete as jest.Mock).mockResolvedValue({ affected: 2 });
      (nutritionRepo.delete as jest.Mock).mockResolvedValue({ affected: 2 });
      (productRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      // Act
      await service.delete(1, { id: 99, role: 'admin' });

      // Assert
      expect(ingredientRepo.delete).toHaveBeenCalledWith({ product: { id: 1 } });
      expect(nutritionRepo.delete).toHaveBeenCalledWith({ product: { id: 1 } });
      expect(productRepo.delete).toHaveBeenCalledWith(1);
    });

    it('should throw ForbiddenException when non-admin attempts to delete product', async () => {
      await expect(
        service.delete(1, { id: 10, role: 'manufacturer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('adminSearchAll (Feature F01: Admin Regulatory Governance)', () => {
    it('should return products with full status counts breakdown', async () => {
      // Arrange
      const mockList = [
        { ...mockProduct, status: 'active' },
        { ...mockProduct, id: 2, status: 'banned' },
        { ...mockProduct, id: 3, status: 'archived' },
      ];
      (productRepo.count as jest.Mock).mockImplementation((opts?: any) => {
        if (opts?.where?.status === 'active') return Promise.resolve(1);
        if (opts?.where?.status === 'archived') return Promise.resolve(1);
        if (opts?.where?.status === 'banned') return Promise.resolve(1);
        return Promise.resolve(3);
      });

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockList, 3]),
      };
      (productRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.adminSearchAll({ status: 'all', page: 1, limit: 10 });

      // Assert
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.statusCounts).toEqual({
        active: 1,
        archived: 1,
        banned: 1,
        total: 3,
      });
    });
  });
});
