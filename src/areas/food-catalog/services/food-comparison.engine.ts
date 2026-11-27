// Feature F05: Pure Food Comparison Engine (Zero DB dependencies)
import { Injectable } from '@nestjs/common';
import { FoodProduct } from '../models/food-product.entity';
import { NutritionFact } from '../models/nutrition-fact.entity';
import {
  FoodScoreBreakdown,
  ScoreComponentKey,
} from './food-score.service';
import { IngredientAnalysisReport } from './ingredient-analyzer.service';
import { ConflictEvaluationResult } from '../../personal-food/services/preference.service';

export interface ComparisonCertificationSummary {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  docLabels: string[];
  licenceNumber: string | null;
  licenceAuthority: string | null;
  licenceStatus: string | null;
  licenceValid: boolean;
  verificationStanding: string;
}

export interface FoodComparisonCandidateInput {
  product: FoodProduct;
  ingredientReport: IngredientAnalysisReport;
  scoreBreakdown: FoodScoreBreakdown;
  certificationSummary: ComparisonCertificationSummary;
  userConflict?: ConflictEvaluationResult | null;
}

export type ComparisonMode =
  | 'empty'
  | 'insufficient'
  | 'too_many'
  | 'cross_category_blocked'
  | 'ready';

export interface ComparisonSlotItem {
  id: number;
  name: string;
  brand: string;
  category: string;
  barcode: string;
  qualityScore: number;
  servingSize: number;
  servingUnit: string;
  status: string;
  removeUrl: string;
  detailUrl: string;
}

export interface CategoryQuickFixOption {
  category: string;
  count: number;
  canCompareImmediately: boolean;
  url: string;
}

export interface ComparisonHeaderProduct {
  id: number;
  name: string;
  brand: string;
  category: string;
  barcode: string;
  status: string;
  isBanned: boolean;
  servingSize: number;
  servingUnit: string;
  per100BaseLabel: string;
  servingLabel: string;
  qualityScore: number;
  tierNumber: 1 | 2 | 3;
  tierLabel: string;
  isProvisionalScore: boolean;
  isHighestScore: boolean;
  isTiedTopScore: boolean;
  dietaryTags: string[];
  userConflict: ConflictEvaluationResult | null;
  removeUrl: string;
  detailUrl: string;
}

export interface ComparisonScoreCell {
  productId: number;
  score: number;
  weightedContributionFormatted: string;
  provisional: boolean;
  isLeader: boolean;
  isTiedTop: boolean;
  toneClass: string;
}

export interface ComparisonScoreRow {
  key: ScoreComponentKey | 'total';
  label: string;
  weightLabel: string;
  isTotalRow: boolean;
  allTied: boolean;
  cells: ComparisonScoreCell[];
}

export interface ComparisonNutritionCell {
  productId: number;
  declared: boolean;
  rawValue: number | null;
  displayValue: string;
  unit: string;
  perBaseLabel: string;
  isLeader: boolean;
  isTiedTop: boolean;
  leaderLabel: string | null;
}

export interface ComparisonNutritionRow {
  key: string;
  label: string;
  unit: string;
  direction: 'lower' | 'higher' | 'neutral';
  hasDeclaredValues: boolean;
  allTied: boolean;
  missingCount: number;
  cells: ComparisonNutritionCell[];
}

export interface ComparisonIngredientChip {
  name: string;
  additiveCode: string | null;
  isAllergen: boolean;
  allergenType: string | null;
  hazardLevel: 'safe' | 'caution' | 'warning';
  isUnknown: boolean;
  isShared: boolean;
  isUnique: boolean;
}

export interface ComparisonProductFormulation {
  productId: number;
  productName: string;
  totalCount: number;
  recognizedCount: number;
  unknownCount: number;
  coveragePercent: number;
  safeCount: number;
  cautionCount: number;
  warningCount: number;
  additiveCount: number;
  uniqueIngredients: string[];
  allIngredients: ComparisonIngredientChip[];
}

export interface ComparisonAdditiveRow {
  codeOrName: string;
  cells: Array<{
    productId: number;
    present: boolean;
    label: string;
    hazardLevel: 'safe' | 'caution' | 'warning' | 'none';
  }>;
}

export interface ComparisonAllergenRow {
  allergenLabel: string;
  cells: Array<{
    productId: number;
    declared: boolean;
    ingredientNames: string[];
    personalMatch: boolean;
  }>;
}

export interface ComparisonConsumerConflictCell {
  productId: number;
  profileConfigured: boolean;
  hasAllergenConflict: boolean;
  hasDietaryConflict: boolean;
  hasNutritionWarning: boolean;
  isSafeForUser: boolean;
  summaryLabel: string;
  tone: 'danger' | 'caution' | 'info' | 'safe' | 'neutral';
}

export interface ComparisonCertificationCell {
  productId: number;
  productName: string;
  verificationScore: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  docLabels: string[];
  hasApprovedDocs: boolean;
  licenceLabel: string;
  licenceValid: boolean;
  verificationStanding: string;
}

export interface FoodComparisonResult {
  mode: ComparisonMode;
  canCompare: boolean;
  isCrossCategoryBlocked: boolean;
  selectedCount: number;
  activeCategory: string | null;
  blockedCategories: string[];
  validationError: string | null;
  missingIds: number[];
  slots: ComparisonSlotItem[];
  categoryQuickFixes: CategoryQuickFixOption[];
  clearUrl: string;
  products: ComparisonHeaderProduct[];
  scoreMatrix: ComparisonScoreRow[];
  nutritionMatrix: {
    hasMixedUnits: boolean;
    servingBaseSummary: string;
    rows: ComparisonNutritionRow[];
    lowestSugarProduct: string | null;
    highestProteinProduct: string | null;
    missingDeclarationsTotal: number;
  } | null;
  ingredientMatrix: {
    sharedIngredients: string[];
    perProduct: ComparisonProductFormulation[];
    additiveRows: ComparisonAdditiveRow[];
  } | null;
  allergenMatrix: {
    hasAnyAllergens: boolean;
    rows: ComparisonAllergenRow[];
    consumerSafetyActive: boolean;
    consumerCells: ComparisonConsumerConflictCell[];
  } | null;
  certificationMatrix: ComparisonCertificationCell[];
}

interface NutrientSpec {
  key: string;
  label: string;
  pattern: RegExp;
  unit: string;
  direction: 'lower' | 'higher' | 'neutral';
  decimals: number;
}

const STATUTORY_NUTRIENT_SPECS: NutrientSpec[] = [
  { key: 'energy', label: 'Energy', pattern: /energy|calor/i, unit: 'kcal', direction: 'lower', decimals: 0 },
  { key: 'fat', label: 'Total Fat', pattern: /^(?:total\s*)?fat$/i, unit: 'g', direction: 'lower', decimals: 1 },
  { key: 'saturated_fat', label: 'Saturated Fat', pattern: /saturated\s*fat/i, unit: 'g', direction: 'lower', decimals: 1 },
  { key: 'carbohydrates', label: 'Carbohydrates', pattern: /carbohydrat/i, unit: 'g', direction: 'neutral', decimals: 1 },
  { key: 'sugars', label: 'Sugars', pattern: /sugar/i, unit: 'g', direction: 'lower', decimals: 1 },
  { key: 'fiber', label: 'Dietary Fiber', pattern: /fiber|fibre/i, unit: 'g', direction: 'higher', decimals: 1 },
  { key: 'protein', label: 'Protein', pattern: /protein/i, unit: 'g', direction: 'higher', decimals: 1 },
  { key: 'salt', label: 'Salt / Sodium eq.', pattern: /^salt$/i, unit: 'g', direction: 'lower', decimals: 2 },
];

/**
 * Pure Domain Comparison Engine (Feature F05)
 * Deterministically evaluates 2–3 packaged foods in the exact same category across:
 * 1) Explainable Quality Score & 5 Pillars (F04)
 * 2) Standardized Nutrition per 100 g / 100 ml with explicit serving bases & Not-declared labels
 * 3) Declared Ingredients, Additive E-codes, Unknowns & Shared/Unique Divergences (F03)
 * 4) Allergen Matrix & Consumer Dietary Conflict Alerts (F16)
 * 5) Food Safety Certifications & Manufacturer Licences (F06)
 */
@Injectable()
export class FoodComparisonEngine {
  buildCompareUrl(ids: number[]): string {
    if (!ids || ids.length === 0) return '/catalog/compare';
    return `/catalog/compare?ids=${ids.join(',')}`;
  }

  compare(
    candidates: FoodComparisonCandidateInput[],
    missingIds: number[] = [],
  ): FoodComparisonResult {
    const selectedIds = candidates.map((c) => c.product.id);
    const slots: ComparisonSlotItem[] = candidates.map((c) => ({
      id: c.product.id,
      name: c.product.name,
      brand: c.product.brand,
      category: c.product.category,
      barcode: c.product.barcode,
      qualityScore: Math.round(Number(c.scoreBreakdown?.totalScore ?? c.product.qualityScore ?? 0)),
      servingSize: Number(c.product.servingSize || 100),
      servingUnit: c.product.servingUnit || 'g',
      status: c.product.status,
      removeUrl: this.buildCompareUrl(selectedIds.filter((id) => id !== c.product.id)),
      detailUrl: `/catalog/product/${c.product.id}`,
    }));

    // Distinct categories (case-insensitive normalization while preserving display label)
    const categoryBuckets = new Map<string, { label: string; ids: number[] }>();
    for (const item of candidates) {
      const displayCat = (item.product.category || 'Uncategorized').trim();
      const key = displayCat.toLowerCase();
      if (!categoryBuckets.has(key)) {
        categoryBuckets.set(key, { label: displayCat, ids: [] });
      }
      categoryBuckets.get(key)!.ids.push(item.product.id);
    }

    const distinctCategories = Array.from(categoryBuckets.values()).map((b) => b.label);
    const categoryQuickFixes: CategoryQuickFixOption[] = Array.from(
      categoryBuckets.values(),
    ).map((bucket) => ({
      category: bucket.label,
      count: bucket.ids.length,
      canCompareImmediately: bucket.ids.length >= 2 && bucket.ids.length <= 3,
      url: this.buildCompareUrl(bucket.ids.slice(0, 3)),
    }));

    const baseEmpty = {
      selectedCount: candidates.length,
      missingIds,
      slots,
      categoryQuickFixes,
      clearUrl: '/catalog/compare',
      products: [] as ComparisonHeaderProduct[],
      scoreMatrix: [] as ComparisonScoreRow[],
      nutritionMatrix: null,
      ingredientMatrix: null,
      allergenMatrix: null,
      certificationMatrix: [] as ComparisonCertificationCell[],
    };

    if (candidates.length === 0) {
      return {
        ...baseEmpty,
        mode: 'empty',
        canCompare: false,
        isCrossCategoryBlocked: false,
        activeCategory: null,
        blockedCategories: [],
        validationError:
          missingIds.length > 0
            ? `Requested product ID(s) (${missingIds.join(', ')}) were not found in the catalog.`
            : null,
      };
    }

    // Cross-category block takes priority even if >3 or 2-3 items span different categories
    if (distinctCategories.length > 1) {
      return {
        ...baseEmpty,
        mode: 'cross_category_blocked',
        canCompare: false,
        isCrossCategoryBlocked: true,
        activeCategory: null,
        blockedCategories: distinctCategories,
        validationError: `Cross-category comparison blocked: selected items span ${distinctCategories.length} categories (${distinctCategories.join(' vs. ')}). TrueLabel only compares packaged foods within the same category so nutrition per 100g/ml and category rules remain valid.`,
      };
    }

    const singleCategory = distinctCategories[0];

    if (candidates.length < 2) {
      return {
        ...baseEmpty,
        mode: 'insufficient',
        canCompare: false,
        isCrossCategoryBlocked: false,
        activeCategory: singleCategory,
        blockedCategories: [],
        validationError:
          'Select at least 2 packaged food products in the same category to run a side-by-side comparison.',
      };
    }

    if (candidates.length > 3) {
      return {
        ...baseEmpty,
        mode: 'too_many',
        canCompare: false,
        isCrossCategoryBlocked: false,
        activeCategory: singleCategory,
        blockedCategories: [],
        validationError: `Comparison supports up to 3 foods at once (currently ${candidates.length} selected). Remove ${candidates.length - 3} item${candidates.length - 3 === 1 ? '' : 's'} below to inspect the matrix.`,
      };
    }

    // Ready for 2-3 same-category comparison
    const scores = candidates.map((c) => Math.round(c.scoreBreakdown.totalScore));
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const allScoresTied = maxScore === minScore;
    const topScoreWinnersCount = scores.filter((s) => s === maxScore).length;

    const products: ComparisonHeaderProduct[] = candidates.map((c) => {
      const score = Math.round(c.scoreBreakdown.totalScore);
      const unit = c.product.servingUnit || 'g';
      const size = Number(c.product.servingSize || 100);
      const isTop = !allScoresTied && score === maxScore;
      return {
        id: c.product.id,
        name: c.product.name,
        brand: c.product.brand,
        category: c.product.category,
        barcode: c.product.barcode,
        status: c.product.status,
        isBanned: c.product.status === 'banned',
        servingSize: size,
        servingUnit: unit,
        per100BaseLabel: `per 100 ${unit}`,
        servingLabel: `Declared serving: ${size} ${unit} (standardized per 100 ${unit})`,
        qualityScore: score,
        tierNumber: c.scoreBreakdown.tierNumber,
        tierLabel: c.scoreBreakdown.tierLabel,
        isProvisionalScore: c.scoreBreakdown.isProvisional,
        isHighestScore: isTop && topScoreWinnersCount === 1,
        isTiedTopScore: isTop && topScoreWinnersCount > 1,
        dietaryTags: c.product.dietaryTags || [],
        userConflict: c.userConflict || null,
        removeUrl: this.buildCompareUrl(selectedIds.filter((id) => id !== c.product.id)),
        detailUrl: `/catalog/product/${c.product.id}`,
      };
    });

    const scoreMatrix = this.buildScoreMatrix(candidates);
    const nutritionMatrix = this.buildNutritionMatrix(candidates);
    const ingredientMatrix = this.buildIngredientMatrix(candidates);
    const allergenMatrix = this.buildAllergenMatrix(candidates);
    const certificationMatrix = this.buildCertificationMatrix(candidates);

    return {
      ...baseEmpty,
      mode: 'ready',
      canCompare: true,
      isCrossCategoryBlocked: false,
      activeCategory: singleCategory,
      blockedCategories: [],
      validationError:
        missingIds.length > 0
          ? `Note: requested product ID(s) ${missingIds.join(', ')} could not be found and were omitted.`
          : null,
      products,
      scoreMatrix,
      nutritionMatrix,
      ingredientMatrix,
      allergenMatrix,
      certificationMatrix,
    };
  }

  private buildScoreMatrix(
    candidates: FoodComparisonCandidateInput[],
  ): ComparisonScoreRow[] {
    const rows: ComparisonScoreRow[] = [];

    // Overall total score row
    const totalValues = candidates.map((c) => Math.round(c.scoreBreakdown.totalScore));
    const maxTotal = Math.max(...totalValues);
    const minTotal = Math.min(...totalValues);
    const allTotalTied = maxTotal === minTotal;
    const totalLeaders = totalValues.filter((v) => v === maxTotal).length;

    rows.push({
      key: 'total',
      label: 'Overall Quality Score',
      weightLabel: '100%',
      isTotalRow: true,
      allTied: allTotalTied,
      cells: candidates.map((c) => {
        const score = Math.round(c.scoreBreakdown.totalScore);
        const isTop = !allTotalTied && score === maxTotal;
        return {
          productId: c.product.id,
          score,
          weightedContributionFormatted: c.scoreBreakdown.rawWeightedScore.toFixed(1),
          provisional: c.scoreBreakdown.isProvisional,
          isLeader: isTop && totalLeaders === 1,
          isTiedTop: isTop && totalLeaders > 1,
          toneClass:
            score >= 80
              ? 'text-emerald-700 dark:text-emerald-400'
              : score >= 60
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-rose-700 dark:text-rose-400',
        };
      }),
    });

    const firstComponents = candidates[0].scoreBreakdown.components || [];
    for (const templateComp of firstComponents) {
      const pillarScores = candidates.map((c) => {
        const match = c.scoreBreakdown.components.find(
          (comp) => comp.key === templateComp.key,
        );
        return match ? Math.round(match.score) : 0;
      });
      const maxPillar = Math.max(...pillarScores);
      const minPillar = Math.min(...pillarScores);
      const allTied = maxPillar === minPillar;
      const leaderCount = pillarScores.filter((v) => v === maxPillar).length;

      rows.push({
        key: templateComp.key,
        label: templateComp.label,
        weightLabel: `${templateComp.weight}%`,
        isTotalRow: false,
        allTied,
        cells: candidates.map((c) => {
          const comp = c.scoreBreakdown.components.find(
            (item) => item.key === templateComp.key,
          );
          const score = comp ? Math.round(comp.score) : 0;
          const isTop = !allTied && score === maxPillar;
          return {
            productId: c.product.id,
            score,
            weightedContributionFormatted: comp
              ? comp.weightedContributionFormatted
              : '0.0',
            provisional: Boolean(comp?.provisional),
            isLeader: isTop && leaderCount === 1,
            isTiedTop: isTop && leaderCount > 1,
            toneClass:
              score >= 80
                ? 'text-emerald-700 dark:text-emerald-400'
                : score >= 60
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-rose-700 dark:text-rose-400',
          };
        }),
      });
    }

    return rows;
  }

  private buildNutritionMatrix(candidates: FoodComparisonCandidateInput[]) {
    const distinctUnits = Array.from(
      new Set(candidates.map((c) => (c.product.servingUnit || 'g').trim().toLowerCase())),
    );
    const hasMixedUnits = distinctUnits.length > 1;
    const servingBaseSummary = hasMixedUnits
      ? `Standardized per 100 g / 100 ml (each column labels its exact unit base)`
      : `Standardized per 100 ${distinctUnits[0] || 'g'}`;

    let missingDeclarationsTotal = 0;

    const rows: ComparisonNutritionRow[] = STATUTORY_NUTRIENT_SPECS.map((spec) => {
      const rawPerProduct = candidates.map((c) => {
        const value = this.extractNutrientPer100(c.product.nutritionFacts || [], spec);
        if (value === null) missingDeclarationsTotal++;
        return {
          productId: c.product.id,
          unitBase: c.product.servingUnit || 'g',
          value,
        };
      });

      const declaredValues = rawPerProduct
        .map((entry) => entry.value)
        .filter((v): v is number => v !== null);

      const hasDeclaredValues = declaredValues.length > 0;
      const missingCount = rawPerProduct.length - declaredValues.length;

      let targetVal: number | null = null;
      let allTied = false;
      let leaderCount = 0;

      if (declaredValues.length >= 2 && spec.direction !== 'neutral') {
        const minVal = Math.min(...declaredValues);
        const maxVal = Math.max(...declaredValues);
        if (Math.abs(maxVal - minVal) < 0.0001) {
          allTied = true;
        } else {
          targetVal = spec.direction === 'lower' ? minVal : maxVal;
          leaderCount = declaredValues.filter(
            (v) => Math.abs(v - targetVal!) < 0.0001,
          ).length;
        }
      } else if (declaredValues.length === 1 && spec.direction !== 'neutral') {
        // Only one item declared this nutrient: cannot crown a multi-item winner honestly
        allTied = false;
        targetVal = null;
      }

      const cells: ComparisonNutritionCell[] = rawPerProduct.map((entry) => {
        if (entry.value === null) {
          return {
            productId: entry.productId,
            declared: false,
            rawValue: null,
            displayValue: 'Not declared',
            unit: spec.unit,
            perBaseLabel: `per 100 ${entry.unitBase}`,
            isLeader: false,
            isTiedTop: false,
            leaderLabel: null,
          };
        }

        const isTop =
          targetVal !== null && Math.abs(entry.value - targetVal) < 0.0001;
        const formattedNumber =
          spec.decimals === 0
            ? String(Math.round(entry.value))
            : Number(entry.value.toFixed(spec.decimals)).toString();

        return {
          productId: entry.productId,
          declared: true,
          rawValue: entry.value,
          displayValue: `${formattedNumber} ${spec.unit}`,
          unit: spec.unit,
          perBaseLabel: `per 100 ${entry.unitBase}`,
          isLeader: isTop && leaderCount === 1,
          isTiedTop: isTop && leaderCount > 1,
          leaderLabel: isTop
            ? leaderCount > 1
              ? spec.direction === 'lower'
                ? 'Tied lowest'
                : 'Tied highest'
              : spec.direction === 'lower'
                ? 'Lowest'
                : 'Highest'
            : null,
        };
      });

      return {
        key: spec.key,
        label: spec.label,
        unit: spec.unit,
        direction: spec.direction,
        hasDeclaredValues,
        allTied,
        missingCount,
        cells,
      };
    });

    const sugarsRow = rows.find((r) => r.key === 'sugars');
    const proteinRow = rows.find((r) => r.key === 'protein');

    const sugarLeaderCell = sugarsRow?.cells.find((c) => c.isLeader || c.isTiedTop);
    const proteinLeaderCell = proteinRow?.cells.find((c) => c.isLeader || c.isTiedTop);

    const lowestSugarProduct = sugarLeaderCell
      ? candidates.find((c) => c.product.id === sugarLeaderCell.productId)?.product.name ||
        null
      : null;
    const highestProteinProduct = proteinLeaderCell
      ? candidates.find((c) => c.product.id === proteinLeaderCell.productId)?.product
          .name || null
      : null;

    return {
      hasMixedUnits,
      servingBaseSummary,
      rows,
      lowestSugarProduct,
      highestProteinProduct,
      missingDeclarationsTotal,
    };
  }

  private extractNutrientPer100(
    facts: NutritionFact[],
    spec: NutrientSpec,
  ): number | null {
    const match = (facts || []).find((f) => spec.pattern.test(f.nutrient));
    if (match && match.amountPer100g !== null && match.amountPer100g !== undefined) {
      const val = Number(match.amountPer100g);
      return Number.isFinite(val) ? val : null;
    }

    // Salt fallback from sodium declaration (* 2.5)
    if (spec.key === 'salt') {
      const sodiumMatch = (facts || []).find((f) => /sodium/i.test(f.nutrient));
      if (
        sodiumMatch &&
        sodiumMatch.amountPer100g !== null &&
        sodiumMatch.amountPer100g !== undefined
      ) {
        const sodiumVal = Number(sodiumMatch.amountPer100g);
        if (Number.isFinite(sodiumVal)) {
          return Math.round(sodiumVal * 2.5 * 100) / 100;
        }
      }
    }

    return null;
  }

  private normalizeIngredientKey(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildIngredientMatrix(candidates: FoodComparisonCandidateInput[]) {
    // Collect normalized key sets per product
    const normalizedPerProduct = candidates.map((c) => {
      const allItems = [
        ...(c.ingredientReport.recognizedIngredients || []),
        ...(c.ingredientReport.unknownIngredients || []),
      ];
      const keys = new Map<string, string>();
      for (const item of allItems) {
        const key = this.normalizeIngredientKey(item.name);
        if (key && !keys.has(key)) {
          keys.set(key, item.name);
        }
      }
      return { product: c.product, report: c.ingredientReport, allItems, keys };
    });

    // Shared across ALL compared items
    const sharedKeys = new Set<string>();
    const sharedIngredients: string[] = [];
    if (normalizedPerProduct.length > 0) {
      for (const [key, displayName] of normalizedPerProduct[0].keys.entries()) {
        const inAll = normalizedPerProduct.every((entry) => entry.keys.has(key));
        if (inAll) {
          sharedKeys.add(key);
          sharedIngredients.push(displayName);
        }
      }
    }

    const perProduct: ComparisonProductFormulation[] = normalizedPerProduct.map(
      (entry, idx) => {
        const otherKeys = new Set<string>();
        normalizedPerProduct.forEach((other, otherIdx) => {
          if (otherIdx !== idx) {
            other.keys.forEach((_, k) => otherKeys.add(k));
          }
        });

        const uniqueIngredients: string[] = [];
        const allIngredients: ComparisonIngredientChip[] = entry.allItems.map((item) => {
          const normKey = this.normalizeIngredientKey(item.name);
          const isShared = sharedKeys.has(normKey);
          const isUnique = Boolean(normKey) && !otherKeys.has(normKey);
          if (isUnique && !uniqueIngredients.includes(item.name)) {
            uniqueIngredients.push(item.name);
          }
          return {
            name: item.name,
            additiveCode: item.additiveCode || null,
            isAllergen: Boolean(item.isAllergen),
            allergenType: item.allergenType || null,
            hazardLevel: item.hazardLevel,
            isUnknown: Boolean(item.isUnknown),
            isShared,
            isUnique,
          };
        });

        return {
          productId: entry.product.id,
          productName: entry.product.name,
          totalCount: entry.report.counts.total,
          recognizedCount: entry.report.counts.recognized,
          unknownCount: entry.report.counts.unknown,
          coveragePercent: entry.report.counts.coveragePercent,
          safeCount: entry.report.counts.safe,
          cautionCount: entry.report.counts.caution,
          warningCount: entry.report.counts.warning,
          additiveCount: entry.report.counts.additives,
          uniqueIngredients,
          allIngredients,
        };
      },
    );

    // Union of additives across compared items
    const additiveIdentifiers = new Map<string, string>();
    for (const c of candidates) {
      for (const add of c.ingredientReport.additives || []) {
        const label = add.additiveCode
          ? `${add.additiveCode} — ${add.name}`
          : add.name;
        const key = (add.additiveCode || add.name).trim().toLowerCase();
        if (!additiveIdentifiers.has(key)) {
          additiveIdentifiers.set(key, label);
        }
      }
    }

    const additiveRows: ComparisonAdditiveRow[] = Array.from(
      additiveIdentifiers.entries(),
    ).map(([key, displayLabel]) => ({
      codeOrName: displayLabel,
      cells: candidates.map((c) => {
        const match = (c.ingredientReport.additives || []).find(
          (a) => (a.additiveCode || a.name).trim().toLowerCase() === key,
        );
        if (!match) {
          return {
            productId: c.product.id,
            present: false,
            label: 'Not present',
            hazardLevel: 'none',
          };
        }
        return {
          productId: c.product.id,
          present: true,
          label:
            match.hazardLevel === 'warning'
              ? 'Present (Warning)'
              : match.hazardLevel === 'caution'
                ? 'Present (Caution)'
                : 'Present (Safe)',
          hazardLevel: match.hazardLevel,
        };
      }),
    }));

    return {
      sharedIngredients,
      perProduct,
      additiveRows,
    };
  }

  private buildAllergenMatrix(candidates: FoodComparisonCandidateInput[]) {
    const allergenMap = new Map<string, string>();
    for (const c of candidates) {
      for (const ing of c.ingredientReport.allergens || []) {
        const label = (ing.allergenType || ing.name).trim();
        const key = label.toLowerCase();
        if (key && !allergenMap.has(key)) {
          allergenMap.set(key, label);
        }
      }
    }

    const rows: ComparisonAllergenRow[] = Array.from(allergenMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, allergenLabel]) => ({
        allergenLabel,
        cells: candidates.map((c) => {
          const matches = (c.ingredientReport.allergens || []).filter(
            (ing) => (ing.allergenType || ing.name).trim().toLowerCase() === key,
          );
          const matchedUserAllergies = (c.userConflict?.matchedAllergies || []).map((a) =>
            a.toLowerCase(),
          );
          const personalMatch =
            matches.length > 0 &&
            matchedUserAllergies.some(
              (ua) => ua === key || key.includes(ua) || ua.includes(key),
            );
          return {
            productId: c.product.id,
            declared: matches.length > 0,
            ingredientNames: matches.map((m) => m.name),
            personalMatch,
          };
        }),
      }));

    const consumerSafetyActive = candidates.some(
      (c) => Boolean(c.userConflict?.profileConfigured),
    );

    const consumerCells: ComparisonConsumerConflictCell[] = candidates.map((c) => {
      const uc = c.userConflict;
      if (!uc || !uc.profileConfigured) {
        return {
          productId: c.product.id,
          profileConfigured: false,
          hasAllergenConflict: false,
          hasDietaryConflict: false,
          hasNutritionWarning: false,
          isSafeForUser: false,
          summaryLabel: 'No dietary profile active',
          tone: 'neutral',
        };
      }

      if (uc.hasAllergenConflict) {
        return {
          productId: c.product.id,
          profileConfigured: true,
          hasAllergenConflict: true,
          hasDietaryConflict: uc.hasDietaryConflict,
          hasNutritionWarning: uc.hasNutritionWarning,
          isSafeForUser: false,
          summaryLabel: `Allergen alert (${uc.matchedAllergies.join(', ')})`,
          tone: 'danger',
        };
      }

      if (uc.hasDietaryConflict) {
        return {
          productId: c.product.id,
          profileConfigured: true,
          hasAllergenConflict: false,
          hasDietaryConflict: true,
          hasNutritionWarning: uc.hasNutritionWarning,
          isSafeForUser: false,
          summaryLabel: `Dietary mismatch (${uc.dietaryMismatches.join(', ')})`,
          tone: 'caution',
        };
      }

      if (uc.hasNutritionWarning) {
        return {
          productId: c.product.id,
          profileConfigured: true,
          hasAllergenConflict: false,
          hasDietaryConflict: false,
          hasNutritionWarning: true,
          isSafeForUser: uc.isSafeForUser,
          summaryLabel: 'Nutrition threshold note',
          tone: 'info',
        };
      }

      return {
        productId: c.product.id,
        profileConfigured: true,
        hasAllergenConflict: false,
        hasDietaryConflict: false,
        hasNutritionWarning: false,
        isSafeForUser: true,
        summaryLabel: 'Clear for your dietary profile',
        tone: 'safe',
      };
    });

    return {
      hasAnyAllergens: rows.length > 0,
      rows,
      consumerSafetyActive,
      consumerCells,
    };
  }

  private buildCertificationMatrix(
    candidates: FoodComparisonCandidateInput[],
  ): ComparisonCertificationCell[] {
    return candidates.map((c) => {
      const verComp = c.scoreBreakdown.components.find(
        (comp) => comp.key === 'verification',
      );
      const cert = c.certificationSummary;
      const licenceLabel = cert.licenceNumber
        ? `${cert.licenceNumber} (${cert.licenceAuthority || 'Registry'} · ${cert.licenceStatus || 'valid'})`
        : 'No verified licence linked';

      return {
        productId: c.product.id,
        productName: c.product.name,
        verificationScore: verComp ? Math.round(verComp.score) : 50,
        approvedCount: cert.approvedCount,
        pendingCount: cert.pendingCount,
        rejectedCount: cert.rejectedCount,
        docLabels: cert.docLabels,
        hasApprovedDocs: cert.approvedCount > 0,
        licenceLabel,
        licenceValid: cert.licenceValid,
        verificationStanding: cert.verificationStanding,
      };
    });
  }
}
