import { Test, TestingModule } from '@nestjs/testing';
import { FoodComparisonController } from './food-comparison.controller';
import { FoodComparisonService } from '../services/food-comparison.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import { parseCompareProductIds } from '../models/dto/compare-foods.dto';

describe('FoodComparisonController & CompareFoodsDto (Feature F05 Unit Tests)', () => {
  let controller: FoodComparisonController;
  let comparisonService: jest.Mocked<Partial<FoodComparisonService>>;
  let preferenceService: jest.Mocked<Partial<PreferenceService>>;

  beforeEach(async () => {
    comparisonService = {
      compareFoods: jest.fn().mockResolvedValue({
        comparison: {
          mode: 'empty',
          canCompare: false,
          isCrossCategoryBlocked: false,
          selectedCount: 0,
          activeCategory: null,
          blockedCategories: [],
          validationError: null,
          missingIds: [],
          slots: [],
          categoryQuickFixes: [],
          clearUrl: '/catalog/compare',
          products: [],
          scoreMatrix: [],
          nutritionMatrix: null,
          ingredientMatrix: null,
          allergenMatrix: null,
          certificationMatrix: [],
        },
        pickerGroups: [],
        categories: ['Dairy & Plant Milks'],
        selectedCategoryFilter: '',
      }),
    };

    preferenceService = {
      findByUserId: jest.fn().mockResolvedValue({
        userId: 5,
        allergies: ['Milk'],
        dietaryPreferences: [],
      } as any),
      evaluateProductConflict: jest.fn().mockReturnValue({
        hasConflicts: false,
        hasAllergenConflict: false,
        hasDietaryConflict: false,
        hasNutritionWarning: false,
        conflicts: [],
        matchedAllergies: [],
        dietaryMismatches: [],
        isSafeForUser: true,
        profileConfigured: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoodComparisonController],
      providers: [
        { provide: FoodComparisonService, useValue: comparisonService },
        { provide: PreferenceService, useValue: preferenceService },
      ],
    }).compile();

    controller = module.get<FoodComparisonController>(FoodComparisonController);
  });

  describe('parseCompareProductIds', () => {
    it('parses comma-separated strings, repeated query arrays, deduplicates, and ignores non-positive tokens', () => {
      expect(parseCompareProductIds(undefined)).toEqual([]);
      expect(parseCompareProductIds('1, 2, 1, -5, abc, 0, 3')).toEqual([1, 2, 3]);
      expect(parseCompareProductIds(['4,5', '5', '6'])).toEqual([4, 5, 6]);
    });
  });

  describe('getComparisonPage', () => {
    it('renders comparison bench for anonymous visitor without querying consumer preferences', async () => {
      const req = { session: { user: null } } as any;
      const result = await controller.getComparisonPage({ ids: '1,2', category: 'Beverages' }, req);

      expect(preferenceService.findByUserId).not.toHaveBeenCalled();
      expect(comparisonService.compareFoods).toHaveBeenCalledWith(
        [1, 2],
        expect.objectContaining({
          userProfile: null,
          evaluateConflictFn: undefined,
          pickerCategory: 'Beverages',
        }),
      );
      expect(result.activeNav).toBe('compare');
      expect(result.requestedIdsRaw).toBe('1,2');
      expect(result.title).toContain('Compare Packaged Foods');
    });

    it('loads F16 dietary profile and passes evaluateConflictFn for authenticated consumers', async () => {
      const req = { session: { user: { id: 5, role: 'consumer' } } } as any;
      const result = await controller.getComparisonPage({ ids: ['10', '20'] }, req);

      expect(preferenceService.findByUserId).toHaveBeenCalledWith(5);
      expect(comparisonService.compareFoods).toHaveBeenCalledWith(
        [10, 20],
        expect.objectContaining({
          userProfile: expect.objectContaining({ userId: 5 }),
          evaluateConflictFn: expect.any(Function),
        }),
      );
      expect(result.userProfile).toMatchObject({ userId: 5 });
    });
  });
});
