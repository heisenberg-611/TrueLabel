import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoodProduct } from '../models/food-product.entity';
import { Ingredient } from '../models/ingredient.entity';
import { NutritionFact } from '../models/nutrition-fact.entity';
import { CreateFoodProductDto } from '../models/dto/create-food-product.dto';
import { SearchFoodProductDto } from '../models/dto/search-food-product.dto';
import { FoodRule } from '../../admin/models/food-rule.entity';
import {
  AnalyzedIngredientResult,
  IngredientAnalysisReport,
  IngredientAnalyzerService,
} from './ingredient-analyzer.service';

export interface RuleRecalculationSummary {
  productsEvaluated: number;
  productsUpdated: number;
  ingredientsEvaluated: number;
  ingredientsUpdated: number;
  matchedCount: number;
  unknownCount: number;
}

@Injectable()
export class CatalogService {
  private _fallbackAnalyzer?: IngredientAnalyzerService;

  constructor(
    @InjectRepository(FoodProduct)
    private readonly productRepo: Repository<FoodProduct>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(NutritionFact)
    private readonly nutritionRepo: Repository<NutritionFact>,
    @Optional()
    @InjectRepository(FoodRule)
    private readonly foodRuleRepo?: Repository<FoodRule>,
    @Optional()
    private readonly ingredientAnalyzer?: IngredientAnalyzerService,
  ) {}

  private get analyzer(): IngredientAnalyzerService {
    if (this.ingredientAnalyzer) return this.ingredientAnalyzer;
    if (!this._fallbackAnalyzer) {
      this._fallbackAnalyzer = new IngredientAnalyzerService();
    }
    return this._fallbackAnalyzer;
  }

  /**
   * Fetch all active administrative food rules for F03 analysis.
   */
  async getActiveRules(): Promise<FoodRule[]> {
    if (!this.foodRuleRepo) return [];
    return this.foodRuleRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Search and filter food catalog (Feature F01)
   * Only active products are visible in discovery.
   */
  async searchAndFilter(dto: SearchFoodProductDto): Promise<{
    items: FoodProduct[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.max(1, Math.min(50, dto.limit || 12));
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.ingredients', 'ingredients')
      .leftJoinAndSelect('product.nutritionFacts', 'nutritionFacts');

    if (dto.status && dto.status !== 'all') {
      queryBuilder.where('product.status = :status', { status: dto.status });
    } else if (dto.status === 'all') {
      // Include all lifecycle statuses (active, archived, banned)
    } else {
      // Default to active for regular consumer discovery
      queryBuilder.where('product.status = :status', { status: 'active' });
    }

    if (dto.q && dto.q.trim()) {
      const q = `%${dto.q.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE :q OR LOWER(product.brand) LIKE :q OR product.barcode LIKE :barcodeQ)',
        { q, barcodeQ: `%${dto.q.trim()}%` },
      );
    }

    if (dto.category && dto.category.trim()) {
      const cat = `%${dto.category.trim().toLowerCase()}%`;
      queryBuilder.andWhere('LOWER(product.category) LIKE :cat', { cat });
    }

    if (dto.tag && dto.tag.trim()) {
      const tagLower = `%${dto.tag.trim().toLowerCase()}%`;
      queryBuilder.andWhere('LOWER(product.dietaryTags) LIKE :tag', { tag: tagLower });
    }

    if (dto.minScore) {
      queryBuilder.andWhere('product.qualityScore >= :minScore', {
        minScore: dto.minScore,
      });
    }

    queryBuilder.orderBy('product.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find product by exact barcode (Feature F01)
   */
  async findByBarcode(barcode: string): Promise<FoodProduct | null> {
    const cleanBarcode = barcode.trim();
    return this.productRepo.findOne({
      where: { barcode: cleanBarcode },
      relations: ['ingredients', 'nutritionFacts'],
    });
  }

  /**
   * Find product by ID with full details (Feature F01)
   */
  async findById(id: number): Promise<FoodProduct> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['ingredients', 'nutritionFacts'],
    });

    if (!product) {
      throw new NotFoundException(`Food product with ID ${id} not found`);
    }

    return product;
  }

  /**
   * Compute F03 rule-based ingredient, additive, and allergen breakdown for a product.
   */
  async analyzeProductIngredients(
    product: FoodProduct,
  ): Promise<IngredientAnalysisReport> {
    const activeRules = await this.getActiveRules();
    return this.analyzer.buildProductAnalysisReport(
      product.ingredients || [],
      activeRules,
      product.category,
    );
  }

  /**
   * Create a new food product (Feature F01 + Feature F03 rule analysis)
   * Enforces barcode uniqueness across the catalog and evaluates ingredients against FoodRule base.
   */
  async create(
    dto: CreateFoodProductDto,
    manufacturerId: number,
  ): Promise<FoodProduct> {
    const cleanBarcode = dto.barcode.trim();
    const existing = await this.productRepo.findOne({
      where: { barcode: cleanBarcode },
    });

    if (existing) {
      throw new ConflictException(
        `A food product with barcode "${cleanBarcode}" already exists in the catalog`,
      );
    }

    const activeRules = await this.getActiveRules();
    const analyzedIngredients =
      dto.ingredients && dto.ingredients.length > 0
        ? this.analyzer.analyzeDeclaredIngredients(
            dto.ingredients,
            activeRules,
            dto.category,
          )
        : [];

    // Provisional baseline score incorporating F03 rule classifications and unknown penalty (refined in F04)
    const baselineScore = this.computeProvisionalScoreFromAnalysis(
      analyzedIngredients,
      activeRules.length > 0,
    );

    const product = this.productRepo.create({
      name: dto.name.trim(),
      brand: dto.brand.trim(),
      category: dto.category.trim(),
      barcode: cleanBarcode,
      imageUrl: dto.imageUrl || '/images/default-food.png',
      description: dto.description?.trim(),
      servingSize: dto.servingSize || 100,
      servingUnit: dto.servingUnit || 'g',
      status: 'active',
      qualityScore: baselineScore,
      manufacturerId,
      dietaryTags: dto.dietaryTags || [],
    });

    const savedProduct = await this.productRepo.save(product);

    if (analyzedIngredients.length > 0) {
      const ingredients = analyzedIngredients.map((i) =>
        this.ingredientRepo.create({
          name: i.name,
          isAllergen: i.isAllergen,
          allergenType: i.allergenType || (null as any),
          additiveCode: i.additiveCode || (null as any),
          hazardLevel: i.hazardLevel,
          explanation: i.explanation,
          analysisStatus: i.analysisStatus,
          matchedRuleId: i.matchedRuleId,
          ruleSource: i.ruleSource,
          fdaStatus: i.fdaStatus,
          euStatus: i.euStatus,
          product: savedProduct,
        }),
      );
      savedProduct.ingredients = await this.ingredientRepo.save(ingredients);
    }

    if (dto.nutritionFacts && dto.nutritionFacts.length > 0) {
      const facts = dto.nutritionFacts.map((n) =>
        this.nutritionRepo.create({
          ...n,
          product: savedProduct,
        }),
      );
      savedProduct.nutritionFacts = await this.nutritionRepo.save(facts);
    }

    return savedProduct;
  }

  /**
   * Update food product (Feature F01 + Feature F03 rule re-evaluation)
   * Manufacturers can edit ONLY their own products. Admins can edit any.
   */
  async update(
    id: number,
    dto: Partial<CreateFoodProductDto>,
    user: { id: number; role: string },
  ): Promise<FoodProduct> {
    const product = await this.findById(id);

    if (user.role === 'manufacturer' && product.manufacturerId !== user.id) {
      throw new ForbiddenException(
        'Manufacturers are only permitted to edit their own food products',
      );
    }

    if (dto.barcode && dto.barcode.trim() !== product.barcode) {
      const collision = await this.productRepo.findOne({
        where: { barcode: dto.barcode.trim() },
      });
      if (collision && collision.id !== id) {
        throw new ConflictException(
          `Barcode "${dto.barcode.trim()}" is already assigned to another food`,
        );
      }
      product.barcode = dto.barcode.trim();
    }

    const previousCategory = product.category;
    if (dto.name) product.name = dto.name.trim();
    if (dto.brand) product.brand = dto.brand.trim();
    if (dto.category) product.category = dto.category.trim();
    if (dto.description !== undefined) product.description = dto.description?.trim();
    if (dto.imageUrl) product.imageUrl = dto.imageUrl;
    if (dto.servingSize) product.servingSize = dto.servingSize;
    if (dto.servingUnit) product.servingUnit = dto.servingUnit;
    if (dto.dietaryTags) product.dietaryTags = dto.dietaryTags;

    const categoryChanged = Boolean(
      dto.category && dto.category.trim() !== previousCategory,
    );

    const saved = await this.productRepo.save(product);

    if (dto.ingredients) {
      const activeRules = await this.getActiveRules();
      const analyzedIngredients = this.analyzer.analyzeDeclaredIngredients(
        dto.ingredients,
        activeRules,
        product.category,
      );

      await this.ingredientRepo.delete({ product: { id } });
      const entities = analyzedIngredients.map((i) =>
        this.ingredientRepo.create({
          name: i.name,
          isAllergen: i.isAllergen,
          allergenType: i.allergenType || (null as any),
          additiveCode: i.additiveCode || (null as any),
          hazardLevel: i.hazardLevel,
          explanation: i.explanation,
          analysisStatus: i.analysisStatus,
          matchedRuleId: i.matchedRuleId,
          ruleSource: i.ruleSource,
          fdaStatus: i.fdaStatus,
          euStatus: i.euStatus,
          product: saved,
        }),
      );
      saved.ingredients = await this.ingredientRepo.save(entities);

      if (saved.status !== 'banned' && analyzedIngredients.length > 0) {
        saved.qualityScore = this.computeProvisionalScoreFromAnalysis(
          analyzedIngredients,
          activeRules.length > 0,
        );
        await this.productRepo.save(saved);
      }
    } else if (categoryChanged && product.ingredients && product.ingredients.length > 0) {
      const activeRules = await this.getActiveRules();
      if (activeRules.length > 0) {
        const analyzed = this.analyzer.analyzeDeclaredIngredients(
          product.ingredients,
          activeRules,
          product.category,
        );
        await this.applyAnalyzedToPersistedIngredients(
          product.ingredients,
          analyzed,
        );
      }
    }

    if (dto.nutritionFacts) {
      await this.nutritionRepo.delete({ product: { id } });
      const entities = dto.nutritionFacts.map((n) =>
        this.nutritionRepo.create({
          ...n,
          product: saved,
        }),
      );
      saved.nutritionFacts = await this.nutritionRepo.save(entities);
    }

    return saved;
  }

  /**
   * Feature F03: Trigger rule-base recalculation across all catalog products & ingredients
   * whenever an administrator creates, modifies, toggles, or deletes a FoodRule.
   */
  async recalculateAllWithRules(
    suppliedRules?: FoodRule[],
  ): Promise<RuleRecalculationSummary> {
    const activeRules = suppliedRules ?? (await this.getActiveRules());
    const products = await this.productRepo.find({
      relations: ['ingredients'],
    });

    let productsUpdated = 0;
    let ingredientsEvaluated = 0;
    let ingredientsUpdated = 0;
    let matchedCount = 0;
    let unknownCount = 0;

    for (const product of products) {
      const existingIngredients = product.ingredients || [];
      if (existingIngredients.length === 0) continue;

      ingredientsEvaluated += existingIngredients.length;
      const analyzed = this.analyzer.analyzeDeclaredIngredients(
        existingIngredients,
        activeRules,
        product.category,
      );

      matchedCount += analyzed.filter((a) => a.analysisStatus === 'matched').length;
      unknownCount += analyzed.filter((a) => a.analysisStatus === 'unknown').length;

      const changedCount = await this.applyAnalyzedToPersistedIngredients(
        existingIngredients,
        analyzed,
      );
      if (changedCount > 0) {
        ingredientsUpdated += changedCount;
        productsUpdated++;
      }
    }

    return {
      productsEvaluated: products.length,
      productsUpdated,
      ingredientsEvaluated,
      ingredientsUpdated,
      matchedCount,
      unknownCount,
    };
  }

  private async applyAnalyzedToPersistedIngredients(
    persisted: Ingredient[],
    analyzed: AnalyzedIngredientResult[],
  ): Promise<number> {
    const toSave: Ingredient[] = [];

    for (let idx = 0; idx < persisted.length; idx++) {
      const entity = persisted[idx];
      const next = analyzed[idx];
      if (!next) continue;

      const nextAllergenType = next.allergenType || (null as any);
      const nextAdditiveCode = next.additiveCode || (null as any);

      const hasChanged =
        entity.isAllergen !== next.isAllergen ||
        (entity.allergenType || null) !== (nextAllergenType || null) ||
        (entity.additiveCode || null) !== (nextAdditiveCode || null) ||
        entity.hazardLevel !== next.hazardLevel ||
        (entity.explanation || null) !== (next.explanation || null) ||
        entity.analysisStatus !== next.analysisStatus ||
        (entity.matchedRuleId ?? null) !== (next.matchedRuleId ?? null) ||
        (entity.ruleSource || null) !== (next.ruleSource || null) ||
        (entity.fdaStatus || null) !== (next.fdaStatus || null) ||
        (entity.euStatus || null) !== (next.euStatus || null);

      if (hasChanged) {
        entity.isAllergen = next.isAllergen;
        entity.allergenType = nextAllergenType;
        entity.additiveCode = nextAdditiveCode;
        entity.hazardLevel = next.hazardLevel;
        entity.explanation = next.explanation;
        entity.analysisStatus = next.analysisStatus;
        entity.matchedRuleId = next.matchedRuleId;
        entity.ruleSource = next.ruleSource;
        entity.fdaStatus = next.fdaStatus;
        entity.euStatus = next.euStatus;
        toSave.push(entity);
      }
    }

    if (toSave.length > 0) {
      await this.ingredientRepo.save(toSave);
    }

    return toSave.length;
  }

  private computeProvisionalScoreFromAnalysis(
    analyzed: AnalyzedIngredientResult[],
    rulesActive: boolean,
  ): number {
    if (!analyzed || analyzed.length === 0) return 75;

    let score = 88;
    for (const item of analyzed) {
      if (item.hazardLevel === 'warning') {
        score -= 16;
      } else if (item.analysisStatus === 'unknown' && rulesActive) {
        // Unknown ingredients cannot be rewarded as verified-safe
        score -= 6;
      } else if (item.hazardLevel === 'caution') {
        score -= 9;
      }
    }
    return Math.max(25, Math.min(98, score));
  }

  /**
   * Find all products registered by a specific manufacturer (Feature F01 & F06 Dashboard)
   */
  async findByManufacturer(manufacturerId: number): Promise<FoodProduct[]> {
    return this.productRepo.find({
      where: { manufacturerId },
      relations: ['ingredients', 'nutritionFacts'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Archive food product (Feature F01)
   * Hidden from discovery but kept in history.
   */
  async archive(id: number, user: { id: number; role: string }): Promise<FoodProduct> {
    const product = await this.findById(id);

    if (user.role === 'manufacturer' && product.manufacturerId !== user.id) {
      throw new ForbiddenException(
        'Manufacturers are only permitted to archive their own food products',
      );
    }

    product.status = 'archived';
    return this.productRepo.save(product);
  }

  /**
   * Ban food product (Feature F01: Administrative Regulatory Governance)
   * Enforces mandatory regulatory justification; sets status to 'banned' and records audit fields.
   */
  async ban(
    id: number,
    reason: string,
    user: { id: number; role: string },
  ): Promise<FoodProduct> {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Only system administrators are authorized to place a food product under regulatory ban',
      );
    }

    if (!reason || !reason.trim() || reason.trim().length < 5) {
      throw new BadRequestException(
        'A substantive regulatory reason (minimum 5 characters) is required to ban a food product',
      );
    }

    const product = await this.findById(id);
    product.status = 'banned';
    product.banReason = reason.trim();
    product.bannedAt = new Date().toISOString();
    product.bannedBy = user.id;

    return this.productRepo.save(product);
  }

  /**
   * Reinstate / Unban food product (Feature F01: Administrative Regulatory Governance)
   * Restores status to 'active' and clears ban metadata.
   */
  async unban(
    id: number,
    user: { id: number; role: string },
  ): Promise<FoodProduct> {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Only system administrators are authorized to reinstate banned food products',
      );
    }

    const product = await this.findById(id);
    product.status = 'active';
    product.banReason = null;
    product.bannedAt = null;
    product.bannedBy = null;

    return this.productRepo.save(product);
  }

  /**
   * Permanently delete food product (Feature F01: Administrative Regulatory Governance)
   * Removes product and associated formulation data with full administrative authorization check.
   */
  async delete(
    id: number,
    user: { id: number; role: string },
  ): Promise<void> {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Only system administrators are authorized to permanently delete food products',
      );
    }

    const product = await this.findById(id);

    // Clean up dependent ingredients and nutrition facts
    await this.ingredientRepo.delete({ product: { id: product.id } });
    await this.nutritionRepo.delete({ product: { id: product.id } });

    await this.productRepo.delete(id);
  }

  /**
   * Fast aggregate counts of product lifecycle statuses via indexed SQL COUNT (Feature F01)
   */
  async countAll(): Promise<{ active: number; archived: number; banned: number; total: number }> {
    try {
      if (typeof this.productRepo.createQueryBuilder === 'function') {
        const qb = this.productRepo.createQueryBuilder('product');
        if (typeof qb.getRawMany === 'function') {
          const rawCounts = await qb
            .select('product.status', 'status')
            .addSelect('COUNT(*)', 'cnt')
            .groupBy('product.status')
            .getRawMany();

          if (Array.isArray(rawCounts) && rawCounts.length > 0) {
            let active = 0;
            let archived = 0;
            let banned = 0;
            for (const row of rawCounts) {
              const count = parseInt(row.cnt, 10) || 0;
              if (row.status === 'active') active = count;
              else if (row.status === 'archived') archived = count;
              else if (row.status === 'banned') banned = count;
            }
            return { active, archived, banned, total: active + archived + banned };
          }
        }
      }
    } catch {
      // Graceful fallback to concurrent counts in mock/unsupported environments
    }

    const [active, archived, banned] = await Promise.all([
      this.productRepo.count({ where: { status: 'active' } }),
      this.productRepo.count({ where: { status: 'archived' } }),
      this.productRepo.count({ where: { status: 'banned' } }),
    ]);
    return { active, archived, banned, total: active + archived + banned };
  }

  /**
   * Admin-specific multi-attribute product search with full status breakdown (Feature F01)
   * Highly optimized: uses fast direct SQL counts and avoids eager ingredient/nutrition joins for table view.
   */
  async adminSearchAll(options?: {
    q?: string;
    status?: string;
    category?: string;
    page?: number;
    limit?: number;
    statusCounts?: { active: number; archived: number; banned: number; total: number };
  }): Promise<{
    items: FoodProduct[];
    total: number;
    page: number;
    totalPages: number;
    statusCounts: { active: number; archived: number; banned: number; total: number };
  }> {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Number(options?.limit) || 10);
    const skip = (page - 1) * limit;

    // Use pre-computed status counts if supplied, or compute them concurrently
    const statusCountsPromise = options?.statusCounts
      ? Promise.resolve(options.statusCounts)
      : this.countAll();

    // Query product table directly without eager ingredient/nutrition joins
    const queryBuilder = this.productRepo.createQueryBuilder('product');

    if (options?.status && options.status !== 'all') {
      queryBuilder.where('product.status = :status', { status: options.status });
    }

    if (options?.q && options.q.trim()) {
      const q = `%${options.q.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE :q OR LOWER(product.brand) LIKE :q OR product.barcode LIKE :barcodeQ)',
        { q, barcodeQ: `%${options.q.trim()}%` },
      );
    }

    if (options?.category && options.category.trim()) {
      const cat = `%${options.category.trim().toLowerCase()}%`;
      queryBuilder.andWhere('LOWER(product.category) LIKE :cat', { cat });
    }

    queryBuilder.orderBy('product.createdAt', 'DESC').skip(skip).take(limit);

    const [[items, total], statusCounts] = await Promise.all([
      queryBuilder.getManyAndCount(),
      statusCountsPromise,
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      statusCounts,
    };
  }

  /**
   * Get unique categories and dietary tags for filters
   */
  async getFilterOptions(): Promise<{ categories: string[]; dietaryTags: string[] }> {
    return {
      categories: [
        'Dairy & Plant Milks',
        'Beverages',
        'Bakery & Bread',
        'Snacks & Confectionery',
        'Cereals & Breakfast',
        'Pantry & Condiments',
        'Packaged Meals',
      ],
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'Kosher', 'Low-Sugar', 'Organic'],
    };
  }

  /**
   * Classify Food Quality Score (0-100) into statutory transparency tiers.
   * - Tier 1 (>= 80): High Quality / Clean Formulation (Emerald)
   * - Tier 2 (60-79): Moderate Quality / Standard Formulation (Amber)
   * - Tier 3 (< 60): Low Quality / Elevated Processing & Additives (Rose / Crimson)
   */
  getQualityScoreTier(score: number): QualityScoreTierInfo {
    const s = Math.round(Number(score) || 0);
    if (s >= 80) {
      return {
        score: s,
        tierNumber: 1,
        tierLabel: 'Tier 1 · Superior Transparency',
        badgeLabel: 'Verified High Standard',
        badgeClass: 'score-badge-high',
        textColorClass: 'text-emerald-700 dark:text-emerald-400',
        tierColorClass: 'text-emerald-800 dark:text-emerald-300',
        badgeBgClass:
          'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        isHigh: true,
        isMid: false,
        isLow: false,
      };
    } else if (s >= 60) {
      return {
        score: s,
        tierNumber: 2,
        tierLabel: 'Tier 2 · Moderate Quality',
        badgeLabel: 'Moderate Formulation',
        badgeClass: 'score-badge-mid',
        textColorClass: 'text-amber-700 dark:text-amber-400',
        tierColorClass: 'text-amber-800 dark:text-amber-300',
        badgeBgClass:
          'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        isHigh: false,
        isMid: true,
        isLow: false,
      };
    } else {
      return {
        score: s,
        tierNumber: 3,
        tierLabel: 'Tier 3 · Elevated Processing & Additives',
        badgeLabel: 'Quality Caution Flagged',
        badgeClass: 'score-badge-low',
        textColorClass: 'text-rose-700 dark:text-rose-400',
        tierColorClass: 'text-rose-800 dark:text-rose-400',
        badgeBgClass:
          'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        isHigh: false,
        isMid: false,
        isLow: true,
      };
    }
  }

  /**
   * Build complete dynamic specimen analysis for the homepage official dossier showcase.
   */
  buildDossierSpecimen(product: FoodProduct, licenceNumber?: string): DossierSpecimen | null {
    if (!product) return null;

    const tierInfo = this.getQualityScoreTier(product.qualityScore);

    // 1. Synthetic Additives (exclude unclassified unknown ingredients unless an explicit additive code was extracted)
    const additives = (product.ingredients || []).filter(
      (i) =>
        Boolean(i.additiveCode) ||
        (i.analysisStatus !== 'unknown' &&
          (i.hazardLevel === 'caution' || i.hazardLevel === 'warning')),
    );
    const additiveCodes = additives
      .map((a) => a.additiveCode || a.name)
      .filter(Boolean)
      .join(', ');

    const additivesSummary =
      additives.length === 0
        ? {
            label: '0 Detected (Clean Label)',
            count: 0,
            status: 'safe' as const,
            badgeClass:
              'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800',
          }
        : {
            label: `${additives.length} Detected (${additiveCodes})`,
            count: additives.length,
            status: 'hazard' as const,
            badgeClass:
              'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800',
          };

    // 2. Allergen Declarations
    const allergens = (product.ingredients || []).filter((i) => i.isAllergen);
    const allergenNames = allergens
      .map((a) => a.allergenType || a.name)
      .filter(Boolean)
      .join(', ');

    const allergensSummary =
      allergens.length === 0
        ? {
            label: '0 Declared (Clean Formulation)',
            count: 0,
            status: 'safe' as const,
            badgeClass:
              'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800',
          }
        : {
            label: `${allergenNames} Declared`,
            count: allergens.length,
            status: 'caution' as const,
            badgeClass:
              'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800',
          };

    // 3. Sugar Saturation
    const sugarFact = (product.nutritionFacts || []).find((n) =>
      /sugar/i.test(n.nutrient),
    );
    let sugarSummary: {
      label: string;
      amount: number;
      status: 'safe' | 'caution' | 'hazard' | 'neutral';
      colorClass: string;
    } = {
      label: 'Not Declared',
      amount: 0,
      status: 'neutral',
      colorClass: 'text-slate-500 font-mono',
    };

    if (sugarFact) {
      const amount = Number(sugarFact.amountPer100g) || 0;
      const unit = product.servingUnit || 'g';
      if (amount <= 5) {
        sugarSummary = {
          label: `${amount}g / 100${unit} (Low Density)`,
          amount,
          status: 'safe',
          colorClass: 'text-emerald-700 dark:text-emerald-400 font-mono font-bold',
        };
      } else if (amount <= 10) {
        sugarSummary = {
          label: `${amount}g / 100${unit} (Moderate Density)`,
          amount,
          status: 'caution',
          colorClass: 'text-amber-700 dark:text-amber-400 font-mono font-bold',
        };
      } else {
        sugarSummary = {
          label: `${amount}g / 100${unit} (High Density / Flagged)`,
          amount,
          status: 'hazard',
          colorClass: 'text-rose-700 dark:text-rose-400 font-mono font-bold',
        };
      }
    }

    // 4. National Licence
    const nationalLicence = licenceNumber
      ? `${licenceNumber} (Valid)`
      : 'BSTI-FOOD-2024-001 (Valid)';

    return {
      product,
      tierInfo,
      additivesSummary,
      allergensSummary,
      sugarSummary,
      nationalLicence,
      ingredients: product.ingredients || [],
    };
  }
}

export interface QualityScoreTierInfo {
  score: number;
  tierNumber: 1 | 2 | 3;
  tierLabel: string;
  badgeLabel: string;
  badgeClass: string;
  textColorClass: string;
  tierColorClass: string;
  badgeBgClass: string;
  isHigh: boolean;
  isMid: boolean;
  isLow: boolean;
}

export interface DossierSpecimen {
  product: FoodProduct;
  tierInfo: QualityScoreTierInfo;
  additivesSummary: {
    label: string;
    count: number;
    status: 'safe' | 'caution' | 'hazard';
    badgeClass: string;
  };
  allergensSummary: {
    label: string;
    count: number;
    status: 'safe' | 'caution';
    badgeClass: string;
  };
  sugarSummary: {
    label: string;
    amount: number;
    status: 'safe' | 'caution' | 'hazard' | 'neutral';
    colorClass: string;
  };
  nationalLicence: string;
  ingredients: Ingredient[];
}
