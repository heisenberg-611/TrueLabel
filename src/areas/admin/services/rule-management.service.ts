import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoodRule } from '../models/food-rule.entity';
import { CreateFoodRuleDto } from '../models/dto/create-food-rule.dto';
import { SearchFoodRuleDto } from '../models/dto/search-food-rule.dto';
import {
  CatalogService,
  RuleRecalculationSummary,
} from '../../food-catalog/services/catalog.service';

export interface FoodRuleStats {
  total: number;
  active: number;
  inactive: number;
  safe: number;
  caution: number;
  warning: number;
  allergens: number;
}

export interface PaginatedFoodRulesResult {
  items: FoodRule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  stats: FoodRuleStats;
}

/**
 * Feature F03: Administrative Food Rule Base Service
 * Handles DB-level paginated queries, rule CRUD, and automatic catalog recalculation triggers.
 */
@Injectable()
export class RuleManagementService {
  constructor(
    @InjectRepository(FoodRule)
    private readonly foodRuleRepo: Repository<FoodRule>,
    private readonly catalogService: CatalogService,
  ) {}

  /**
   * DB-level paginated search and filtering across administrative food rules.
   */
  async searchRules(dto: SearchFoodRuleDto = {}): Promise<PaginatedFoodRulesResult> {
    const page = Math.max(1, Number(dto.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(dto.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.foodRuleRepo.createQueryBuilder('rule');

    if (dto.status === 'active') {
      qb.andWhere('rule.isActive = :isActive', { isActive: true });
    } else if (dto.status === 'inactive') {
      qb.andWhere('rule.isActive = :isActive', { isActive: false });
    }

    if (dto.type && dto.type !== 'all') {
      qb.andWhere('rule.ruleType = :ruleType', { ruleType: dto.type });
    }

    if (dto.hazardLevel && dto.hazardLevel !== 'all') {
      qb.andWhere('rule.hazardLevel = :hazardLevel', {
        hazardLevel: dto.hazardLevel,
      });
    }

    if (dto.categoryScope && dto.categoryScope !== 'all') {
      if (dto.categoryScope === 'global') {
        qb.andWhere('(rule.categoryScope IS NULL OR rule.categoryScope = :emptyScope)', {
          emptyScope: '',
        });
      } else {
        qb.andWhere('LOWER(rule.categoryScope) = :scope', {
          scope: dto.categoryScope.trim().toLowerCase(),
        });
      }
    }

    if (dto.q && dto.q.trim()) {
      const q = `%${dto.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(rule.name) LIKE :q OR LOWER(rule.pattern) LIKE :q OR LOWER(COALESCE(rule.additiveCode, \'\')) LIKE :q OR LOWER(COALESCE(rule.allergenType, \'\')) LIKE :q OR LOWER(rule.source) LIKE :q)',
        { q },
      );
    }

    qb.orderBy('rule.isActive', 'DESC')
      .addOrderBy('rule.hazardLevel', 'DESC')
      .addOrderBy('rule.id', 'DESC')
      .skip(skip)
      .take(limit);

    const [[items, total], stats] = await Promise.all([
      qb.getManyAndCount(),
      this.getQuickStats(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      stats,
    };
  }

  /**
   * Lightweight aggregate stats for Admin Command Center & Rule Console.
   */
  async getQuickStats(): Promise<FoodRuleStats> {
    try {
      if (typeof this.foodRuleRepo.createQueryBuilder === 'function') {
        const qb = this.foodRuleRepo.createQueryBuilder('rule');
        if (typeof qb.getRawMany === 'function') {
          const rows = await qb
            .select('rule.isActive', 'isActive')
            .addSelect('rule.hazardLevel', 'hazardLevel')
            .addSelect('rule.ruleType', 'ruleType')
            .addSelect('COUNT(*)', 'cnt')
            .groupBy('rule.isActive')
            .addGroupBy('rule.hazardLevel')
            .addGroupBy('rule.ruleType')
            .getRawMany();

          if (Array.isArray(rows) && rows.length > 0) {
            let total = 0;
            let active = 0;
            let inactive = 0;
            let safe = 0;
            let caution = 0;
            let warning = 0;
            let allergens = 0;

            for (const row of rows) {
              const count = parseInt(row.cnt, 10) || 0;
              total += count;
              const rowActive =
                row.isActive === true ||
                row.isActive === 1 ||
                row.isActive === '1' ||
                row.isActive === 'true';
              if (rowActive) active += count;
              else inactive += count;

              if (row.hazardLevel === 'safe') safe += count;
              else if (row.hazardLevel === 'caution') caution += count;
              else if (row.hazardLevel === 'warning') warning += count;

              if (row.ruleType === 'allergen') allergens += count;
            }

            return { total, active, inactive, safe, caution, warning, allergens };
          }
        }
      }
    } catch {
      // Fallback for mocked Jest environments
    }

    const [total, active, safe, caution, warning, allergens] = await Promise.all([
      this.foodRuleRepo.count(),
      this.foodRuleRepo.count({ where: { isActive: true } }),
      this.foodRuleRepo.count({ where: { hazardLevel: 'safe' } }),
      this.foodRuleRepo.count({ where: { hazardLevel: 'caution' } }),
      this.foodRuleRepo.count({ where: { hazardLevel: 'warning' } }),
      this.foodRuleRepo.count({ where: { ruleType: 'allergen' } }),
    ]);

    return {
      total,
      active,
      inactive: Math.max(0, total - active),
      safe,
      caution,
      warning,
      allergens,
    };
  }

  async findById(id: number): Promise<FoodRule> {
    const rule = await this.foodRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Food rule with ID #${id} not found`);
    }
    return rule;
  }

  async getActiveRules(): Promise<FoodRule[]> {
    return this.foodRuleRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Create a new FoodRule and automatically trigger catalog recalculation (F03).
   */
  async createRule(dto: CreateFoodRuleDto): Promise<{
    rule: FoodRule;
    recalculation: RuleRecalculationSummary;
  }> {
    const cleanName = dto.name.trim();
    const cleanScope = dto.categoryScope?.trim() || null;

    const existing = await this.foodRuleRepo.findOne({
      where: { name: cleanName },
    });
    if (
      existing &&
      (existing.categoryScope || null) === cleanScope
    ) {
      throw new ConflictException(
        `A food rule named "${cleanName}" already exists for ${cleanScope || 'global scope'}.`,
      );
    }

    const rule = this.foodRuleRepo.create({
      name: cleanName,
      pattern: dto.pattern.trim(),
      ruleType: dto.ruleType,
      additiveCode: dto.additiveCode?.trim() || null,
      allergenType: dto.allergenType?.trim() || null,
      categoryScope: cleanScope,
      hazardLevel: dto.hazardLevel,
      fdaStatus: dto.fdaStatus?.trim() || null,
      euStatus: dto.euStatus?.trim() || null,
      explanation: dto.explanation.trim(),
      source: dto.source?.trim() || 'TrueLabel Regulatory Rule Base',
      isActive: dto.isActive ?? true,
    });

    const saved = await this.foodRuleRepo.save(rule);
    const activeRules = await this.getActiveRules();
    const recalculation =
      await this.catalogService.recalculateAllWithRules(activeRules);

    return { rule: saved, recalculation };
  }

  /**
   * Update an existing FoodRule and automatically trigger catalog recalculation (F03).
   */
  async updateRule(
    id: number,
    dto: Partial<CreateFoodRuleDto>,
  ): Promise<{
    rule: FoodRule;
    recalculation: RuleRecalculationSummary;
  }> {
    const rule = await this.findById(id);

    const nextName = dto.name !== undefined ? dto.name.trim() : rule.name;
    const nextScope =
      dto.categoryScope !== undefined
        ? dto.categoryScope?.trim() || null
        : rule.categoryScope;

    if (nextName !== rule.name || nextScope !== rule.categoryScope) {
      const collision = await this.foodRuleRepo.findOne({
        where: { name: nextName },
      });
      if (
        collision &&
        collision.id !== id &&
        (collision.categoryScope || null) === nextScope
      ) {
        throw new ConflictException(
          `Another rule named "${nextName}" already exists for ${nextScope || 'global scope'}.`,
        );
      }
    }

    rule.name = nextName;
    if (dto.pattern !== undefined) rule.pattern = dto.pattern.trim();
    if (dto.ruleType !== undefined) rule.ruleType = dto.ruleType;
    if (dto.additiveCode !== undefined)
      rule.additiveCode = dto.additiveCode?.trim() || null;
    if (dto.allergenType !== undefined)
      rule.allergenType = dto.allergenType?.trim() || null;
    rule.categoryScope = nextScope;
    if (dto.hazardLevel !== undefined) rule.hazardLevel = dto.hazardLevel;
    if (dto.fdaStatus !== undefined)
      rule.fdaStatus = dto.fdaStatus?.trim() || null;
    if (dto.euStatus !== undefined)
      rule.euStatus = dto.euStatus?.trim() || null;
    if (dto.explanation !== undefined) rule.explanation = dto.explanation.trim();
    if (dto.source !== undefined)
      rule.source = dto.source?.trim() || 'TrueLabel Regulatory Rule Base';
    if (dto.isActive !== undefined) rule.isActive = Boolean(dto.isActive);

    const saved = await this.foodRuleRepo.save(rule);
    const activeRules = await this.getActiveRules();
    const recalculation =
      await this.catalogService.recalculateAllWithRules(activeRules);

    return { rule: saved, recalculation };
  }

  /**
   * Toggle rule active status and trigger catalog recalculation (F03).
   */
  async toggleRuleActive(id: number): Promise<{
    rule: FoodRule;
    recalculation: RuleRecalculationSummary;
  }> {
    const rule = await this.findById(id);
    rule.isActive = !rule.isActive;
    const saved = await this.foodRuleRepo.save(rule);
    const activeRules = await this.getActiveRules();
    const recalculation =
      await this.catalogService.recalculateAllWithRules(activeRules);

    return { rule: saved, recalculation };
  }

  /**
   * Delete a FoodRule and trigger catalog recalculation (F03).
   */
  async deleteRule(id: number): Promise<{
    recalculation: RuleRecalculationSummary;
  }> {
    await this.findById(id);
    await this.foodRuleRepo.delete(id);
    const activeRules = await this.getActiveRules();
    const recalculation =
      await this.catalogService.recalculateAllWithRules(activeRules);

    return { recalculation };
  }

  /**
   * Manually trigger full catalog re-evaluation against active FoodRule records.
   */
  async triggerFullRecalculation(): Promise<RuleRecalculationSummary> {
    const activeRules = await this.getActiveRules();
    return this.catalogService.recalculateAllWithRules(activeRules);
  }
}
