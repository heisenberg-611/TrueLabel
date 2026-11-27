// Feature F05: Food Comparison Orchestrator Service
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FoodProduct } from '../models/food-product.entity';
import { FoodRule } from '../../admin/models/food-rule.entity';
import { FoodSafetyDocument } from '../../food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from '../../food-safety/models/manufacturer-licence.entity';
import { FoodReview } from '../../community/models/food-review.entity';
import { FoodReport } from '../../community/models/food-report.entity';
import { IngredientAnalyzerService } from './ingredient-analyzer.service';
import { DEFAULT_SCORING_WEIGHTS, FoodScoreService } from './food-score.service';
import {
  ComparisonCertificationSummary,
  FoodComparisonCandidateInput,
  FoodComparisonEngine,
  FoodComparisonResult,
} from './food-comparison.engine';
import { ConflictEvaluationResult } from '../../personal-food/services/preference.service';

export interface ComparisonPickerItem {
  id: number;
  name: string;
  brand: string;
  category: string;
  barcode: string;
  qualityScore: number;
  servingSize: number;
  servingUnit: string;
  isSelected: boolean;
  isDifferentCategory: boolean;
  toggleUrl: string;
}

export interface ComparisonCategoryGroup {
  category: string;
  count: number;
  isActiveCategory: boolean;
  quickCompareUrl: string | null;
  products: ComparisonPickerItem[];
}

export interface CompareFoodsPageData {
  comparison: FoodComparisonResult;
  pickerGroups: ComparisonCategoryGroup[];
  categories: string[];
  selectedCategoryFilter: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  trade_licence: 'Trade Licence',
  halal: 'Halal Certified',
  iso22000: 'ISO 22000',
  lab_test: 'Lab Test Report',
  gmp: 'GMP Certified',
  haccp: 'HACCP',
  organic: 'Organic Certified',
};

@Injectable()
export class FoodComparisonService {
  private _fallbackAnalyzer?: IngredientAnalyzerService;
  private _fallbackEngine?: FoodComparisonEngine;

  constructor(
    @InjectRepository(FoodProduct)
    private readonly productRepo: Repository<FoodProduct>,
    @Optional()
    @InjectRepository(FoodRule)
    private readonly foodRuleRepo?: Repository<FoodRule>,
    @Optional()
    @InjectRepository(FoodSafetyDocument)
    private readonly documentRepo?: Repository<FoodSafetyDocument>,
    @Optional()
    @InjectRepository(ManufacturerLicence)
    private readonly licenceRepo?: Repository<ManufacturerLicence>,
    @Optional()
    @InjectRepository(FoodReview)
    private readonly reviewRepo?: Repository<FoodReview>,
    @Optional()
    @InjectRepository(FoodReport)
    private readonly reportRepo?: Repository<FoodReport>,
    @Optional()
    private readonly ingredientAnalyzer?: IngredientAnalyzerService,
    @Optional()
    private readonly foodScoreService?: FoodScoreService,
    @Optional()
    private readonly comparisonEngine?: FoodComparisonEngine,
  ) {}

  private get analyzer(): IngredientAnalyzerService {
    if (this.ingredientAnalyzer) return this.ingredientAnalyzer;
    if (!this._fallbackAnalyzer) {
      this._fallbackAnalyzer = new IngredientAnalyzerService();
    }
    return this._fallbackAnalyzer;
  }

  private get engine(): FoodComparisonEngine {
    if (this.comparisonEngine) return this.comparisonEngine;
    if (!this._fallbackEngine) {
      this._fallbackEngine = new FoodComparisonEngine();
    }
    return this._fallbackEngine;
  }

  /**
   * Fetch lightweight catalog candidates without eager ingredient/nutrition joins (PROJECT_RULES §3).
   */
  async getLightweightCandidates(): Promise<
    Array<
      Pick<
        FoodProduct,
        | 'id'
        | 'name'
        | 'brand'
        | 'category'
        | 'barcode'
        | 'qualityScore'
        | 'servingSize'
        | 'servingUnit'
        | 'status'
      >
    >
  > {
    if (typeof this.productRepo.createQueryBuilder === 'function') {
      return this.productRepo
        .createQueryBuilder('product')
        .select([
          'product.id',
          'product.name',
          'product.brand',
          'product.category',
          'product.barcode',
          'product.qualityScore',
          'product.servingSize',
          'product.servingUnit',
          'product.status',
        ])
        .where('product.status = :status', { status: 'active' })
        .orderBy('product.category', 'ASC')
        .addOrderBy('product.qualityScore', 'DESC')
        .take(100)
        .getMany();
    }

    return this.productRepo.find({
      where: { status: 'active' },
      order: { category: 'ASC', qualityScore: 'DESC' },
      take: 100,
    });
  }

  /**
   * Build full F05 comparison page data: evaluates selected products via F03 + F04 + F06
   * and returns the pure FoodComparisonEngine matrix plus lightweight picker groups.
   */
  async compareFoods(
    requestedIds: number[],
    options?: {
      userProfile?: any;
      evaluateConflictFn?: (profile: any, product: FoodProduct) => ConflictEvaluationResult | null;
      pickerCategory?: string;
    },
  ): Promise<CompareFoodsPageData> {
    const cleanIds = Array.from(
      new Set(
        (requestedIds || []).filter(
          (id) => Number.isInteger(id) && id > 0,
        ),
      ),
    );

    const [selectedProductsRaw, lightweightCandidates] = await Promise.all([
      cleanIds.length > 0
        ? this.productRepo.find({
            where: { id: In(cleanIds) },
            relations: ['ingredients', 'nutritionFacts'],
          })
        : Promise.resolve([]),
      this.getLightweightCandidates(),
    ]);

    // Preserve requested URL order and detect missing IDs
    const productById = new Map<number, FoodProduct>();
    for (const prod of selectedProductsRaw) {
      productById.set(prod.id, prod);
    }

    const orderedProducts: FoodProduct[] = [];
    const missingIds: number[] = [];
    for (const id of cleanIds) {
      const found = productById.get(id);
      if (found) {
        orderedProducts.push(found);
      } else {
        missingIds.push(id);
      }
    }

    let comparison: FoodComparisonResult;
    if (orderedProducts.length === 0) {
      comparison = this.engine.compare([], missingIds);
    } else {
      const foundIds = orderedProducts.map((p) => p.id);
      const manufacturerIds = Array.from(
        new Set(orderedProducts.map((p) => p.manufacturerId)),
      );

      const [activeRules, scoringConfig, allDocs, allLicences, allReviews, allReports] =
        await Promise.all([
          this.foodRuleRepo
            ? this.foodRuleRepo.find({
                where: { isActive: true },
                order: { id: 'ASC' },
              })
            : Promise.resolve([]),
          this.foodScoreService
            ? this.foodScoreService.getActiveConfig()
            : Promise.resolve(DEFAULT_SCORING_WEIGHTS),
          this.documentRepo && manufacturerIds.length > 0
            ? this.documentRepo.find({
                where: { manufacturerId: In(manufacturerIds) },
              })
            : Promise.resolve([]),
          this.licenceRepo ? this.licenceRepo.find() : Promise.resolve([]),
          this.reviewRepo && foundIds.length > 0
            ? this.reviewRepo.find({
                where: { productId: In(foundIds), visibility: 'visible' },
              })
            : Promise.resolve([]),
          this.reportRepo && foundIds.length > 0
            ? this.reportRepo.find({
                where: { productId: In(foundIds) },
              })
            : Promise.resolve([]),
        ]);

      const weights = {
        ingredientWeight: scoringConfig.ingredientWeight,
        nutritionWeight: scoringConfig.nutritionWeight,
        verificationWeight: scoringConfig.verificationWeight,
        recallWeight: scoringConfig.recallWeight,
        communityWeight: scoringConfig.communityWeight,
      };

      const candidateInputs: FoodComparisonCandidateInput[] = orderedProducts.map(
        (product) => {
          const ingredientReport = this.analyzer.buildProductAnalysisReport(
            product.ingredients || [],
            activeRules,
            product.category,
          );

          const mfgDocs = allDocs.filter(
            (d) => d.manufacturerId === product.manufacturerId,
          );
          const prodReviews = allReviews.filter((r) => r.productId === product.id);
          const prodReports = allReports.filter((r) => r.productId === product.id);

          const scoreBreakdown = this.foodScoreService
            ? this.foodScoreService.computeScoreBreakdown(
                {
                  product,
                  ingredientReport,
                  documents: mfgDocs,
                  licences: allLicences,
                  reviews: prodReviews,
                  reports: prodReports,
                },
                weights,
              )
            : this.buildFallbackBreakdown(product);

          const certificationSummary = this.summarizeCertifications(
            product,
            mfgDocs,
            allLicences,
          );

          const userConflict =
            options?.userProfile && options?.evaluateConflictFn
              ? options.evaluateConflictFn(options.userProfile, product)
              : null;

          return {
            product,
            ingredientReport,
            scoreBreakdown,
            certificationSummary,
            userConflict,
          };
        },
      );

      comparison = this.engine.compare(candidateInputs, missingIds);
    }

    // Build picker groups by category
    const activeSelectionIds = comparison.slots.map((s) => s.id);
    const activeCatLower = comparison.activeCategory
      ? comparison.activeCategory.toLowerCase()
      : null;

    const categoryGroupMap = new Map<
      string,
      Array<
        Pick<
          FoodProduct,
          | 'id'
          | 'name'
          | 'brand'
          | 'category'
          | 'barcode'
          | 'qualityScore'
          | 'servingSize'
          | 'servingUnit'
          | 'status'
        >
      >
    >();

    for (const item of lightweightCandidates) {
      const cat = (item.category || 'Uncategorized').trim();
      if (!categoryGroupMap.has(cat)) {
        categoryGroupMap.set(cat, []);
      }
      categoryGroupMap.get(cat)!.push(item);
    }

    const categories = Array.from(categoryGroupMap.keys());
    const requestedCategoryFilter = (options?.pickerCategory || '').trim();
    const effectiveCategoryFilter =
      requestedCategoryFilter ||
      (comparison.activeCategory && !comparison.isCrossCategoryBlocked
        ? comparison.activeCategory
        : '');

    const pickerGroups: ComparisonCategoryGroup[] = categories
      .filter((cat) =>
        effectiveCategoryFilter
          ? cat.toLowerCase() === effectiveCategoryFilter.toLowerCase()
          : true,
      )
      .map((cat) => {
        const items = categoryGroupMap.get(cat) || [];
        const quickIds = items.slice(0, Math.min(3, items.length)).map((i) => i.id);
        return {
          category: cat,
          count: items.length,
          isActiveCategory: activeCatLower === cat.toLowerCase(),
          quickCompareUrl:
            quickIds.length >= 2 ? this.engine.buildCompareUrl(quickIds) : null,
          products: items.map((item) => {
            const isSelected = activeSelectionIds.includes(item.id);
            const nextIds = isSelected
              ? activeSelectionIds.filter((id) => id !== item.id)
              : [...activeSelectionIds, item.id];

            return {
              id: item.id,
              name: item.name,
              brand: item.brand,
              category: item.category,
              barcode: item.barcode,
              qualityScore: Math.round(Number(item.qualityScore || 0)),
              servingSize: Number(item.servingSize || 100),
              servingUnit: item.servingUnit || 'g',
              isSelected,
              isDifferentCategory:
                Boolean(activeCatLower) &&
                cat.toLowerCase() !== activeCatLower,
              toggleUrl: this.engine.buildCompareUrl(nextIds),
            };
          }),
        };
      });

    return {
      comparison,
      pickerGroups,
      categories,
      selectedCategoryFilter: effectiveCategoryFilter,
    };
  }

  private summarizeCertifications(
    product: FoodProduct,
    docs: FoodSafetyDocument[],
    licences: ManufacturerLicence[],
  ): ComparisonCertificationSummary {
    const brandTokens = (product.brand || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    const brandMatchedDocs =
      brandTokens.length > 0
        ? docs.filter((doc) =>
            brandTokens.some((tok) =>
              (doc.companyName || '').toLowerCase().includes(tok),
            ),
          )
        : [];
    const relevantDocs = brandMatchedDocs.length > 0 ? brandMatchedDocs : docs;

    const now = new Date();
    const approvedActive = relevantDocs.filter(
      (d) => d.status === 'approved' && new Date(d.expiryDate) >= now,
    );
    const pendingDocs = relevantDocs.filter((d) => d.status === 'pending');
    const rejectedDocs = relevantDocs.filter((d) => d.status === 'rejected');

    const docLabels = Array.from(
      new Set(
        approvedActive.map(
          (d) =>
            DOC_TYPE_LABELS[d.documentType] ||
            d.documentType.replace(/_/g, ' ').toUpperCase(),
        ),
      ),
    );

    const matchedLicence =
      brandTokens.length > 0
        ? licences.find((lic) =>
            brandTokens.some((tok) =>
              (lic.companyName || '').toLowerCase().includes(tok),
            ),
          )
        : undefined;

    const licenceValid = Boolean(
      matchedLicence &&
        matchedLicence.status === 'valid' &&
        new Date(matchedLicence.expiryDate) >= now,
    );

    let verificationStanding = 'Pending or unverified records';
    if (product.status === 'banned') {
      verificationStanding = 'Suspended (Statutory ban)';
    } else if (approvedActive.length > 0 && licenceValid) {
      verificationStanding = 'Verified documents & active licence';
    } else if (approvedActive.length > 0) {
      verificationStanding = 'Approved certificates on file';
    } else if (pendingDocs.length > 0) {
      verificationStanding = 'Safety filing pending inspection';
    }

    return {
      approvedCount: approvedActive.length,
      pendingCount: pendingDocs.length,
      rejectedCount: rejectedDocs.length,
      docLabels,
      licenceNumber: matchedLicence?.licenceNumber || null,
      licenceAuthority: matchedLicence?.authority || null,
      licenceStatus: matchedLicence?.status || null,
      licenceValid,
      verificationStanding,
    };
  }

  private buildFallbackBreakdown(product: FoodProduct) {
    const score = Math.round(Number(product.qualityScore || 75));
    const tierNumber: 1 | 2 | 3 = score >= 80 ? 1 : score >= 60 ? 2 : 3;
    return {
      totalScore: score,
      rawWeightedScore: score,
      quarantineCapApplied: product.status === 'banned',
      tierNumber,
      tierLabel:
        tierNumber === 1
          ? 'Tier 1: High transparency'
          : tierNumber === 2
            ? 'Tier 2: Moderate quality'
            : 'Tier 3: Elevated risk or processing',
      isProvisional: true,
      provisionalComponents: [],
      provisionalDisclaimer: null,
      weights: DEFAULT_SCORING_WEIGHTS,
      components: [],
    };
  }
}
