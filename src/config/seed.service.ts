import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../areas/identity/models/user.entity';
import { FoodProduct } from '../areas/food-catalog/models/food-product.entity';
import { Ingredient } from '../areas/food-catalog/models/ingredient.entity';
import { NutritionFact } from '../areas/food-catalog/models/nutrition-fact.entity';
import { PreferenceProfile } from '../areas/personal-food/models/preference-profile.entity';
import { FoodSafetyDocument } from '../areas/food-safety/models/food-safety-document.entity';
import { ManufacturerLicence } from '../areas/food-safety/models/manufacturer-licence.entity';
import { FoodReview } from '../areas/community/models/food-review.entity';
import { FoodReport } from '../areas/community/models/food-report.entity';
import { FoodRule } from '../areas/admin/models/food-rule.entity';
import { CatalogService } from '../areas/food-catalog/services/catalog.service';
import { IngredientAnalyzerService } from '../areas/food-catalog/services/ingredient-analyzer.service';
import {
  SEED_USERS,
  SEED_PREFERENCES,
  SEED_FOOD_PRODUCTS,
  SEED_BANNED_PRODUCTS,
  SEED_MANUFACTURER_LICENCES,
  SEED_SAFETY_DOCUMENTS,
  SEED_REVIEWS,
  SEED_REPORTS,
  SEED_FOOD_RULES,
  SeedProductDefinition,
} from './seeds';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FoodProduct)
    private readonly productRepo: Repository<FoodProduct>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(NutritionFact)
    private readonly nutritionRepo: Repository<NutritionFact>,
    @InjectRepository(PreferenceProfile)
    private readonly preferenceRepo: Repository<PreferenceProfile>,
    @InjectRepository(FoodSafetyDocument)
    private readonly documentRepo: Repository<FoodSafetyDocument>,
    @InjectRepository(ManufacturerLicence)
    private readonly licenceRepo: Repository<ManufacturerLicence>,
    @InjectRepository(FoodReview)
    private readonly reviewRepo: Repository<FoodReview>,
    @InjectRepository(FoodReport)
    private readonly reportRepo: Repository<FoodReport>,
    @Optional()
    @InjectRepository(FoodRule)
    private readonly foodRuleRepo?: Repository<FoodRule>,
    @Optional()
    private readonly catalogService?: CatalogService,
    @Optional()
    private readonly ingredientAnalyzer?: IngredientAnalyzerService,
  ) {}

  /**
   * Dedicated entrypoint to execute full database seeding.
   * Invoked explicitly via dedicated CLI command (npm run seed).
   */
  async runSeed(): Promise<void> {
    this.logger.log('Starting TrueLabel modular curated seed synchronization...');
    await this.cleanLegacyDemoProducts();
    await this.seedUsers();
    const activeRules = await this.seedFoodRules();
    await this.seedFoodProducts(activeRules);
    await this.seedPreferences();
    await this.seedManufacturerLicences();
    await this.seedFoodSafetyDocuments();
    await this.seedCommunityReviewsAndReports();
    this.logger.log('TrueLabel modular curated seed synchronization completed successfully.');
  }

  /**
   * Seed administrative food analysis rules (Feature F03) idempotently by name + categoryScope.
   */
  private async seedFoodRules(): Promise<FoodRule[]> {
    if (!this.foodRuleRepo) {
      this.logger.warn('FoodRule repository not injected; skipping food rule seeding.');
      return [];
    }

    const existingRules = await this.foodRuleRepo.find();
    for (const def of SEED_FOOD_RULES) {
      const targetScope = def.categoryScope?.trim() || null;
      const existing = existingRules.find(
        (r) =>
          r.name.toLowerCase() === def.name.toLowerCase() &&
          (r.categoryScope || null) === targetScope,
      );

      if (!existing) {
        const created = await this.foodRuleRepo.save(
          this.foodRuleRepo.create({
            name: def.name,
            pattern: def.pattern,
            ruleType: def.ruleType,
            additiveCode: def.additiveCode || null,
            allergenType: def.allergenType || null,
            categoryScope: targetScope,
            hazardLevel: def.hazardLevel,
            fdaStatus: def.fdaStatus,
            euStatus: def.euStatus,
            explanation: def.explanation,
            source: def.source,
            isActive: def.isActive ?? true,
          }),
        );
        existingRules.push(created);
      } else {
        existing.pattern = def.pattern;
        existing.ruleType = def.ruleType;
        existing.additiveCode = def.additiveCode || null;
        existing.allergenType = def.allergenType || null;
        existing.hazardLevel = def.hazardLevel;
        existing.fdaStatus = def.fdaStatus;
        existing.euStatus = def.euStatus;
        existing.explanation = def.explanation;
        existing.source = def.source;
        if (def.isActive !== undefined) {
          existing.isActive = def.isActive;
        }
        await this.foodRuleRepo.save(existing);
      }
    }

    this.logger.log(`Synchronized ${SEED_FOOD_RULES.length} F03 regulatory food analysis rules.`);
    return this.foodRuleRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Purge legacy placeholder barcodes if present in database.
   */
  private async cleanLegacyDemoProducts(): Promise<void> {
    const legacyBarcodes = ['9312345678901', '8901234567891', '5201234567892', '7612345678903'];
    for (const barcode of legacyBarcodes) {
      const legacy = await this.productRepo.findOne({ where: { barcode } });
      if (legacy) {
        await this.productRepo.remove(legacy);
        this.logger.log(`Purged legacy placeholder product: ${legacy.name} (${barcode})`);
      }
    }
  }

  /**
   * Seed authentic users across all 4 system roles (Consumers, Manufacturers, Inspectors, Admins).
   */
  private async seedUsers(): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    for (const u of SEED_USERS) {
      const existing = await this.userRepo.findOne({ where: { email: u.email } });
      if (!existing) {
        await this.userRepo.save(
          this.userRepo.create({
            name: u.name,
            email: u.email,
            role: u.role,
            passwordHash,
            isVerified: u.isVerified ?? true,
          }),
        );
      } else {
        let changed = false;
        if (existing.name !== u.name) {
          existing.name = u.name;
          changed = true;
        }
        if (existing.role !== u.role) {
          existing.role = u.role;
          changed = true;
        }
        if (changed) {
          await this.userRepo.save(existing);
        }
      }
    }
    this.logger.log(`Synchronized ${SEED_USERS.length} system users across all roles.`);
  }

  /**
   * Seed curated food catalog across all 7 categories (active & banned items),
   * then evaluate all declared ingredients against the active F03 FoodRule base.
   */
  private async seedFoodProducts(activeRules: FoodRule[] = []): Promise<void> {
    const defaultManufacturer = await this.userRepo.findOne({
      where: { email: 'manufacturer@truelabel.demo' },
    });
    const adminUser = await this.userRepo.findOne({
      where: { email: 'admin@truelabel.demo' },
    });
    const defaultMfgId = defaultManufacturer?.id || 1;

    // Build manufacturer email to user map for fast association
    const allUsers = await this.userRepo.find({ select: ['id', 'email', 'role'] });
    const userEmailMap = new Map<string, User>();
    for (const u of allUsers) {
      userEmailMap.set(u.email.toLowerCase(), u);
    }

    const analyzer = this.ingredientAnalyzer || new IngredientAnalyzerService();

    const allProducts: SeedProductDefinition[] = [
      ...SEED_FOOD_PRODUCTS,
      ...SEED_BANNED_PRODUCTS,
    ];

    for (const prodData of allProducts) {
      let mfgId = defaultMfgId;
      if (prodData.manufacturerEmail) {
        const foundMfg = userEmailMap.get(prodData.manufacturerEmail.toLowerCase());
        if (foundMfg) {
          mfgId = foundMfg.id;
        }
      }

      const existing = await this.productRepo.findOne({
        where: { barcode: prodData.barcode },
        relations: ['ingredients', 'nutritionFacts'],
      });

      const analyzedIngredients = analyzer.analyzeDeclaredIngredients(
        prodData.ingredients,
        activeRules,
        prodData.category,
      );

      if (!existing) {
        const product = await this.productRepo.save(
          this.productRepo.create({
            name: prodData.name,
            brand: prodData.brand,
            category: prodData.category,
            barcode: prodData.barcode,
            description: prodData.description,
            servingSize: prodData.servingSize,
            servingUnit: prodData.servingUnit,
            status: prodData.status,
            qualityScore: prodData.qualityScore,
            manufacturerId: mfgId,
            dietaryTags: prodData.dietaryTags,
            banReason: prodData.banReason || null,
            bannedAt: prodData.bannedAt || null,
            bannedBy: prodData.status === 'banned' ? (adminUser?.id || null) : null,
          }),
        );

        // Save declared ingredients with persisted F03 classification
        const ingredientEntities = analyzedIngredients.map((ing) =>
          this.ingredientRepo.create({
            name: ing.name,
            isAllergen: ing.isAllergen,
            allergenType: ing.allergenType || (null as any),
            additiveCode: ing.additiveCode || (null as any),
            hazardLevel: ing.hazardLevel,
            explanation: ing.explanation,
            analysisStatus: ing.analysisStatus,
            matchedRuleId: ing.matchedRuleId,
            ruleSource: ing.ruleSource,
            fdaStatus: ing.fdaStatus,
            euStatus: ing.euStatus,
            product,
          }),
        );
        await this.ingredientRepo.save(ingredientEntities);

        // Save official nutrition facts
        const factEntities = prodData.nutritionFacts.map((fact) =>
          this.nutritionRepo.create({
            nutrient: fact.nutrient,
            amountPer100g: fact.amountPer100g,
            amountPerServing: fact.amountPerServing || (null as any),
            unit: fact.unit,
            dailyValuePercentage: fact.dailyValuePercentage || (null as any),
            product,
          }),
        );
        await this.nutritionRepo.save(factEntities);

        this.logger.log(`Seeded new product: ${product.brand} ${product.name} [${product.barcode}] (${product.status})`);
      } else {
        // Idempotently update product attributes
        existing.name = prodData.name;
        existing.brand = prodData.brand;
        existing.category = prodData.category;
        existing.description = prodData.description;
        existing.servingSize = prodData.servingSize;
        existing.servingUnit = prodData.servingUnit;
        existing.status = prodData.status;
        existing.qualityScore = prodData.qualityScore;
        existing.dietaryTags = prodData.dietaryTags;
        existing.manufacturerId = mfgId;
        if (prodData.banReason) existing.banReason = prodData.banReason;
        if (prodData.bannedAt) existing.bannedAt = prodData.bannedAt;
        if (prodData.status === 'banned' && !existing.bannedBy) {
          existing.bannedBy = adminUser?.id || null;
        }
        await this.productRepo.save(existing);

        // If ingredients are missing, populate them
        if (!existing.ingredients || existing.ingredients.length === 0) {
          const ingredientEntities = analyzedIngredients.map((ing) =>
            this.ingredientRepo.create({
              name: ing.name,
              isAllergen: ing.isAllergen,
              allergenType: ing.allergenType || (null as any),
              additiveCode: ing.additiveCode || (null as any),
              hazardLevel: ing.hazardLevel,
              explanation: ing.explanation,
              analysisStatus: ing.analysisStatus,
              matchedRuleId: ing.matchedRuleId,
              ruleSource: ing.ruleSource,
              fdaStatus: ing.fdaStatus,
              euStatus: ing.euStatus,
              product: existing,
            }),
          );
          await this.ingredientRepo.save(ingredientEntities);
        }

        // If nutrition facts are missing, populate them
        if (!existing.nutritionFacts || existing.nutritionFacts.length === 0) {
          const factEntities = prodData.nutritionFacts.map((fact) =>
            this.nutritionRepo.create({
              nutrient: fact.nutrient,
              amountPer100g: fact.amountPer100g,
              amountPerServing: fact.amountPerServing || (null as any),
              unit: fact.unit,
              dailyValuePercentage: fact.dailyValuePercentage || (null as any),
              product: existing,
            }),
          );
          await this.nutritionRepo.save(factEntities);
        }
      }
    }

    // Recalculate all catalog products & ingredients against active F03 rules
    if (this.catalogService && typeof this.catalogService.recalculateAllWithRules === 'function') {
      const summary = await this.catalogService.recalculateAllWithRules(activeRules);
      this.logger.log(
        `F03 rule recalculation summary: ${summary.matchedCount} matched, ${summary.unknownCount} unclassified across ${summary.productsEvaluated} products (${summary.ingredientsUpdated} updated).`,
      );
    }

    this.logger.log(`Synchronized ${allProducts.length} food catalog products (active + statutory quarantined).`);
  }

  /**
   * Seed consumer personal preference profiles.
   */
  private async seedPreferences(): Promise<void> {
    for (const pref of SEED_PREFERENCES) {
      const consumer = await this.userRepo.findOne({
        where: { email: pref.userEmail },
      });
      if (!consumer) continue;

      const existing = await this.preferenceRepo.findOne({
        where: { userId: consumer.id },
      });

      if (!existing) {
        await this.preferenceRepo.save(
          this.preferenceRepo.create({
            userId: consumer.id,
            allergies: pref.allergies,
            dietaryPreferences: pref.dietaryPreferences,
            dislikedIngredients: pref.dislikedIngredients,
            calorieGoal: pref.calorieGoal,
            maxSugarPerServing: pref.maxSugarPerServing,
            maxSodiumPerServing: pref.maxSodiumPerServing,
            minProteinPerServing: pref.minProteinPerServing,
            age: pref.age,
            gender: pref.gender,
            heightCm: pref.heightCm,
            weightKg: pref.weightKg,
            activityLevel: pref.activityLevel,
          }),
        );
      } else {
        existing.allergies = pref.allergies;
        existing.dietaryPreferences = pref.dietaryPreferences;
        existing.dislikedIngredients = pref.dislikedIngredients;
        existing.calorieGoal = pref.calorieGoal;
        existing.maxSugarPerServing = pref.maxSugarPerServing;
        existing.maxSodiumPerServing = pref.maxSodiumPerServing;
        existing.minProteinPerServing = pref.minProteinPerServing;
        existing.age = pref.age;
        existing.gender = pref.gender;
        existing.heightCm = pref.heightCm;
        existing.weightKg = pref.weightKg;
        existing.activityLevel = pref.activityLevel;
        await this.preferenceRepo.save(existing);
      }
    }
    this.logger.log(`Synchronized ${SEED_PREFERENCES.length} consumer preference profiles.`);
  }

  /**
   * Seed manufacturer regulatory licences.
   */
  private async seedManufacturerLicences(): Promise<void> {
    for (const lic of SEED_MANUFACTURER_LICENCES) {
      const existing = await this.licenceRepo.findOne({
        where: { licenceNumber: lic.licenceNumber },
      });

      if (!existing) {
        await this.licenceRepo.save(this.licenceRepo.create(lic));
      } else {
        existing.companyName = lic.companyName;
        existing.authority = lic.authority;
        existing.category = lic.category;
        existing.issueDate = lic.issueDate;
        existing.expiryDate = lic.expiryDate;
        existing.status = lic.status;
        existing.address = lic.address;
        await this.licenceRepo.save(existing);
      }
    }
    this.logger.log(`Synchronized ${SEED_MANUFACTURER_LICENCES.length} manufacturer licences.`);
  }

  /**
   * Seed food safety audit certificates and laboratory test documents.
   */
  private async seedFoodSafetyDocuments(): Promise<void> {
    const defaultMfg = await this.userRepo.findOne({
      where: { email: 'manufacturer@truelabel.demo' },
    });
    const defaultMfgId = defaultMfg?.id || 1;

    const inspectors = await this.userRepo.find({
      where: { role: 'inspector' },
      select: ['id', 'name', 'email'],
    });
    const defaultInspector = inspectors[0];

    for (const doc of SEED_SAFETY_DOCUMENTS) {
      let mfgId = defaultMfgId;
      if (doc.manufacturerEmail) {
        const mfgUser = await this.userRepo.findOne({
          where: { email: doc.manufacturerEmail },
        });
        if (mfgUser) mfgId = mfgUser.id;
      }

      let reviewedById: number | undefined;
      if (doc.reviewedByName && defaultInspector) {
        reviewedById = defaultInspector.id;
      }

      const existing = await this.documentRepo.findOne({
        where: { certificateNumber: doc.certificateNumber },
      });

      if (!existing) {
        await this.documentRepo.save(
          this.documentRepo.create({
            manufacturerId: mfgId,
            companyName: doc.companyName,
            documentType: doc.documentType,
            certificateNumber: doc.certificateNumber,
            issuer: doc.issuer,
            issueDate: doc.issueDate,
            expiryDate: doc.expiryDate,
            fileUrl: doc.fileUrl,
            status: doc.status,
            rejectionReason: doc.rejectionReason,
            reviewedById,
            reviewedByName: doc.reviewedByName,
            reviewDate: doc.reviewDate,
            notes: doc.notes,
          }),
        );
      } else {
        existing.manufacturerId = mfgId;
        existing.companyName = doc.companyName;
        existing.documentType = doc.documentType;
        existing.issuer = doc.issuer;
        existing.issueDate = doc.issueDate;
        existing.expiryDate = doc.expiryDate;
        existing.fileUrl = doc.fileUrl;
        existing.status = doc.status;
        existing.rejectionReason = doc.rejectionReason || existing.rejectionReason;
        existing.reviewedById = reviewedById || existing.reviewedById;
        existing.reviewedByName = doc.reviewedByName || existing.reviewedByName;
        existing.reviewDate = doc.reviewDate || existing.reviewDate;
        existing.notes = doc.notes || existing.notes;
        await this.documentRepo.save(existing);
      }
    }
    this.logger.log(`Synchronized ${SEED_SAFETY_DOCUMENTS.length} food safety compliance documents.`);
  }

  /**
   * Seed credibility-weighted consumer reviews and safety complaint reports.
   * Includes intentional 3-consumer batch cluster anomaly on BATCH-FRT-2026-09.
   */
  private async seedCommunityReviewsAndReports(): Promise<void> {
    // Seed reviews
    for (const rev of SEED_REVIEWS) {
      const product = await this.productRepo.findOne({
        where: { barcode: rev.productBarcode },
        select: ['id', 'barcode'],
      });
      const user = await this.userRepo.findOne({
        where: { email: rev.userEmail },
        select: ['id', 'email'],
      });

      if (!product || !user) continue;

      const existing = await this.reviewRepo.findOne({
        where: { productId: product.id, userId: user.id },
      });

      if (!existing) {
        await this.reviewRepo.save(
          this.reviewRepo.create({
            productId: product.id,
            userId: user.id,
            tasteRating: rev.tasteRating,
            labelAccuracyRating: rev.labelAccuracyRating,
            packagingRating: rev.packagingRating,
            purchaseExperienceRating: rev.purchaseExperienceRating,
            rating: rev.rating,
            credibilityWeight: rev.credibilityWeight,
            visibility: rev.visibility,
            title: rev.title,
            comment: rev.comment,
            manufacturerReply: rev.manufacturerReply || null,
            repliedAt: rev.repliedAt || null,
          }),
        );
      }
    }
    this.logger.log(`Synchronized ${SEED_REVIEWS.length} community reviews.`);

    // Seed safety complaint reports
    for (const rep of SEED_REPORTS) {
      const product = await this.productRepo.findOne({
        where: { barcode: rep.productBarcode },
        select: ['id', 'barcode'],
      });
      const user = await this.userRepo.findOne({
        where: { email: rep.userEmail },
        select: ['id', 'email'],
      });

      if (!product || !user) continue;

      const existing = await this.reportRepo.findOne({
        where: { referenceNumber: rep.referenceNumber },
      });

      if (!existing) {
        await this.reportRepo.save(
          this.reportRepo.create({
            productId: product.id,
            userId: user.id,
            category: rep.category,
            batchCode: rep.batchCode || null,
            purchasePlace: rep.purchasePlace,
            referenceNumber: rep.referenceNumber,
            description: rep.description,
            status: rep.status,
          }),
        );
      }
    }
    this.logger.log(`Synchronized ${SEED_REPORTS.length} safety complaint reports.`);
  }
}
