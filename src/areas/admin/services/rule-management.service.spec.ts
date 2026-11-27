import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RuleManagementService } from './rule-management.service';
import { FoodRule } from '../models/food-rule.entity';
import { CatalogService } from '../../food-catalog/services/catalog.service';

describe('RuleManagementService (Feature F03 Unit Tests)', () => {
  let service: RuleManagementService;
  let foodRuleRepo: any;
  let catalogService: any;

  const mockRule: FoodRule = {
    id: 1,
    name: 'Caramel Color (E150d)',
    pattern: 'caramel color, e150d',
    ruleType: 'additive',
    additiveCode: 'E150d',
    allergenType: null,
    categoryScope: null,
    hazardLevel: 'caution',
    fdaStatus: 'FDA Color Additive Exempt',
    euStatus: 'EFSA Evaluated (E150d)',
    explanation: 'Sulfite ammonia caramel colorant.',
    source: 'EFSA / FDA',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRecalculation = {
    productsEvaluated: 5,
    productsUpdated: 2,
    ingredientsEvaluated: 18,
    ingredientsUpdated: 3,
    matchedCount: 16,
    unknownCount: 2,
  };

  beforeEach(async () => {
    foodRuleRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockRule]),
      create: jest.fn((dto) => ({ id: 2, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 2, ...entity })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(1),
      createQueryBuilder: jest.fn(),
    };

    catalogService = {
      recalculateAllWithRules: jest.fn().mockResolvedValue(mockRecalculation),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleManagementService,
        { provide: getRepositoryToken(FoodRule), useValue: foodRuleRepo },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    service = module.get<RuleManagementService>(RuleManagementService);
  });

  describe('searchRules', () => {
    it('should query database with filters and return paginated rule results with stats', async () => {
      // Arrange
      const listQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockRule], 1]),
      };
      const statsQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { isActive: true, hazardLevel: 'caution', ruleType: 'additive', cnt: '1' },
        ]),
      };

      let callCount = 0;
      foodRuleRepo.createQueryBuilder.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? listQb : statsQb;
      });

      // Act
      const result = await service.searchRules({
        q: 'E150d',
        type: 'additive',
        hazardLevel: 'caution',
        categoryScope: 'global',
        status: 'active',
        page: 1,
        limit: 10,
      });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.stats.total).toBe(1);
      expect(result.stats.caution).toBe(1);
      expect(listQb.andWhere).toHaveBeenCalledTimes(5);
      expect(listQb.skip).toHaveBeenCalledWith(0);
      expect(listQb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findById', () => {
    it('should return rule when found and throw NotFoundException when missing', async () => {
      // Arrange
      foodRuleRepo.findOne.mockResolvedValueOnce(mockRule).mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.findById(1)).resolves.toEqual(mockRule);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRule', () => {
    it('should persist new FoodRule and trigger catalog recalculation', async () => {
      // Arrange
      foodRuleRepo.findOne.mockResolvedValue(null);
      const dto = {
        name: 'Exotic Berry Flavor',
        pattern: 'exotic berry flavor, exotic berry',
        ruleType: 'ingredient' as const,
        hazardLevel: 'safe' as const,
        explanation: 'Natural fruit flavoring extract.',
        isActive: true,
      };

      // Act
      const res = await service.createRule(dto);

      // Assert
      expect(res.rule.name).toBe('Exotic Berry Flavor');
      expect(res.recalculation).toEqual(mockRecalculation);
      expect(foodRuleRepo.save).toHaveBeenCalled();
      expect(catalogService.recalculateAllWithRules).toHaveBeenCalled();
    });

    it('should throw ConflictException when duplicate rule name exists for same categoryScope', async () => {
      // Arrange
      foodRuleRepo.findOne.mockResolvedValue({ ...mockRule, categoryScope: null });

      // Act & Assert
      await expect(
        service.createRule({
          name: 'Caramel Color (E150d)',
          pattern: 'e150d',
          ruleType: 'additive',
          hazardLevel: 'caution',
          explanation: 'Duplicate',
        }),
      ).rejects.toThrow(ConflictException);
      expect(catalogService.recalculateAllWithRules).not.toHaveBeenCalled();
    });
  });

  describe('updateRule', () => {
    it('should update rule attributes and trigger catalog recalculation', async () => {
      // Arrange
      foodRuleRepo.findOne.mockResolvedValue({ ...mockRule });

      // Act
      const res = await service.updateRule(1, {
        hazardLevel: 'warning',
        isActive: false,
        explanation: 'Updated regulatory restriction.',
      });

      // Assert
      expect(res.rule.hazardLevel).toBe('warning');
      expect(res.rule.isActive).toBe(false);
      expect(catalogService.recalculateAllWithRules).toHaveBeenCalled();
    });
  });

  describe('toggleRuleActive', () => {
    it('should invert isActive flag and recalculate catalog products', async () => {
      // Arrange
      foodRuleRepo.findOne.mockResolvedValue({ ...mockRule, isActive: true });

      // Act
      const res = await service.toggleRuleActive(1);

      // Assert
      expect(res.rule.isActive).toBe(false);
      expect(catalogService.recalculateAllWithRules).toHaveBeenCalled();
    });
  });

  describe('deleteRule & triggerFullRecalculation', () => {
    it('should delete rule and trigger full catalog recalculation', async () => {
      // Arrange
      foodRuleRepo.findOne.mockResolvedValue(mockRule);

      // Act
      const res = await service.deleteRule(1);

      // Assert
      expect(foodRuleRepo.delete).toHaveBeenCalledWith(1);
      expect(catalogService.recalculateAllWithRules).toHaveBeenCalled();
      expect(res.recalculation).toEqual(mockRecalculation);
    });

    it('should trigger full catalog recalculation manually', async () => {
      // Arrange & Act
      const summary = await service.triggerFullRecalculation();

      // Assert
      expect(foodRuleRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
      expect(catalogService.recalculateAllWithRules).toHaveBeenCalledWith([mockRule]);
      expect(summary).toEqual(mockRecalculation);
    });
  });
});
