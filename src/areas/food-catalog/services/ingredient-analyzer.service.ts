// Feature F03: Ingredient, Additive, and Allergen Analysis Engine
import { Injectable } from '@nestjs/common';
import {
  HazardLevel,
  Ingredient,
  IngredientAnalysisStatus,
} from '../models/ingredient.entity';
import { FoodRule } from '../../admin/models/food-rule.entity';

export interface IngredientAnalysisInput {
  name: string;
  isAllergen?: boolean;
  allergenType?: string | null;
  additiveCode?: string | null;
  hazardLevel?: HazardLevel;
  explanation?: string | null;
}

export interface AnalyzedIngredientResult {
  name: string;
  isAllergen: boolean;
  allergenType: string | null;
  additiveCode: string | null;
  hazardLevel: HazardLevel;
  explanation: string;
  analysisStatus: IngredientAnalysisStatus;
  matchedRuleId: number | null;
  ruleSource: string | null;
  fdaStatus: string | null;
  euStatus: string | null;
  matchedRuleNames: string[];
  categoryRuleApplied: boolean;
}

export interface IngredientAnalysisReport {
  totalCount: number;
  recognizedIngredients: AnalyzedIngredientViewItem[];
  unknownIngredients: AnalyzedIngredientViewItem[];
  allergens: AnalyzedIngredientViewItem[];
  additives: AnalyzedIngredientViewItem[];
  counts: {
    total: number;
    recognized: number;
    unknown: number;
    safe: number;
    caution: number;
    warning: number;
    allergens: number;
    additives: number;
    coveragePercent: number;
  };
  hasUnknownIngredients: boolean;
  hasWarnings: boolean;
  hasCautions: boolean;
  categoryNotes: string[];
}

export interface AnalyzedIngredientViewItem {
  id?: number;
  name: string;
  isAllergen: boolean;
  allergenType: string | null;
  additiveCode: string | null;
  hazardLevel: HazardLevel;
  explanation: string;
  analysisStatus: IngredientAnalysisStatus;
  matchedRuleId: number | null;
  ruleSource: string;
  fdaStatus: string;
  euStatus: string;
  isUnknown: boolean;
  isWarning: boolean;
  isCaution: boolean;
  isSafe: boolean;
}

const HAZARD_RANK: Record<HazardLevel, number> = {
  safe: 1,
  caution: 2,
  warning: 3,
};

const UNKNOWN_DEFAULT_EXPLANATION =
  'Unclassified ingredient — no matching entry found in the administrative food rule base. Not assumed safe until verified by regulatory review.';

const UNKNOWN_RULE_SOURCE = 'Unclassified — Pending Administrative Rule Review';
const UNKNOWN_REG_STATUS = 'Unverified in Rule Base';

/**
 * Pure Domain Analysis Engine for Feature F03.
 * Zero database dependencies: deterministically parses declared ingredients,
 * extracts additive codes (E-numbers / INS / CI), evaluates against the
 * admin-maintained FoodRule base + category rules, and explicitly separates
 * unknown/unclassified ingredients.
 */
@Injectable()
export class IngredientAnalyzerService {
  /**
   * Split comma/semicolon-separated ingredient declarations while preserving
   * commas inside nested parentheses or square brackets.
   * Example: "Oat Base (Water, Oats 10%), Sea Salt" -> ["Oat Base (Water, Oats 10%)", "Sea Salt"]
   */
  splitRawIngredientList(raw?: string): string[] {
    if (!raw || !raw.trim()) {
      return [];
    }

    const items: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '(' || ch === '[') {
        depth++;
        current += ch;
      } else if (ch === ')' || ch === ']') {
        depth = Math.max(0, depth - 1);
        current += ch;
      } else if ((ch === ',' || ch === ';' || ch === '\n') && depth === 0) {
        const cleaned = current.trim().replace(/\.$/, '').trim();
        if (cleaned) items.push(cleaned);
        current = '';
      } else {
        current += ch;
      }
    }

    const tail = current.trim().replace(/\.$/, '').trim();
    if (tail) items.push(tail);

    return items;
  }

  /**
   * Extract additive identifiers (e.g. E150d, E340, INS 635 -> E635, CI 12055) from text.
   */
  extractAdditiveCodes(text: string): string[] {
    if (!text) return [];
    const codes: string[] = [];

    const eRegex = /\b(?:E|INS)[-\s]?(\d{3,4})([a-z])?\b/gi;
    let match: RegExpExecArray | null;
    while ((match = eRegex.exec(text)) !== null) {
      const normalized = `E${match[1]}${match[2] ? match[2].toLowerCase() : ''}`;
      if (!codes.includes(normalized)) {
        codes.push(normalized);
      }
    }

    const ciRegex = /\bCI[-\s]?(\d{5})\b/gi;
    while ((match = ciRegex.exec(text)) !== null) {
      const normalized = `CI ${match[1]}`;
      if (!codes.includes(normalized)) {
        codes.push(normalized);
      }
    }

    return codes;
  }

  /**
   * Parse raw ingredient text into structured DTO-ready objects, optionally applying active rules.
   */
  parseRawIngredients(
    raw?: string,
    activeRules: FoodRule[] = [],
    productCategory?: string,
  ): AnalyzedIngredientResult[] {
    const tokens = this.splitRawIngredientList(raw);
    if (tokens.length === 0) return [];

    return tokens.map((name) =>
      this.analyzeSingleIngredient({ name }, activeRules, productCategory),
    );
  }

  /**
   * Analyze a batch of declared ingredient inputs against the active FoodRule base.
   */
  analyzeDeclaredIngredients(
    ingredients: IngredientAnalysisInput[],
    activeRules: FoodRule[],
    productCategory?: string,
  ): AnalyzedIngredientResult[] {
    if (!ingredients || ingredients.length === 0) return [];
    return ingredients.map((ing) =>
      this.analyzeSingleIngredient(ing, activeRules, productCategory),
    );
  }

  /**
   * Analyze a single ingredient against active FoodRule definitions and category scope.
   */
  analyzeSingleIngredient(
    input: IngredientAnalysisInput,
    activeRules: FoodRule[] = [],
    productCategory?: string,
  ): AnalyzedIngredientResult {
    const cleanName = (input.name || '').trim();
    const extractedCodes = this.extractAdditiveCodes(cleanName);
    const inputCodes = [...extractedCodes];
    if (input.additiveCode && !inputCodes.includes(input.additiveCode.trim())) {
      inputCodes.unshift(input.additiveCode.trim());
    }

    const primaryInputCode = inputCodes.length > 0 ? inputCodes[0] : null;
    const applicableRules = this.filterApplicableRules(activeRules, productCategory);
    const matchedRules = this.findMatchingRules(cleanName, inputCodes, applicableRules);

    if (matchedRules.length === 0) {
      // Fallback heuristic detection only for standalone controller parsing when no rule base was supplied
      const fallbackAllergen = this.detectBaselineAllergenOnlyWhenRulesUnavailable(
        cleanName,
        activeRules.length === 0,
      );

      const isAllergen = Boolean(input.isAllergen || fallbackAllergen.isAllergen);
      const allergenType = input.allergenType || fallbackAllergen.allergenType || null;
      const fallbackExplanation =
        input.explanation && input.explanation.trim()
          ? input.explanation.trim()
          : UNKNOWN_DEFAULT_EXPLANATION;

      // Never assume unknown ingredients are safe when an active rule base is enforced
      const hazardLevel: HazardLevel =
        input.hazardLevel === 'warning'
          ? 'warning'
          : activeRules.length > 0
            ? 'caution'
            : input.hazardLevel || 'caution';

      return {
        name: cleanName,
        isAllergen,
        allergenType,
        additiveCode: primaryInputCode,
        hazardLevel,
        explanation: fallbackExplanation,
        analysisStatus: 'unknown',
        matchedRuleId: null,
        ruleSource: UNKNOWN_RULE_SOURCE,
        fdaStatus: UNKNOWN_REG_STATUS,
        euStatus: UNKNOWN_REG_STATUS,
        matchedRuleNames: [],
        categoryRuleApplied: false,
      };
    }

    // Aggregate matched rules deterministically:
    // Priority order: highest hazardLevel > category_restriction > warning > caution > allergen > additive > ingredient
    const sorted = [...matchedRules].sort((a, b) => {
      const hazDiff = HAZARD_RANK[b.hazardLevel] - HAZARD_RANK[a.hazardLevel];
      if (hazDiff !== 0) return hazDiff;
      const scopeDiff = (b.categoryScope ? 1 : 0) - (a.categoryScope ? 1 : 0);
      if (scopeDiff !== 0) return scopeDiff;
      return this.ruleTypeWeight(b.ruleType) - this.ruleTypeWeight(a.ruleType);
    });

    const primary = sorted[0];
    const highestHazard = primary.hazardLevel;

    const allergenRule = sorted.find(
      (r) => r.ruleType === 'allergen' || Boolean(r.allergenType),
    );
    const additiveRule = sorted.find((r) => Boolean(r.additiveCode));
    const categoryRule = sorted.find((r) => Boolean(r.categoryScope));

    const isAllergen = Boolean(allergenRule || input.isAllergen);
    const allergenType = allergenRule?.allergenType || input.allergenType || null;
    const additiveCode =
      additiveRule?.additiveCode || primaryInputCode || null;

    // Compose clear rule-based explanation combining distinct matched rationales
    const explanations: string[] = [];
    for (const r of sorted) {
      if (r.explanation && !explanations.includes(r.explanation.trim())) {
        explanations.push(r.explanation.trim());
      }
    }
    if (
      input.explanation &&
      input.explanation.trim() &&
      !explanations.some((e) => e.toLowerCase() === input.explanation!.trim().toLowerCase()) &&
      explanations.length === 0
    ) {
      explanations.push(input.explanation.trim());
    }

    const combinedExplanation = explanations.join(' | ');
    const ruleSource = categoryRule
      ? `${primary.source} (Category Rule: ${categoryRule.categoryScope})`
      : primary.source || 'TrueLabel Regulatory Rule Base';

    return {
      name: cleanName,
      isAllergen,
      allergenType,
      additiveCode,
      hazardLevel: highestHazard,
      explanation: combinedExplanation || `${primary.name} matched regulatory rule.`,
      analysisStatus: 'matched',
      matchedRuleId: primary.id || null,
      ruleSource,
      fdaStatus:
        primary.fdaStatus ||
        (highestHazard === 'safe' ? 'GRAS Verified' : 'Monitored / Restricted'),
      euStatus:
        primary.euStatus ||
        (additiveCode ? `EU Evaluated (${additiveCode})` : 'EU Evaluated'),
      matchedRuleNames: sorted.map((r) => r.name),
      categoryRuleApplied: Boolean(categoryRule),
    };
  }

  /**
   * Build structured view-model report separating rule-verified ingredients from unknown/unclassified items.
   */
  buildProductAnalysisReport(
    ingredients: Ingredient[] = [],
    activeRules: FoodRule[] = [],
    productCategory?: string,
  ): IngredientAnalysisReport {
    const hasRules = activeRules.length > 0;
    const items: AnalyzedIngredientViewItem[] = (ingredients || []).map((ing) => {
      // If rules are supplied and ingredient lacks persisted match metadata (or needs live view enrichment),
      // use persisted F03 metadata when already matched, otherwise analyze cleanly.
      const usePersistedMatch =
        ing.analysisStatus === 'matched' ||
        (!hasRules && Boolean(ing.analysisStatus));

      if (usePersistedMatch && ing.analysisStatus === 'matched') {
        const hazard: HazardLevel = ing.hazardLevel || 'safe';
        return {
          id: ing.id,
          name: ing.name,
          isAllergen: Boolean(ing.isAllergen),
          allergenType: ing.allergenType || null,
          additiveCode: ing.additiveCode || null,
          hazardLevel: hazard,
          explanation:
            ing.explanation ||
            `Classified as ${hazard} tier under ${ing.ruleSource || 'TrueLabel Rule Base'}.`,
          analysisStatus: 'matched',
          matchedRuleId: ing.matchedRuleId ?? null,
          ruleSource: ing.ruleSource || 'TrueLabel Regulatory Rule Base',
          fdaStatus:
            ing.fdaStatus ||
            (hazard === 'safe' ? 'GRAS Verified' : 'Restricted / Monitored'),
          euStatus:
            ing.euStatus ||
            (ing.additiveCode ? `EU Authorized (${ing.additiveCode})` : 'EU Verified'),
          isUnknown: false,
          isWarning: hazard === 'warning',
          isCaution: hazard === 'caution',
          isSafe: hazard === 'safe',
        };
      }

      if (hasRules) {
        const analyzed = this.analyzeSingleIngredient(ing, activeRules, productCategory);
        const isUnknown = analyzed.analysisStatus === 'unknown';
        return {
          id: ing.id,
          name: analyzed.name,
          isAllergen: analyzed.isAllergen,
          allergenType: analyzed.allergenType,
          additiveCode: analyzed.additiveCode,
          hazardLevel: analyzed.hazardLevel,
          explanation: analyzed.explanation,
          analysisStatus: analyzed.analysisStatus,
          matchedRuleId: analyzed.matchedRuleId,
          ruleSource: analyzed.ruleSource || UNKNOWN_RULE_SOURCE,
          fdaStatus: analyzed.fdaStatus || UNKNOWN_REG_STATUS,
          euStatus: analyzed.euStatus || UNKNOWN_REG_STATUS,
          isUnknown,
          isWarning: !isUnknown && analyzed.hazardLevel === 'warning',
          isCaution: !isUnknown && analyzed.hazardLevel === 'caution',
          isSafe: !isUnknown && analyzed.hazardLevel === 'safe',
        };
      }

      // Unknown / unclassified persisted item without rule re-eval
      return {
        id: ing.id,
        name: ing.name,
        isAllergen: Boolean(ing.isAllergen),
        allergenType: ing.allergenType || null,
        additiveCode: ing.additiveCode || null,
        hazardLevel: ing.hazardLevel || 'caution',
        explanation: ing.explanation || UNKNOWN_DEFAULT_EXPLANATION,
        analysisStatus: 'unknown',
        matchedRuleId: null,
        ruleSource: ing.ruleSource || UNKNOWN_RULE_SOURCE,
        fdaStatus: ing.fdaStatus || UNKNOWN_REG_STATUS,
        euStatus: ing.euStatus || UNKNOWN_REG_STATUS,
        isUnknown: true,
        isWarning: false,
        isCaution: false,
        isSafe: false,
      };
    });

    const recognizedIngredients = items.filter((i) => !i.isUnknown);
    const unknownIngredients = items.filter((i) => i.isUnknown);
    const allergens = items.filter((i) => i.isAllergen);
    const additives = items.filter((i) => Boolean(i.additiveCode));

    const safeCount = recognizedIngredients.filter((i) => i.isSafe).length;
    const cautionCount = recognizedIngredients.filter((i) => i.isCaution).length;
    const warningCount = recognizedIngredients.filter((i) => i.isWarning).length;
    const total = items.length;
    const coveragePercent =
      total > 0 ? Math.round((recognizedIngredients.length / total) * 100) : 100;

    const categoryNotes = recognizedIngredients
      .filter((i) => i.ruleSource.includes('Category Rule:'))
      .map((i) => `${i.name}: ${i.explanation}`);

    return {
      totalCount: total,
      recognizedIngredients,
      unknownIngredients,
      allergens,
      additives,
      counts: {
        total,
        recognized: recognizedIngredients.length,
        unknown: unknownIngredients.length,
        safe: safeCount,
        caution: cautionCount,
        warning: warningCount,
        allergens: allergens.length,
        additives: additives.length,
        coveragePercent,
      },
      hasUnknownIngredients: unknownIngredients.length > 0,
      hasWarnings: warningCount > 0,
      hasCautions: cautionCount > 0,
      categoryNotes,
    };
  }

  /**
   * Build standardized Nutrition Facts array from HTML form submission body.
   */
  buildNutritionFactsFromForm(body: Record<string, any>) {
    const servingSize = Number(body?.servingSize) || 100;

    const specs = [
      { key: 'nutrition_energy', name: 'Energy', unit: 'kcal' },
      { key: 'nutrition_fat', name: 'Fat', unit: 'g' },
      { key: 'nutrition_saturatedFat', name: 'Saturated Fat', unit: 'g' },
      { key: 'nutrition_carbohydrates', name: 'Carbohydrates', unit: 'g' },
      { key: 'nutrition_sugars', name: 'Sugars', unit: 'g' },
      { key: 'nutrition_fiber', name: 'Fiber', unit: 'g' },
      { key: 'nutrition_protein', name: 'Protein', unit: 'g' },
      { key: 'nutrition_salt', name: 'Salt', unit: 'g' },
    ];

    return specs.map((spec) => {
      const rawVal = body?.[spec.key];
      const amountPer100g =
        rawVal !== undefined && rawVal !== '' ? Number(rawVal) : 0;
      const amountPerServing =
        Math.round(((amountPer100g * servingSize) / 100) * 10) / 10;
      return {
        nutrient: spec.name,
        amountPer100g: Number.isNaN(amountPer100g) ? 0 : amountPer100g,
        amountPerServing,
        unit: spec.unit,
      };
    });
  }

  private filterApplicableRules(
    rules: FoodRule[],
    productCategory?: string,
  ): FoodRule[] {
    const normalizedCat = (productCategory || '').trim().toLowerCase();
    return (rules || []).filter((rule) => {
      if (rule.isActive === false) return false;
      if (!rule.categoryScope || !rule.categoryScope.trim()) return true;
      if (!normalizedCat) return false;
      const scopeLower = rule.categoryScope.trim().toLowerCase();
      return (
        normalizedCat === scopeLower ||
        normalizedCat.includes(scopeLower) ||
        scopeLower.includes(normalizedCat)
      );
    });
  }

  private findMatchingRules(
    ingredientName: string,
    inputCodes: string[],
    rules: FoodRule[],
  ): FoodRule[] {
    const nameLower = ingredientName.toLowerCase();
    const normalizedCodes = inputCodes.map((c) => c.toLowerCase());
    const matched: FoodRule[] = [];

    for (const rule of rules) {
      let isMatch = false;

      // 1. Exact Additive Code match (e.g. E150d, E340, CI 12055)
      if (rule.additiveCode) {
        const ruleCodeLower = rule.additiveCode.trim().toLowerCase();
        if (normalizedCodes.includes(ruleCodeLower)) {
          isMatch = true;
        }
      }

      // 2. Pattern / Keyword match with safe boundary checks
      if (!isMatch && rule.pattern) {
        const terms = rule.pattern
          .split(/[,;\n]/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        for (const term of terms) {
          if (this.matchesTermSafely(nameLower, term, rule)) {
            isMatch = true;
            break;
          }
        }
      }

      // 3. Fallback exact canonical rule name match
      if (!isMatch && rule.name) {
        const ruleNameLower = rule.name.trim().toLowerCase();
        if (this.matchesTermSafely(nameLower, ruleNameLower, rule)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matched.push(rule);
      }
    }

    return matched;
  }

  private matchesTermSafely(
    ingredientLower: string,
    termLower: string,
    rule: FoodRule,
  ): boolean {
    if (!termLower) return false;

    // Guard against plant milk false-positives on dairy Milk allergen rules
    if (
      rule.allergenType?.toLowerCase() === 'milk' &&
      (termLower === 'milk' || termLower === 'milks')
    ) {
      if (
        /\b(almond|oat|soy|soya|coconut|rice|cashew|hemp)\s*milk\b/i.test(
          ingredientLower,
        ) ||
        /\b(almondmilk|soymilk|oatmilk)\b/i.test(ingredientLower)
      ) {
        // Still allow if another dairy word like butter/cheese/whey/casein/cow milk exists
        return /\b(cow milk|skim|nonfat|whole milk|dairy|whey|casein|butter|cheese|cream|yogurt|lactose)\b/i.test(
          ingredientLower,
        );
      }
    }

    const escaped = termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRegex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
    return boundaryRegex.test(ingredientLower);
  }

  private ruleTypeWeight(ruleType: string): number {
    switch (ruleType) {
      case 'category_restriction':
        return 4;
      case 'allergen':
        return 3;
      case 'additive':
        return 2;
      default:
        return 1;
    }
  }

  private detectBaselineAllergenOnlyWhenRulesUnavailable(
    name: string,
    allowFallback: boolean,
  ): { isAllergen: boolean; allergenType?: string } {
    if (!allowFallback) return { isAllergen: false };
    const lower = name.toLowerCase();
    if (/peanut|groundnut/.test(lower)) return { isAllergen: true, allergenType: 'Peanut' };
    if (
      /\b(cow milk|whole cow milk|nonfat milk|skim milk|skimmed milk|dairy|cheese|cream|whey|casein|butter|lactose|yogurt)\b/.test(
        lower,
      )
    ) {
      return { isAllergen: true, allergenType: 'Milk' };
    }
    if (/\b(wheat|gluten|barley|rye|spelt)\b/.test(lower)) {
      return { isAllergen: true, allergenType: 'Gluten' };
    }
    if (/\b(soy|soya|soybean|soybeans)\b/.test(lower)) {
      return { isAllergen: true, allergenType: 'Soy' };
    }
    if (/\b(almond|almonds|walnut|cashew|hazelnut|hazelnuts|pecan|pistachio|macadamia|tree nut)\b/.test(lower)) {
      return { isAllergen: true, allergenType: 'Tree Nut' };
    }
    if (/\b(egg|eggs|albumin)\b/.test(lower)) return { isAllergen: true, allergenType: 'Egg' };
    if (/\bcelery\b/.test(lower)) return { isAllergen: true, allergenType: 'Celery' };
    if (/\bsesame\b/.test(lower)) return { isAllergen: true, allergenType: 'Sesame' };
    return { isAllergen: false };
  }
}
