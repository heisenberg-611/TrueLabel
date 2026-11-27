import { Test, TestingModule } from '@nestjs/testing';
import { AdminRulesController } from './admin-rules.controller';
import { RuleManagementService } from '../services/rule-management.service';
import { CatalogService } from '../../food-catalog/services/catalog.service';

describe('AdminRulesController (Feature F03 Unit Tests)', () => {
  let controller: AdminRulesController;
  let ruleManagementService: jest.Mocked<Partial<RuleManagementService>>;
  let catalogService: jest.Mocked<Partial<CatalogService>>;

  const mockSummary = {
    productsEvaluated: 6,
    productsUpdated: 2,
    ingredientsEvaluated: 24,
    ingredientsUpdated: 4,
    matchedCount: 22,
    unknownCount: 2,
  };

  beforeEach(async () => {
    ruleManagementService = {
      searchRules: jest.fn().mockResolvedValue({
        items: [{ id: 1, name: 'Caramel Color', ruleType: 'additive', hazardLevel: 'caution' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        stats: { total: 1, active: 1, inactive: 0, safe: 0, caution: 1, warning: 0, allergens: 0 },
      } as any),
      createRule: jest.fn().mockResolvedValue({
        rule: { id: 2, name: 'Exotic Berry' } as any,
        recalculation: mockSummary,
      }),
      updateRule: jest.fn().mockResolvedValue({
        rule: { id: 1, name: 'Caramel Color' } as any,
        recalculation: mockSummary,
      }),
      toggleRuleActive: jest.fn().mockResolvedValue({
        rule: { id: 1, name: 'Caramel Color', isActive: false } as any,
        recalculation: mockSummary,
      }),
      deleteRule: jest.fn().mockResolvedValue({ recalculation: mockSummary }),
      triggerFullRecalculation: jest.fn().mockResolvedValue(mockSummary),
    };

    catalogService = {
      getFilterOptions: jest.fn().mockResolvedValue({
        categories: ['Beverages', 'Dairy & Plant Milks'],
        dietaryTags: ['Vegan'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRulesController],
      providers: [
        { provide: RuleManagementService, useValue: ruleManagementService },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    controller = module.get<AdminRulesController>(AdminRulesController);
  });

  describe('getRulesRegistry', () => {
    it('should return paginated food rules view model for admin console', async () => {
      // Arrange
      const mockReq = { session: { user: { id: 1, role: 'admin' } } } as any;

      // Act
      const vm = await controller.getRulesRegistry(
        { q: 'caramel', page: 1 },
        mockReq,
        encodeURIComponent('Saved'),
      );

      // Assert
      expect(vm.activeNav).toBe('rules');
      expect(vm.rules).toHaveLength(1);
      expect(vm.total).toBe(1);
      expect(vm.categories).toContain('Beverages');
      expect(vm.success).toBe('Saved');
      expect(ruleManagementService.searchRules).toHaveBeenCalledWith({ q: 'caramel', page: 1 });
    });
  });

  describe('Rule mutation & recalculation handlers', () => {
    it('handleCreateRule should create rule and redirect with recalculation summary', async () => {
      // Arrange
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleCreateRule({ name: 'Exotic Berry' } as any, mockRes);

      // Assert
      expect(ruleManagementService.createRule).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/admin/rules?success='),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('Recalculated'),
      );
    });

    it('handleCreateRule should redirect with error message if service throws', async () => {
      // Arrange
      (ruleManagementService.createRule as jest.Mock).mockRejectedValue(
        new Error('Duplicate rule exists'),
      );
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleCreateRule({ name: 'Dup' } as any, mockRes);

      // Assert
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/admin/rules?error=Duplicate%20rule%20exists'),
      );
    });

    it('handleUpdateRule should update rule and redirect with success summary', async () => {
      // Arrange
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleUpdateRule(1, { name: 'Caramel Color' } as any, mockRes);

      // Assert
      expect(ruleManagementService.updateRule).toHaveBeenCalledWith(1, { name: 'Caramel Color' });
      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('/admin/rules?success='));
    });

    it('handleToggleRule should toggle rule active status and redirect', async () => {
      // Arrange
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleToggleRule(1, mockRes);

      // Assert
      expect(ruleManagementService.toggleRuleActive).toHaveBeenCalledWith(1);
      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('deactivated'));
    });

    it('handleDeleteRule should delete rule and redirect with recalculation feedback', async () => {
      // Arrange
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleDeleteRule(1, mockRes);

      // Assert
      expect(ruleManagementService.deleteRule).toHaveBeenCalledWith(1);
      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('Rule%20%231%20deleted'));
    });

    it('handleManualRecalculate should trigger full catalog re-evaluation and redirect', async () => {
      // Arrange
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleManualRecalculate(mockRes);

      // Assert
      expect(ruleManagementService.triggerFullRecalculation).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('22%20matched%20and%202%20unclassified'),
      );
    });
  });
});
