import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminScoringController } from './admin-scoring.controller';
import { FoodScoreService } from '../../food-catalog/services/food-score.service';
import { CatalogService } from '../../food-catalog/services/catalog.service';

describe('AdminScoringController (Feature F04 Unit Tests)', () => {
  let controller: AdminScoringController;
  let foodScoreService: jest.Mocked<Partial<FoodScoreService>>;
  let catalogService: jest.Mocked<Partial<CatalogService>>;

  const mockConfig = {
    id: 1,
    configKey: 'default',
    ingredientWeight: 35,
    nutritionWeight: 30,
    verificationWeight: 15,
    recallWeight: 10,
    communityWeight: 10,
    notes: 'Default 5-component weights',
  };

  beforeEach(async () => {
    foodScoreService = {
      getActiveConfig: jest.fn().mockResolvedValue(mockConfig as any),
      getCatalogTierStats: jest.fn().mockResolvedValue({
        total: 10,
        averageScore: 76.5,
        tier1: 4,
        tier2: 4,
        tier3: 2,
        snapshotCount: 15,
      }),
      evaluateProduct: jest.fn().mockResolvedValue({
        totalScore: 88,
        tierNumber: 1,
        isProvisional: true,
        components: [],
      } as any),
      updateWeights: jest.fn(),
      recalculateAllScores: jest.fn(),
    };

    catalogService = {
      searchAndFilter: jest.fn().mockResolvedValue({
        items: [{ id: 1, name: 'Barista Oat Drink', brand: 'Oatly' } as any],
        total: 1,
        page: 1,
        totalPages: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminScoringController],
      providers: [
        { provide: FoodScoreService, useValue: foodScoreService },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    controller = module.get<AdminScoringController>(AdminScoringController);
  });

  describe('getScoringConsole', () => {
    it('returns config, tier telemetry, weight total 100, and live sample breakdowns', async () => {
      const req = { session: { user: { id: 1, role: 'admin' } } } as any;
      const vm = await controller.getScoringConsole(req, encodeURIComponent('Saved weights'));

      expect(vm.activeNav).toBe('scoring');
      expect(vm.totalWeight).toBe(100);
      expect(vm.tierStats.averageScore).toBe(76.5);
      expect(vm.sampleBreakdowns).toHaveLength(1);
      expect(vm.success).toBe('Saved weights');
    });
  });

  describe('handleUpdateWeights', () => {
    it('updates weights via FoodScoreService and redirects with recalculation summary', async () => {
      (foodScoreService.updateWeights as jest.Mock).mockResolvedValue({
        config: {
          ingredientWeight: 40,
          nutritionWeight: 25,
          verificationWeight: 15,
          recallWeight: 10,
          communityWeight: 10,
        },
        recalculation: {
          productsEvaluated: 10,
          productsUpdated: 6,
          snapshotsRecorded: 10,
          tierCounts: { tier1: 4, tier2: 4, tier3: 2 },
        },
      });

      const dto = {
        ingredientWeight: 40,
        nutritionWeight: 25,
        verificationWeight: 15,
        recallWeight: 10,
        communityWeight: 10,
        notes: 'Shift +5% toward ingredients',
      };
      const req = { session: { user: { id: 99, role: 'admin' } } } as any;
      const res = { redirect: jest.fn() } as any;

      await controller.handleUpdateWeights(dto, req, res);

      expect(foodScoreService.updateWeights).toHaveBeenCalledWith(dto, req.session.user);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/admin/scoring?success='),
      );
    });

    it('redirects back with error message when weight total validation fails', async () => {
      (foodScoreService.updateWeights as jest.Mock).mockRejectedValue(
        new BadRequestException('Scoring weights must sum to exactly 100% (received 105%).'),
      );

      const dto = {
        ingredientWeight: 40,
        nutritionWeight: 30,
        verificationWeight: 15,
        recallWeight: 10,
        communityWeight: 10,
      };
      const req = { session: { user: { id: 99, role: 'admin' } } } as any;
      const res = { redirect: jest.fn() } as any;

      await controller.handleUpdateWeights(dto, req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/admin/scoring?error='),
      );
      expect(decodeURIComponent(res.redirect.mock.calls[0][0])).toContain('105%');
    });
  });

  describe('handleManualRecalculate', () => {
    it('recalculates all catalog scores and redirects with summary', async () => {
      (foodScoreService.recalculateAllScores as jest.Mock).mockResolvedValue({
        productsEvaluated: 12,
        productsUpdated: 3,
        snapshotsRecorded: 4,
        tierCounts: { tier1: 5, tier2: 4, tier3: 3 },
      });

      const res = { redirect: jest.fn() } as any;
      await controller.handleManualRecalculate(res);

      expect(foodScoreService.recalculateAllScores).toHaveBeenCalledWith('manual');
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/admin/scoring?success='),
      );
    });
  });
});
