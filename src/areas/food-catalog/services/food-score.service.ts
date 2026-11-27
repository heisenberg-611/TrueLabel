import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FoodProduct } from '../models/food-product.entity';
import { NutritionFact } from '../models/nutrition-fact.entity';
import { FoodRule } from '../../admin/models/food-rule.entity';
import { ScoringConfig } from '../models/scoring-config.entity';
import { FoodScoreSnapshot, ScoreTrigger } from '../models/food-score-snapshot.entity';
import {
  IngredientAnalyzerService,
  IngredientAnalysisReport,
} from './ingredient-analyzer.service';
import { FoodSafetyDocument } from '../../food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from '../../food-safety/models/manufacturer-licence.entity';
import { FoodReview } from '../../community/models/food-review.entity';
import { FoodReport } from '../../community/models/food-report.entity';

export type ScoreComponentKey =
  | 'ingredient'
  | 'nutrition'
  | 'verification'
  | 'recall'
  | 'community';

export interface ScoringWeights {
  ingredientWeight: number;
  nutritionWeight: number;
  verificationWeight: number;
  recallWeight: number;
  communityWeight: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  ingredientWeight: 35,
  nutritionWeight: 30,
  verificationWeight: 15,
  recallWeight: 10,
  communityWeight: 10,
};

export interface ScoreComponentBreakdown {
  key: ScoreComponentKey;
  label: string;
  shortLabel: string;
  score: number;
  weight: number;
  weightedContribution: number;
  weightedContributionFormatted: string;
  provisional: boolean;
  provisionalNote: string | null;
  rationale: string;
  evidenceSummary: string;
  statusTone: 'positive' | 'caution' | 'warning' | 'provisional';
  barColorClass: string;
}

export interface FoodScoreBreakdown {
  totalScore: number;
  rawWeightedScore: number;
  quarantineCapApplied: boolean;
  tierNumber: 1 | 2 | 3;
  tierLabel: string;
  isProvisional: boolean;
  provisionalComponents: ScoreComponentKey[];
  provisionalDisclaimer: string | null;
  weights: ScoringWeights;
  components: ScoreComponentBreakdown[];
}

export interface ScoreEvaluationInputs {
  product: Pick<
    FoodProduct,
    'id' | 'name' | 'brand' | 'category' | 'status' | 'manufacturerId' | 'servingUnit' | 'banReason' | 'ingredients' | 'nutritionFacts'
  >;
  ingredientReport: IngredientAnalysisReport;
  documents: FoodSafetyDocument[];
  licences: ManufacturerLicence[];
  reviews: FoodReview[];
  reports: FoodReport[];
}

export interface ScoreHistoryViewItem {
  id: number;
  totalScore: number;
  tierNumber: number;
  trigger: string;
  triggerLabel: string;
  isProvisional: boolean;
  weightsLabel: string;
  componentSummary: string;
  recordedOn: string;
  deltaFromPrevious: number | null;
  deltaLabel: string | null;
  deltaPositive: boolean;
  deltaNegative: boolean;
}

export interface ScoreRecalculationSummary {
  productsEvaluated: number;
  productsUpdated: number;
  snapshotsRecorded: number;
  tierCounts: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

const TRIGGER_LABELS: Record<string, string> = {
  seed: 'Catalog seed baseline',
  product_create: 'Product registered',
  product_edit: 'Formulation or nutrition updated',
  rule_update: 'Food rule base updated',
  weight_update: 'Scoring weights adjusted',
  product_ban: 'Regulatory ban enacted',
  product_unban: 'Product reinstated',
  signal_sync: 'Live signal sync',
  manual: 'Manual catalog recalculation',
};

/**
 * Feature F04: Explainable 0-100 Food Quality Score Engine
 * Combines 5 admin-weighted pillars (F03 ingredients/allergens, nutrition facts,
 * F06 verification records, recall/ban & F13 incident signals, and F11 credibility-weighted reviews),
 * labels provisional baselines honestly, and persists reproducible score snapshots.
 */
@Injectable()
export class FoodScoreService {
  private _fallbackAnalyzer?: IngredientAnalyzerService;

  constructor(
    @Optional()
    @InjectRepository(ScoringConfig)
    private readonly scoringConfigRepo?: Repository<ScoringConfig>,
    @Optional()
    @InjectRepository(FoodScoreSnapshot)
    private readonly snapshotRepo?: Repository<FoodScoreSnapshot>,
    @Optional()
    @InjectRepository(FoodProduct)
    private readonly productRepo?: Repository<FoodProduct>,
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
  ) {}

  private get analyzer(): IngredientAnalyzerService {
    if (this.ingredientAnalyzer) return this.ingredientAnalyzer;
    if (!this._fallbackAnalyzer) {
      this._fallbackAnalyzer = new IngredientAnalyzerService();
    }
    return this._fallbackAnalyzer;
  }

  /**
   * Fetch the active ScoringConfig record (creating the default 35/30/15/10/10 profile if missing).
   */
  async getActiveConfig(): Promise<ScoringConfig> {
    if (!this.scoringConfigRepo) {
      return {
        id: 1,
        configKey: 'default',
        ...DEFAULT_SCORING_WEIGHTS,
        updatedBy: null,
        notes: 'Default 5-component TrueLabel formula',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ScoringConfig;
    }

    let config = await this.scoringConfigRepo.findOne({
      where: { configKey: 'default' },
    });

    if (!config) {
      config = this.scoringConfigRepo.create({
        configKey: 'default',
        ...DEFAULT_SCORING_WEIGHTS,
        updatedBy: null,
        notes: 'Default 5-component TrueLabel methodology weights',
      });
      config = await this.scoringConfigRepo.save(config);
    }

    return config;
  }

  /**
   * Validate and update the 5 component weights (must sum to 100%) and recalculate catalog scores.
   */
  async updateWeights(
    weights: ScoringWeights & { notes?: string },
    user: { id: number; role: string },
  ): Promise<{
    config: ScoringConfig;
    recalculation: ScoreRecalculationSummary;
  }> {
    const cleanWeights: ScoringWeights = {
      ingredientWeight: Math.round(Number(weights.ingredientWeight)),
      nutritionWeight: Math.round(Number(weights.nutritionWeight)),
      verificationWeight: Math.round(Number(weights.verificationWeight)),
      recallWeight: Math.round(Number(weights.recallWeight)),
      communityWeight: Math.round(Number(weights.communityWeight)),
    };

    const allValues = Object.values(cleanWeights);
    if (allValues.some((w) => Number.isNaN(w) || w < 0 || w > 100)) {
      throw new BadRequestException(
        'Each component weight must be a whole percentage between 0 and 100.',
      );
    }

    const totalWeight = allValues.reduce((sum, w) => sum + w, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException(
        `Scoring weights must sum to exactly 100% (received ${totalWeight}%).`,
      );
    }

    let savedConfig: ScoringConfig;
    if (this.scoringConfigRepo) {
      const config = await this.getActiveConfig();
      config.ingredientWeight = cleanWeights.ingredientWeight;
      config.nutritionWeight = cleanWeights.nutritionWeight;
      config.verificationWeight = cleanWeights.verificationWeight;
      config.recallWeight = cleanWeights.recallWeight;
      config.communityWeight = cleanWeights.communityWeight;
      config.updatedBy = user.id;
      if (weights.notes !== undefined) {
        config.notes = weights.notes?.trim() || null;
      }
      savedConfig = await this.scoringConfigRepo.save(config);
    } else {
      savedConfig = {
        id: 1,
        configKey: 'default',
        ...cleanWeights,
        updatedBy: user.id,
        notes: weights.notes?.trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ScoringConfig;
    }

    const recalculation = await this.recalculateAllScores(
      'weight_update',
      undefined,
      savedConfig,
    );

    return { config: savedConfig, recalculation };
  }

  /**
   * Pure deterministic calculation: converts gathered signals & configured weights into
   * a reproducible 0-100 score and 5-component explainable breakdown.
   */
  computeScoreBreakdown(
    inputs: ScoreEvaluationInputs,
    weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  ): FoodScoreBreakdown {
    const ingredientComp = this.scoreIngredientPillar(
      inputs,
      weights.ingredientWeight,
    );
    const nutritionComp = this.scoreNutritionPillar(
      inputs.product.nutritionFacts || [],
      inputs.product.servingUnit || 'g',
      weights.nutritionWeight,
    );
    const verificationComp = this.scoreVerificationPillar(
      inputs.product,
      inputs.documents,
      inputs.licences,
      weights.verificationWeight,
    );
    const recallComp = this.scoreRecallPillar(
      inputs.product,
      inputs.reports,
      weights.recallWeight,
    );
    const communityComp = this.scoreCommunityPillar(
      inputs.reviews,
      weights.communityWeight,
    );

    const components = [
      ingredientComp,
      nutritionComp,
      verificationComp,
      recallComp,
      communityComp,
    ];

    const rawWeightedSum = components.reduce(
      (sum, c) => sum + (c.score * c.weight) / 100,
      0,
    );
    const rawWeightedScore = Math.round(rawWeightedSum * 10) / 10;
    let totalScore = Math.max(0, Math.min(100, Math.round(rawWeightedSum)));

    let quarantineCapApplied = false;
    if (inputs.product.status === 'banned' && totalScore > 35) {
      totalScore = 35;
      quarantineCapApplied = true;
    }

    const tierNumber: 1 | 2 | 3 =
      totalScore >= 80 ? 1 : totalScore >= 60 ? 2 : 3;
    const tierLabel =
      tierNumber === 1
        ? 'Tier 1: High transparency'
        : tierNumber === 2
          ? 'Tier 2: Moderate quality'
          : 'Tier 3: Elevated risk or processing';

    const provisionalComponents = components
      .filter((c) => c.provisional)
      .map((c) => c.key);
    const isProvisional = provisionalComponents.length > 0;

    const provisionalDisclaimer = isProvisional
      ? `${provisionalComponents.length} ${
          provisionalComponents.length === 1 ? 'component uses' : 'components use'
        } a clearly labelled provisional baseline where stored records or downstream recall feeds are not yet complete.`
      : null;

    return {
      totalScore,
      rawWeightedScore,
      quarantineCapApplied,
      tierNumber,
      tierLabel,
      isProvisional,
      provisionalComponents,
      provisionalDisclaimer,
      weights: { ...weights },
      components,
    };
  }

  /**
   * Evaluate live score breakdown for a single product without writing to the database.
   */
  async evaluateProduct(
    product: FoodProduct,
    suppliedRules?: FoodRule[],
    suppliedConfig?: ScoringWeights,
  ): Promise<FoodScoreBreakdown> {
    const activeRules =
      suppliedRules ??
      (this.foodRuleRepo
        ? await this.foodRuleRepo.find({
            where: { isActive: true },
            order: { id: 'ASC' },
          })
        : []);

    const config = suppliedConfig ?? (await this.getActiveConfig());

    const [documents, licences, reviews, reports] = await Promise.all([
      this.documentRepo
        ? this.documentRepo.find({
            where: { manufacturerId: product.manufacturerId },
          })
        : Promise.resolve([]),
      this.licenceRepo ? this.licenceRepo.find() : Promise.resolve([]),
      this.reviewRepo
        ? this.reviewRepo.find({
            where: { productId: product.id, visibility: 'visible' },
          })
        : Promise.resolve([]),
      this.reportRepo
        ? this.reportRepo.find({ where: { productId: product.id } })
        : Promise.resolve([]),
    ]);

    const ingredientReport = this.analyzer.buildProductAnalysisReport(
      product.ingredients || [],
      activeRules,
      product.category,
    );

    return this.computeScoreBreakdown(
      {
        product,
        ingredientReport,
        documents,
        licences,
        reviews,
        reports,
      },
      {
        ingredientWeight: config.ingredientWeight,
        nutritionWeight: config.nutritionWeight,
        verificationWeight: config.verificationWeight,
        recallWeight: config.recallWeight,
        communityWeight: config.communityWeight,
      },
    );
  }

  /**
   * Compute live breakdown, update FoodProduct.qualityScore if changed, and record a
   * FoodScoreSnapshot whenever score/components/weights changed (or no snapshot exists yet).
   */
  async evaluateAndSyncProduct(
    product: FoodProduct,
    options?: {
      trigger?: ScoreTrigger;
      forceSnapshot?: boolean;
      suppliedRules?: FoodRule[];
      suppliedConfig?: ScoringWeights;
    },
  ): Promise<{
    breakdown: FoodScoreBreakdown;
    history: ScoreHistoryViewItem[];
    config: ScoringWeights;
    updatedProductScore: boolean;
    snapshotCreated: boolean;
  }> {
    const trigger: ScoreTrigger = options?.trigger || 'manual';
    const config = options?.suppliedConfig ?? (await this.getActiveConfig());
    const breakdown = await this.evaluateProduct(
      product,
      options?.suppliedRules,
      config,
    );

    let updatedProductScore = false;
    if (
      this.productRepo &&
      Number(product.qualityScore) !== breakdown.totalScore
    ) {
      product.qualityScore = breakdown.totalScore;
      await this.productRepo.update(product.id, {
        qualityScore: breakdown.totalScore,
      });
      updatedProductScore = true;
    } else {
      product.qualityScore = breakdown.totalScore;
    }

    let snapshotCreated = false;
    if (this.snapshotRepo) {
      const latest = await this.snapshotRepo.findOne({
        where: { productId: product.id },
        order: { createdAt: 'DESC', id: 'DESC' },
      });

      const changed =
        !latest || Boolean(options?.forceSnapshot) || this.hasSnapshotChanged(latest, breakdown);

      if (changed) {
        const snapshot = this.snapshotRepo.create(
          this.buildSnapshotPayload(product.id, breakdown, trigger),
        );
        await this.snapshotRepo.save(snapshot);
        snapshotCreated = true;
      }
    }

    const history = await this.getProductScoreHistory(product.id, 8);

    return {
      breakdown,
      history,
      config,
      updatedProductScore,
      snapshotCreated,
    };
  }

  /**
   * Fetch persisted FoodScoreSnapshot history formatted for UI presentation.
   */
  async getProductScoreHistory(
    productId: number,
    limit: number = 8,
  ): Promise<ScoreHistoryViewItem[]> {
    if (!this.snapshotRepo) return [];

    const snapshots = await this.snapshotRepo.find({
      where: { productId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });

    return snapshots.map((snap, idx) => {
      const nextOlder = snapshots[idx + 1];
      const delta =
        nextOlder !== undefined
          ? Math.round((snap.totalScore - nextOlder.totalScore) * 10) / 10
          : null;
      const deltaLabel =
        delta === null
          ? null
          : delta > 0
            ? `+${delta}`
            : delta < 0
              ? `${delta}`
              : '0';

      return {
        id: snap.id,
        totalScore: snap.totalScore,
        tierNumber: snap.tierNumber,
        trigger: snap.trigger,
        triggerLabel: TRIGGER_LABELS[snap.trigger] || snap.trigger,
        isProvisional: snap.isProvisional,
        weightsLabel: `${snap.ingredientWeight}/${snap.nutritionWeight}/${snap.verificationWeight}/${snap.recallWeight}/${snap.communityWeight}`,
        componentSummary: `Ing ${snap.ingredientScore} · Nut ${snap.nutritionScore} · Ver ${snap.verificationScore} · Rec ${snap.recallScore} · Com ${snap.communityScore}`,
        recordedOn: snap.createdAt
          ? new Date(snap.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Just now',
        deltaFromPrevious: delta,
        deltaLabel,
        deltaPositive: delta !== null && delta > 0,
        deltaNegative: delta !== null && delta < 0,
      };
    });
  }

  /**
   * Recalculate scores & persist snapshots across all catalog products in batch.
   */
  async recalculateAllScores(
    trigger: ScoreTrigger = 'manual',
    suppliedRules?: FoodRule[],
    suppliedConfig?: ScoringWeights,
  ): Promise<ScoreRecalculationSummary> {
    if (!this.productRepo) {
      return {
        productsEvaluated: 0,
        productsUpdated: 0,
        snapshotsRecorded: 0,
        tierCounts: { tier1: 0, tier2: 0, tier3: 0 },
      };
    }

    const activeRules =
      suppliedRules ??
      (this.foodRuleRepo
        ? await this.foodRuleRepo.find({
            where: { isActive: true },
            order: { id: 'ASC' },
          })
        : []);
    const config = suppliedConfig ?? (await this.getActiveConfig());

    const [products, allDocs, allLicences, allReviews, allReports] =
      await Promise.all([
        this.productRepo.find({
          relations: ['ingredients', 'nutritionFacts'],
          order: { id: 'ASC' },
        }),
        this.documentRepo ? this.documentRepo.find() : Promise.resolve([]),
        this.licenceRepo ? this.licenceRepo.find() : Promise.resolve([]),
        this.reviewRepo
          ? this.reviewRepo.find({ where: { visibility: 'visible' } })
          : Promise.resolve([]),
        this.reportRepo ? this.reportRepo.find() : Promise.resolve([]),
      ]);

    // Preload latest snapshot per product to avoid N+1 queries
    const latestSnapshotByProduct = new Map<number, FoodScoreSnapshot>();
    if (this.snapshotRepo && products.length > 0) {
      const productIds = products.map((p) => p.id);
      const existingSnapshots = await this.snapshotRepo.find({
        where: { productId: In(productIds) },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      for (const snap of existingSnapshots) {
        if (!latestSnapshotByProduct.has(snap.productId)) {
          latestSnapshotByProduct.set(snap.productId, snap);
        }
      }
    }

    let productsUpdated = 0;
    const snapshotsToCreate: FoodScoreSnapshot[] = [];
    const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };

    for (const product of products) {
      const productDocs = allDocs.filter(
        (d) => d.manufacturerId === product.manufacturerId,
      );
      const productReviews = allReviews.filter(
        (r) => r.productId === product.id,
      );
      const productReports = allReports.filter(
        (rep) => rep.productId === product.id,
      );
      const ingredientReport = this.analyzer.buildProductAnalysisReport(
        product.ingredients || [],
        activeRules,
        product.category,
      );

      const breakdown = this.computeScoreBreakdown(
        {
          product,
          ingredientReport,
          documents: productDocs,
          licences: allLicences,
          reviews: productReviews,
          reports: productReports,
        },
        {
          ingredientWeight: config.ingredientWeight,
          nutritionWeight: config.nutritionWeight,
          verificationWeight: config.verificationWeight,
          recallWeight: config.recallWeight,
          communityWeight: config.communityWeight,
        },
      );

      if (breakdown.tierNumber === 1) tierCounts.tier1++;
      else if (breakdown.tierNumber === 2) tierCounts.tier2++;
      else tierCounts.tier3++;

      if (Number(product.qualityScore) !== breakdown.totalScore) {
        await this.productRepo.update(product.id, {
          qualityScore: breakdown.totalScore,
        });
        product.qualityScore = breakdown.totalScore;
        productsUpdated++;
      }

      if (this.snapshotRepo) {
        const latest = latestSnapshotByProduct.get(product.id);
        if (!latest || this.hasSnapshotChanged(latest, breakdown)) {
          snapshotsToCreate.push(
            this.snapshotRepo.create(
              this.buildSnapshotPayload(product.id, breakdown, trigger),
            ),
          );
        }
      }
    }

    if (this.snapshotRepo && snapshotsToCreate.length > 0) {
      await this.snapshotRepo.save(snapshotsToCreate);
    }

    return {
      productsEvaluated: products.length,
      productsUpdated,
      snapshotsRecorded: snapshotsToCreate.length,
      tierCounts,
    };
  }

  /**
   * Compute lightweight catalog tier telemetry without writing records.
   */
  async getCatalogTierStats(): Promise<{
    total: number;
    averageScore: number;
    tier1: number;
    tier2: number;
    tier3: number;
    snapshotCount: number;
  }> {
    if (!this.productRepo) {
      return {
        total: 0,
        averageScore: 0,
        tier1: 0,
        tier2: 0,
        tier3: 0,
        snapshotCount: 0,
      };
    }

    const [products, snapshotCount] = await Promise.all([
      this.productRepo.find({ select: ['id', 'qualityScore'] }),
      this.snapshotRepo ? this.snapshotRepo.count() : Promise.resolve(0),
    ]);

    let tier1 = 0;
    let tier2 = 0;
    let tier3 = 0;
    let sum = 0;

    for (const p of products) {
      const score = Number(p.qualityScore) || 0;
      sum += score;
      if (score >= 80) tier1++;
      else if (score >= 60) tier2++;
      else tier3++;
    }

    return {
      total: products.length,
      averageScore:
        products.length > 0 ? Math.round((sum / products.length) * 10) / 10 : 0,
      tier1,
      tier2,
      tier3,
      snapshotCount,
    };
  }

  private scoreIngredientPillar(
    inputs: ScoreEvaluationInputs,
    weight: number,
  ): ScoreComponentBreakdown {
    const report = inputs.ingredientReport;
    const total = report?.counts?.total || 0;

    if (total === 0) {
      const score = 40;
      return this.formatComponent({
        key: 'ingredient',
        label: 'Ingredient & allergen transparency',
        shortLabel: 'Ingredients',
        score,
        weight,
        provisional: true,
        provisionalNote: 'No ingredient list declared yet; provisional minimum baseline applied.',
        rationale:
          'Ingredients have not been submitted for regulatory rule screening yet.',
        evidenceSummary: '0 declared ingredients',
        barColorClass: 'bg-emerald-600 dark:bg-emerald-500',
      });
    }

    const warningCount = report.counts.warning || 0;
    const cautionCount = report.counts.caution || 0;
    const unknownCount = report.counts.unknown || 0;
    const safeCount = report.counts.safe || 0;
    const allergenCount = report.counts.allergens || 0;
    const coverage = report.counts.coveragePercent || 0;

    let score = 100;
    score -= warningCount * 28;
    score -= cautionCount * 10;
    score -= unknownCount * 12;

    // Properly disclosed safe allergens carry a small transparency deduction (never treated as toxic)
    const declaredSafeAllergens = report.recognizedIngredients.filter(
      (i) => i.isAllergen && i.hazardLevel === 'safe',
    ).length;
    score -= Math.min(6, declaredSafeAllergens * 2);

    score = Math.max(0, Math.min(100, Math.round(score)));

    const provisional = unknownCount > 0;
    const provisionalNote = provisional
      ? `${unknownCount} unclassified ingredient${unknownCount === 1 ? '' : 's'} separated from verified-safe items pending admin rule review.`
      : null;

    const parts: string[] = [];
    if (warningCount > 0) parts.push(`${warningCount} warning-tier`);
    if (cautionCount > 0) parts.push(`${cautionCount} caution-tier`);
    if (unknownCount > 0) parts.push(`${unknownCount} unclassified`);
    if (allergenCount > 0) parts.push(`${allergenCount} declared allergen${allergenCount === 1 ? '' : 's'}`);
    if (parts.length === 0) parts.push(`All ${safeCount} ingredients rule-verified safe`);

    return this.formatComponent({
      key: 'ingredient',
      label: 'Ingredient & allergen transparency',
      shortLabel: 'Ingredients',
      score,
      weight,
      provisional,
      provisionalNote,
      rationale: `${coverage}% F03 rule coverage (${report.counts.recognized}/${total} matched): ${parts.join(', ')}.`,
      evidenceSummary: `${report.counts.recognized}/${total} rule-matched · ${warningCount} warning · ${cautionCount} caution · ${unknownCount} unknown`,
      barColorClass: 'bg-emerald-600 dark:bg-emerald-500',
    });
  }

  private scoreNutritionPillar(
    facts: NutritionFact[],
    servingUnit: string,
    weight: number,
  ): ScoreComponentBreakdown {
    if (!facts || facts.length === 0) {
      return this.formatComponent({
        key: 'nutrition',
        label: 'Nutrition profile',
        shortLabel: 'Nutrition',
        score: 45,
        weight,
        provisional: true,
        provisionalNote:
          'Nutrition facts missing; provisional neutral-low baseline applied until label values are recorded.',
        rationale: 'No per-100g/ml nutrition label records found.',
        evidenceSummary: '0 nutrient rows',
        barColorClass: 'bg-teal-600 dark:bg-teal-500',
      });
    }

    const pick = (pattern: RegExp): number | null => {
      const match = facts.find((f) => pattern.test(f.nutrient));
      return match !== undefined && match !== null
        ? Number(match.amountPer100g)
        : null;
    };

    const energy = pick(/energy|calor/i);
    const sugars = pick(/sugar/i);
    const satFat = pick(/saturated\s*fat/i);
    let salt = pick(/^salt$/i);
    if (salt === null) {
      const sodium = pick(/sodium/i);
      if (sodium !== null) {
        salt = Math.round(sodium * 2.5 * 100) / 100;
      }
    }
    const protein = pick(/protein/i);
    const fiber = pick(/fiber|fibre/i);

    let score = 78;
    const notes: string[] = [];

    if (sugars !== null) {
      if (sugars <= 2.5) score += 8;
      else if (sugars <= 5) score += 4;
      else if (sugars <= 10) score -= 4;
      else if (sugars <= 20) score -= 14;
      else score -= 24;
      notes.push(`Sugars ${sugars}g`);
    }

    if (satFat !== null) {
      if (satFat <= 1.0) score += 6;
      else if (satFat <= 3.0) score += 2;
      else if (satFat <= 6.0) score -= 6;
      else if (satFat <= 12.0) score -= 14;
      else score -= 22;
      notes.push(`Sat. fat ${satFat}g`);
    }

    if (salt !== null) {
      if (salt <= 0.3) score += 5;
      else if (salt <= 0.7) score += 1;
      else if (salt <= 1.5) score -= 8;
      else score -= 18;
      notes.push(`Salt eq. ${salt}g`);
    }

    if (energy !== null) {
      if (energy > 450) score -= 6;
      else if (energy > 350) score -= 3;
      else if (energy <= 120) score += 3;
      notes.push(`${energy} kcal`);
    }

    if (protein !== null) {
      if (protein >= 8) score += 8;
      else if (protein >= 3) score += 4;
      notes.push(`Protein ${protein}g`);
    }

    if (fiber !== null) {
      if (fiber >= 4) score += 6;
      else if (fiber >= 1.5) score += 3;
      notes.push(`Fiber ${fiber}g`);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const provisional = facts.length < 3;

    return this.formatComponent({
      key: 'nutrition',
      label: 'Nutrition profile',
      shortLabel: 'Nutrition',
      score,
      weight,
      provisional,
      provisionalNote: provisional
        ? `Only ${facts.length} nutrient values declared; partial nutrition label treated as provisional.`
        : null,
      rationale: `Evaluated per 100${servingUnit} against WHO/FDA thresholds (${notes.join(', ')}).`,
      evidenceSummary: `${facts.length} nutrients per 100${servingUnit}`,
      barColorClass: 'bg-teal-600 dark:bg-teal-500',
    });
  }

  private scoreVerificationPillar(
    product: ScoreEvaluationInputs['product'],
    documents: FoodSafetyDocument[],
    licences: ManufacturerLicence[],
    weight: number,
  ): ScoreComponentBreakdown {
    const brandTokens = (product.brand || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    const companyMatchedDocs =
      brandTokens.length > 0
        ? documents.filter((doc) =>
            brandTokens.some((tok) =>
              (doc.companyName || '').toLowerCase().includes(tok),
            ),
          )
        : [];
    const relevantDocs =
      companyMatchedDocs.length > 0 ? companyMatchedDocs : documents;

    const now = new Date();
    const approvedActive = relevantDocs.filter(
      (d) => d.status === 'approved' && new Date(d.expiryDate) >= now,
    );
    const approvedExpired = relevantDocs.filter(
      (d) => d.status === 'approved' && new Date(d.expiryDate) < now,
    );
    const expiringSoon = approvedActive.filter((d) => {
      const days = Math.ceil(
        (new Date(d.expiryDate).getTime() - now.getTime()) / 86400000,
      );
      return days >= 0 && days <= 30;
    });
    const pendingDocs = relevantDocs.filter((d) => d.status === 'pending');
    const rejectedDocs = relevantDocs.filter((d) => d.status === 'rejected');

    const matchedLicence =
      brandTokens.length > 0
        ? licences.find((lic) =>
            brandTokens.some((tok) =>
              (lic.companyName || '').toLowerCase().includes(tok),
            ),
          )
        : undefined;

    const hasValidLicence =
      matchedLicence &&
      matchedLicence.status === 'valid' &&
      new Date(matchedLicence.expiryDate) >= now;
    const hasBadLicence =
      matchedLicence &&
      (matchedLicence.status === 'suspended' ||
        matchedLicence.status === 'revoked' ||
        matchedLicence.status === 'expired' ||
        new Date(matchedLicence.expiryDate) < now);

    if (
      relevantDocs.length === 0 &&
      !matchedLicence
    ) {
      return this.formatComponent({
        key: 'verification',
        label: 'Verification & certification',
        shortLabel: 'Verification',
        score: 50,
        weight,
        provisional: true,
        provisionalNote:
          'No manufacturer safety documents or registry licences matched yet; provisional baseline applied.',
        rationale:
          'Awaiting uploaded ISO/BSTI/lab reports or verified manufacturer trade licence.',
        evidenceSummary: '0 safety documents · no licence matched',
        barColorClass: 'bg-blue-600 dark:bg-blue-500',
      });
    }

    let score = 50;
    let provisional = false;
    let provisionalNote: string | null = null;
    const details: string[] = [];

    if (approvedActive.length > 0) {
      score += 32 + Math.min(10, (approvedActive.length - 1) * 5);
      details.push(`${approvedActive.length} active approved certificate${approvedActive.length === 1 ? '' : 's'}`);
    } else if (pendingDocs.length > 0) {
      score = 58;
      provisional = true;
      provisionalNote = `${pendingDocs.length} document${pendingDocs.length === 1 ? '' : 's'} currently pending inspector verification.`;
      details.push(`${pendingDocs.length} pending audit`);
    } else if (approvedExpired.length > 0) {
      score = 35;
      details.push(`${approvedExpired.length} expired certificate${approvedExpired.length === 1 ? '' : 's'}`);
    }

    if (hasValidLicence && matchedLicence) {
      score += 12;
      details.push(`valid licence ${matchedLicence.licenceNumber} (${matchedLicence.authority})`);
    } else if (hasBadLicence && matchedLicence) {
      score -= 25;
      details.push(`licence ${matchedLicence.licenceNumber} is ${matchedLicence.status}`);
    } else if (approvedActive.length === 0 && !matchedLicence && pendingDocs.length === 0) {
      provisional = true;
      provisionalNote = 'No valid registry licence verified yet; provisional baseline applied.';
    }

    if (expiringSoon.length > 0) {
      score -= 5;
      details.push(`${expiringSoon.length} expiring within 30 days`);
    }

    if (rejectedDocs.length > 0) {
      score -= Math.min(30, rejectedDocs.length * 18);
      details.push(`${rejectedDocs.length} rejected safety filing${rejectedDocs.length === 1 ? '' : 's'}`);
    }

    if (product.status === 'banned') {
      score = Math.min(score, 25);
      provisional = false;
      provisionalNote = null;
      details.push('regulatory quarantine suspends compliance standing');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return this.formatComponent({
      key: 'verification',
      label: 'Verification & certification',
      shortLabel: 'Verification',
      score,
      weight,
      provisional,
      provisionalNote,
      rationale:
        details.length > 0
          ? `F06 verification standing: ${details.join('; ')}.`
          : 'Manufacturer documentation checked against TrueLabel F06 registry.',
      evidenceSummary: `${approvedActive.length} approved · ${pendingDocs.length} pending · ${rejectedDocs.length} rejected`,
      barColorClass: 'bg-blue-600 dark:bg-blue-500',
    });
  }

  private scoreRecallPillar(
    product: ScoreEvaluationInputs['product'],
    reports: FoodReport[],
    weight: number,
  ): ScoreComponentBreakdown {
    if (product.status === 'banned') {
      return this.formatComponent({
        key: 'recall',
        label: 'Recall & safety incidents',
        shortLabel: 'Recalls & safety',
        score: 0,
        weight,
        provisional: false,
        provisionalNote: null,
        rationale:
          product.banReason ||
          'Product is currently under active statutory ban / quarantine.',
        evidenceSummary: `Status: BANNED · ${reports.length} consumer report${reports.length === 1 ? '' : 's'}`,
        barColorClass: 'bg-amber-600 dark:bg-amber-500',
      });
    }

    const activeReports = reports.filter(
      (r) => r.status === 'pending' || r.status === 'investigating',
    );
    const resolvedReports = reports.filter((r) => r.status === 'resolved');

    // Detect batch-code complaint clusters matching F13 clustering rule
    const batchCounts = new Map<string, number>();
    for (const rep of reports) {
      const batch = (rep.batchCode || '').trim().toLowerCase();
      if (batch) {
        batchCounts.set(batch, (batchCounts.get(batch) || 0) + 1);
      }
    }
    const hasBatchCluster = Array.from(batchCounts.values()).some((c) => c >= 2);

    let score = 95;
    const notes: string[] = [];

    for (const rep of activeReports) {
      if (
        rep.category === 'contaminated' ||
        rep.category === 'spoiled' ||
        rep.category === 'counterfeit'
      ) {
        score -= 20;
      } else {
        score -= 12;
      }
    }

    if (activeReports.length > 0) {
      notes.push(
        `${activeReports.length} open safety complaint${activeReports.length === 1 ? '' : 's'}`,
      );
    }

    if (hasBatchCluster) {
      score -= 15;
      notes.push('batch anomaly cluster detected');
    }

    if (resolvedReports.length > 0) {
      score -= Math.min(8, resolvedReports.length * 4);
      notes.push(
        `${resolvedReports.length} historical resolved report${resolvedReports.length === 1 ? '' : 's'}`,
      );
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return this.formatComponent({
      key: 'recall',
      label: 'Recall & safety incidents',
      shortLabel: 'Recalls & safety',
      score,
      weight,
      provisional: true,
      provisionalNote:
        'Live ban status & F13 complaint reports active; dedicated F08 inspector recall feed integrates in Sprint 3.',
      rationale:
        notes.length > 0
          ? `Safety incident signals: ${notes.join('; ')}.`
          : 'No active statutory ban or open consumer safety reports recorded.',
      evidenceSummary:
        reports.length === 0
          ? '0 complaints · no ban'
          : `${activeReports.length} open / ${reports.length} total complaints`,
      barColorClass: 'bg-amber-600 dark:bg-amber-500',
    });
  }

  private scoreCommunityPillar(
    reviews: FoodReview[],
    weight: number,
  ): ScoreComponentBreakdown {
    const visibleReviews = (reviews || []).filter(
      (r) => !r.visibility || r.visibility === 'visible',
    );

    if (visibleReviews.length === 0) {
      return this.formatComponent({
        key: 'community',
        label: 'Community feedback',
        shortLabel: 'Community',
        score: 70,
        weight,
        provisional: true,
        provisionalNote:
          'No credibility-weighted consumer reviews posted yet; neutral provisional baseline shown.',
        rationale:
          'No verified consumer reviews submitted yet — baseline is provisional until reviews accumulate.',
        evidenceSummary: '0 visible reviews',
        barColorClass: 'bg-indigo-600 dark:bg-indigo-500',
      });
    }

    const totalWeight = visibleReviews.reduce(
      (sum, r) => sum + (Number(r.credibilityWeight) || 1),
      0,
    );
    const weightedRatingSum = visibleReviews.reduce(
      (sum, r) => sum + Number(r.rating) * (Number(r.credibilityWeight) || 1),
      0,
    );
    const weightedAvg =
      totalWeight > 0 ? weightedRatingSum / totalWeight : 3.5;
    const score = Math.max(
      0,
      Math.min(100, Math.round((weightedAvg / 5) * 100)),
    );

    return this.formatComponent({
      key: 'community',
      label: 'Community feedback',
      shortLabel: 'Community',
      score,
      weight,
      provisional: false,
      provisionalNote: null,
      rationale: `Credibility-weighted rating ${weightedAvg.toFixed(1)} / 5.0 across ${visibleReviews.length} visible consumer review${visibleReviews.length === 1 ? '' : 's'}.`,
      evidenceSummary: `${weightedAvg.toFixed(1)}/5 avg (${visibleReviews.length} review${visibleReviews.length === 1 ? '' : 's'})`,
      barColorClass: 'bg-indigo-600 dark:bg-indigo-500',
    });
  }

  private formatComponent(params: {
    key: ScoreComponentKey;
    label: string;
    shortLabel: string;
    score: number;
    weight: number;
    provisional: boolean;
    provisionalNote: string | null;
    rationale: string;
    evidenceSummary: string;
    barColorClass: string;
  }): ScoreComponentBreakdown {
    const weightedContribution =
      Math.round((params.score * params.weight) / 10) / 10;
    const statusTone: ScoreComponentBreakdown['statusTone'] = params.provisional
      ? 'provisional'
      : params.score >= 80
        ? 'positive'
        : params.score >= 60
          ? 'caution'
          : 'warning';

    return {
      key: params.key,
      label: params.label,
      shortLabel: params.shortLabel,
      score: params.score,
      weight: params.weight,
      weightedContribution,
      weightedContributionFormatted: weightedContribution.toFixed(1),
      provisional: params.provisional,
      provisionalNote: params.provisionalNote,
      rationale: params.rationale,
      evidenceSummary: params.evidenceSummary,
      statusTone,
      barColorClass: params.barColorClass,
    };
  }

  private hasSnapshotChanged(
    latest: FoodScoreSnapshot,
    next: FoodScoreBreakdown,
  ): boolean {
    const getComp = (key: ScoreComponentKey) =>
      next.components.find((c) => c.key === key)?.score ?? 0;

    return (
      Math.round(Number(latest.totalScore)) !== next.totalScore ||
      Math.round(Number(latest.ingredientScore)) !== getComp('ingredient') ||
      Math.round(Number(latest.nutritionScore)) !== getComp('nutrition') ||
      Math.round(Number(latest.verificationScore)) !== getComp('verification') ||
      Math.round(Number(latest.recallScore)) !== getComp('recall') ||
      Math.round(Number(latest.communityScore)) !== getComp('community') ||
      Number(latest.ingredientWeight) !== next.weights.ingredientWeight ||
      Number(latest.nutritionWeight) !== next.weights.nutritionWeight ||
      Number(latest.verificationWeight) !== next.weights.verificationWeight ||
      Number(latest.recallWeight) !== next.weights.recallWeight ||
      Number(latest.communityWeight) !== next.weights.communityWeight
    );
  }

  private buildSnapshotPayload(
    productId: number,
    breakdown: FoodScoreBreakdown,
    trigger: ScoreTrigger,
  ): Partial<FoodScoreSnapshot> {
    const getComp = (key: ScoreComponentKey) =>
      breakdown.components.find((c) => c.key === key)?.score ?? 0;

    return {
      productId,
      versionId: null,
      totalScore: breakdown.totalScore,
      tierNumber: breakdown.tierNumber,
      ingredientScore: getComp('ingredient'),
      nutritionScore: getComp('nutrition'),
      verificationScore: getComp('verification'),
      recallScore: getComp('recall'),
      communityScore: getComp('community'),
      ingredientWeight: breakdown.weights.ingredientWeight,
      nutritionWeight: breakdown.weights.nutritionWeight,
      verificationWeight: breakdown.weights.verificationWeight,
      recallWeight: breakdown.weights.recallWeight,
      communityWeight: breakdown.weights.communityWeight,
      componentDetailsJson: JSON.stringify(
        breakdown.components.map((c) => ({
          key: c.key,
          score: c.score,
          weight: c.weight,
          weightedContribution: c.weightedContribution,
          provisional: c.provisional,
          rationale: c.rationale,
        })),
      ),
      provisionalComponents: breakdown.provisionalComponents,
      isProvisional: breakdown.isProvisional,
      trigger,
    };
  }
}
