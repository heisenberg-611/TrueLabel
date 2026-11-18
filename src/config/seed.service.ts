import { Injectable, Logger } from '@nestjs/common';
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

interface SeedProductDefinition {
  name: string;
  brand: string;
  category: string;
  barcode: string;
  description: string;
  servingSize: number;
  servingUnit: string;
  status: 'active';
  qualityScore: number;
  dietaryTags: string[];
  manufacturerEmail?: string;
  ingredients: Array<{
    name: string;
    isAllergen?: boolean;
    allergenType?: string;
    additiveCode?: string;
    hazardLevel?: 'safe' | 'caution' | 'warning';
    explanation?: string;
  }>;
  nutritionFacts: Array<{
    nutrient: string;
    amountPer100g: number;
    amountPerServing?: number;
    unit: string;
    dailyValuePercentage?: number;
  }>;
}

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
  ) {}

  /**
   * Dedicated entrypoint to execute full database seeding.
   * Invoked explicitly via dedicated CLI command (npm run seed).
   */
  async runSeed(): Promise<void> {
    this.logger.log('Starting TrueLabel seed synchronization with authentic online data...');
    await this.seedUsers();
    await this.cleanLegacyDemoProducts();
    await this.seedFoodProducts();
    await this.seedPreferenceProfile();
    await this.seedManufacturerLicences();
    await this.seedFoodSafetyDocuments();
    await this.seedCommunityReviewsAndReports();
    this.logger.log('TrueLabel seed synchronization completed successfully.');
  }

  private async cleanLegacyDemoProducts() {
    // Legacy fictional barcodes replaced by authentic products
    const legacyBarcodes = ['9312345678901', '8901234567891', '5201234567892', '7612345678903'];
    for (const barcode of legacyBarcodes) {
      const legacy = await this.productRepo.findOne({ where: { barcode } });
      if (legacy) {
        await this.productRepo.remove(legacy);
        this.logger.log(`Purged legacy placeholder product: ${legacy.name} (${barcode})`);
      }
    }
  }

  private async seedUsers() {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const demoUsers = [
      { name: 'Sharah Consumer', email: 'consumer@truelabel.demo', role: 'consumer' as const },
      { name: 'Tariq Rahman', email: 'tariq.consumer@truelabel.demo', role: 'consumer' as const },
      { name: 'PureHarvest & Aarong Dairy', email: 'manufacturer@truelabel.demo', role: 'manufacturer' as const },
      { name: 'Dr. Marcus Vance (Inspector)', email: 'inspector@truelabel.demo', role: 'inspector' as const },
      { name: 'Lead System Admin', email: 'admin@truelabel.demo', role: 'admin' as const },
      { name: 'PRAN Foods Ltd.', email: 'pran@truelabel.demo', role: 'manufacturer' as const },
      { name: 'Nestlé Bangladesh Ltd.', email: 'nestle@truelabel.demo', role: 'manufacturer' as const },
      { name: 'Oatly AB', email: 'oatly@truelabel.demo', role: 'manufacturer' as const },
      { name: 'The Kraft Heinz Company', email: 'heinz@truelabel.demo', role: 'manufacturer' as const },
    ];

    for (const u of demoUsers) {
      const existing = await this.userRepo.findOne({ where: { email: u.email } });
      if (!existing) {
        await this.userRepo.save(
          this.userRepo.create({
            ...u,
            passwordHash,
            isVerified: true,
          }),
        );
      } else if (existing.name !== u.name) {
        existing.name = u.name;
        await this.userRepo.save(existing);
      }
    }
  }

  private async seedPreferenceProfile() {
    const consumer = await this.userRepo.findOne({
      where: { email: 'consumer@truelabel.demo' },
    });
    if (!consumer) return;

    const existing = await this.preferenceRepo.findOne({
      where: { userId: consumer.id },
    });
    if (existing) return;

    await this.preferenceRepo.save(
      this.preferenceRepo.create({
        userId: consumer.id,
        allergies: ['Peanut', 'Milk'],
        dietaryPreferences: ['Vegan'],
        dislikedIngredients: ['High Fructose Corn Syrup'],
        calorieGoal: 2000,
        maxSugarPerServing: 10,
        maxSodiumPerServing: 1.5,
        minProteinPerServing: 10,
        age: 26,
        gender: 'female',
        heightCm: 168,
        weightKg: 58,
        activityLevel: 'moderate',
      }),
    );
  }

  private async seedFoodProducts() {
    const defaultManufacturer = await this.userRepo.findOne({
      where: { email: 'manufacturer@truelabel.demo' },
    });
    const manufacturerId = defaultManufacturer?.id || 2;

    const authenticProducts: SeedProductDefinition[] = [
      // 1. Oatly Barista Edition Oat Milk (Dairy & Plant Milks, Tier 1 Clean)
      {
        name: 'Barista Edition Oat Drink',
        brand: 'Oatly',
        category: 'Dairy & Plant Milks',
        barcode: '7394376311482',
        description: 'Foamable oat drink made from liquid oats and rapeseed oil, fortified with calcium and vitamins for specialty coffee.',
        servingSize: 200,
        servingUnit: 'ml',
        status: 'active',
        qualityScore: 86,
        dietaryTags: ['Vegan', 'Gluten-Free', 'Kosher'],
        ingredients: [
          { name: 'Oat Base (Water, Oats 10%)', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Rapeseed Oil', hazardLevel: 'safe' },
          { name: 'Dipotassium Phosphate', additiveCode: 'E340', hazardLevel: 'safe', explanation: 'Acidity regulator buffering coffee acidity.' },
          { name: 'Calcium Carbonate', additiveCode: 'E170', hazardLevel: 'safe', explanation: 'Mineral fortification salt.' },
          { name: 'Sea Salt', hazardLevel: 'safe' },
          { name: 'Potassium Iodide', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 59, amountPerServing: 118, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 3.0, amountPerServing: 6.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.3, amountPerServing: 0.6, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 6.6, amountPerServing: 13.2, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 4.0, amountPerServing: 8.0, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 0.8, amountPerServing: 1.6, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 1.2, amountPerServing: 2.4, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.10, amountPerServing: 0.20, unit: 'g' },
        ],
      },

      // 2. Chobani Non-Fat Plain Greek Yogurt (Dairy & Plant Milks, Tier 1 Probiotic)
      {
        name: 'Non-Fat Plain Greek Yogurt',
        brand: 'Chobani',
        category: 'Dairy & Plant Milks',
        barcode: '089470001382',
        description: 'Triple-strained authentic Greek yogurt made with farm-fresh skim milk and live active probiotic cultures with zero added sugar.',
        servingSize: 150,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 94,
        dietaryTags: ['Vegetarian', 'Gluten-Free', 'Kosher', 'Halal', 'Low-Sugar'],
        ingredients: [
          { name: 'Cultured Pasteurized Nonfat Milk', isAllergen: true, allergenType: 'Milk', hazardLevel: 'safe' },
          { name: 'Live Probiotic Cultures (S. thermophilus, L. bulgaricus, L. acidophilus, Bifidus, L. casei)', hazardLevel: 'safe', explanation: 'Beneficial lactic acid bacteria for digestive microbiome balance.' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 55, amountPerServing: 82, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 4.0, amountPerServing: 6.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 4.0, amountPerServing: 6.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 10.0, amountPerServing: 15.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.09, amountPerServing: 0.13, unit: 'g' },
        ],
      },

      // 3. Aarong Dairy Pure Full Cream Milk (Dairy & Plant Milks, Tier 1 Statutory Standard)
      {
        name: 'Pasteurized Pure Full Cream Milk',
        brand: 'Aarong Dairy',
        category: 'Dairy & Plant Milks',
        barcode: '8941159000584',
        description: '100% wholesome cow milk homogenised and pasteurized to national standards (BSTI BDS 1702:2019) with min 3.5% butterfat.',
        servingSize: 250,
        servingUnit: 'ml',
        status: 'active',
        qualityScore: 91,
        dietaryTags: ['Vegetarian', 'Gluten-Free', 'Halal'],
        ingredients: [
          { name: 'Pasteurized Whole Cow Milk (Min 3.5% Butterfat, 8.0% SNF)', isAllergen: true, allergenType: 'Milk', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 62, amountPerServing: 155, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 3.5, amountPerServing: 8.75, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 2.2, amountPerServing: 5.5, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 4.8, amountPerServing: 12.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 4.8, amountPerServing: 12.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 3.3, amountPerServing: 8.25, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.12, amountPerServing: 0.30, unit: 'g' },
        ],
      },

      // 4. Coca-Cola Original Taste (Beverages, Tier 3 High Sugar & Additives)
      {
        name: 'Original Taste Carbonated Cola',
        brand: 'Coca-Cola',
        category: 'Beverages',
        barcode: '5449000000996',
        description: 'Classic sparkling carbonated soft drink containing caramel color (E150d) and phosphoric acid, with high sugar saturation.',
        servingSize: 330,
        servingUnit: 'ml',
        status: 'active',
        qualityScore: 42,
        dietaryTags: ['Vegan', 'Gluten-Free'],
        ingredients: [
          { name: 'Carbonated Water', hazardLevel: 'safe' },
          { name: 'High Fructose Corn Syrup', hazardLevel: 'caution', explanation: 'High glycemic concentrated fructose-glucose syrup.' },
          { name: 'Caramel Color', additiveCode: 'E150d', hazardLevel: 'caution', explanation: 'Class IV sulfite-ammonia processed caramel colorant.' },
          { name: 'Phosphoric Acid', additiveCode: 'E338', hazardLevel: 'caution', explanation: 'Inorganic acid providing sharp tang, monitored for mineral balance.' },
          { name: 'Natural Flavourings (including Caffeine)', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 42, amountPerServing: 139, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 10.6, amountPerServing: 35.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 10.6, amountPerServing: 35.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.01, amountPerServing: 0.03, unit: 'g' },
        ],
      },

      // 5. Twinings Pure Green Tea (Beverages, Tier 1 Pristine Whole Botanicals)
      {
        name: 'Pure Green Tea Bags',
        brand: 'Twinings',
        category: 'Beverages',
        barcode: '0070177103088',
        description: '100% selected pure steamed unfermented Camellia sinensis green tea leaves, naturally packed with antioxidant catechins and zero additives.',
        servingSize: 200,
        servingUnit: 'ml',
        status: 'active',
        qualityScore: 98,
        dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'Kosher', 'Low-Sugar', 'Organic'],
        ingredients: [
          { name: '100% Pure Steamed Green Tea Leaves', hazardLevel: 'safe', explanation: 'Pristine unfermented Camellia sinensis tea leaves.' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 1, amountPerServing: 2, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.00, amountPerServing: 0.00, unit: 'g' },
        ],
      },

      // 6. PRAN Frooto Mango Fruit Drink (Beverages, Tier 3 Sweetened & Preserved)
      {
        name: 'Frooto Mango Fruit Drink',
        brand: 'PRAN',
        category: 'Beverages',
        barcode: '0831730009403',
        description: 'Sweetened tropical mango beverage formulated from natural mango pulp, acid regulators, and sodium benzoate preservative.',
        servingSize: 250,
        servingUnit: 'ml',
        status: 'active',
        qualityScore: 52,
        dietaryTags: ['Vegetarian', 'Halal'],
        ingredients: [
          { name: 'Treated Water', hazardLevel: 'safe' },
          { name: 'Mango Pulp (10%)', hazardLevel: 'safe' },
          { name: 'Refined Sugar', hazardLevel: 'caution', explanation: 'Added refined cane sugar.' },
          { name: 'Citric Acid', additiveCode: 'E330', hazardLevel: 'safe', explanation: 'Natural food acidulant.' },
          { name: 'Sodium Benzoate', additiveCode: 'E211', hazardLevel: 'caution', explanation: 'Chemical antimicrobial preservative salt.' },
          { name: 'Beta-Carotene', additiveCode: 'E160a', hazardLevel: 'safe' },
          { name: 'Artificial Mango Flavor', hazardLevel: 'caution' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 48, amountPerServing: 120, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 12.0, amountPerServing: 30.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 11.5, amountPerServing: 28.75, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 0.1, amountPerServing: 0.25, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.04, amountPerServing: 0.10, unit: 'g' },
        ],
      },

      // 7. Food For Life Ezekiel 4:9 Sprouted Grain Bread (Bakery & Bread, Tier 1 Wholesome)
      {
        name: 'Ezekiel 4:9 Sprouted Whole Grain Bread',
        brand: 'Food for Life',
        category: 'Bakery & Bread',
        barcode: '0073472001202',
        description: 'Flourless organic bread made from freshly sprouted live grains and legumes: wheat, barley, millet, lentils, soybeans, and spelt.',
        servingSize: 34,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 95,
        dietaryTags: ['Vegan', 'Vegetarian', 'Kosher', 'Organic', 'Low-Sugar'],
        ingredients: [
          { name: 'Organic Sprouted Wheat', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Filtered Water', hazardLevel: 'safe' },
          { name: 'Organic Sprouted Barley', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Organic Sprouted Millet', hazardLevel: 'safe' },
          { name: 'Organic Sprouted Malted Barley', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Organic Sprouted Lentils', hazardLevel: 'safe' },
          { name: 'Organic Sprouted Soybeans', isAllergen: true, allergenType: 'Soy', hazardLevel: 'safe' },
          { name: 'Organic Sprouted Spelt', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Fresh Yeast', hazardLevel: 'safe' },
          { name: 'Organic Wheat Gluten', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Sea Salt', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 235, amountPerServing: 80, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 1.5, amountPerServing: 0.5, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 44.1, amountPerServing: 15.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 8.8, amountPerServing: 3.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 14.7, amountPerServing: 5.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.55, amountPerServing: 0.19, unit: 'g' },
        ],
      },

      // 8. Oreo Original Chocolate Sandwich Cookies (Snacks & Confectionery, Tier 3 Ultra-Processed)
      {
        name: 'Original Chocolate Sandwich Cookies',
        brand: 'Oreo',
        category: 'Snacks & Confectionery',
        barcode: '7622210642554',
        description: 'Ultra-processed chocolate wafer cookies with a sweet vanilla creme center, manufactured with palm oil, soy lecithin, and leavening agents.',
        servingSize: 34,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 46,
        dietaryTags: ['Vegetarian', 'Halal'],
        ingredients: [
          { name: 'Wheat Flour', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Sugar', hazardLevel: 'caution', explanation: 'Refined granulated sugar.' },
          { name: 'Palm Oil', hazardLevel: 'caution', explanation: 'High saturated tropical vegetable fat.' },
          { name: 'Fat-Reduced Cocoa Powder (4.5%)', hazardLevel: 'safe' },
          { name: 'Wheat Starch', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Glucose-Fructose Syrup', hazardLevel: 'caution' },
          { name: 'Sodium Hydrogen Carbonate', additiveCode: 'E500', hazardLevel: 'safe', explanation: 'Baking soda leavener.' },
          { name: 'Ammonium Hydrogen Carbonate', additiveCode: 'E503', hazardLevel: 'safe' },
          { name: 'Soya Lecithin', additiveCode: 'E322', isAllergen: true, allergenType: 'Soy', hazardLevel: 'safe', explanation: 'Phospholipid emulsifier.' },
          { name: 'Salt', hazardLevel: 'safe' },
          { name: 'Vanillin Flavoring', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 472, amountPerServing: 160, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 20.0, amountPerServing: 6.8, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 9.4, amountPerServing: 3.2, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 68.0, amountPerServing: 23.1, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 38.0, amountPerServing: 12.9, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 2.7, amountPerServing: 0.9, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 5.3, amountPerServing: 1.8, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.74, amountPerServing: 0.25, unit: 'g' },
        ],
      },

      // 9. Ferrero Nutella Hazelnut Spread (Snacks & Confectionery, Tier 3 High Sugar)
      {
        name: 'Hazelnut Spread with Cocoa',
        brand: 'Ferrero Nutella',
        category: 'Snacks & Confectionery',
        barcode: '3017620422027',
        description: 'World-famous sweet hazelnut and cocoa spread, formulated with 56% sugar and palm oil, alongside skim milk and 13% hazelnuts.',
        servingSize: 15,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 53,
        dietaryTags: ['Vegetarian', 'Gluten-Free', 'Halal', 'Kosher'],
        ingredients: [
          { name: 'Sugar', hazardLevel: 'caution', explanation: 'High sugar density (56.3g per 100g).' },
          { name: 'Palm Oil', hazardLevel: 'caution', explanation: 'Refined fractionated palm oil.' },
          { name: 'Hazelnuts (13%)', isAllergen: true, allergenType: 'Tree Nut', hazardLevel: 'caution', explanation: 'Major allergen for tree nut sensitive consumers.' },
          { name: 'Skimmed Milk Powder (8.7%)', isAllergen: true, allergenType: 'Milk', hazardLevel: 'safe' },
          { name: 'Fat-Reduced Cocoa (7.4%)', hazardLevel: 'safe' },
          { name: 'Soya Lecithin', additiveCode: 'E322', isAllergen: true, allergenType: 'Soy', hazardLevel: 'safe' },
          { name: 'Vanillin', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 539, amountPerServing: 81, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 30.9, amountPerServing: 4.6, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 10.6, amountPerServing: 1.6, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 57.5, amountPerServing: 8.6, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 56.3, amountPerServing: 8.4, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 6.3, amountPerServing: 0.9, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.11, amountPerServing: 0.02, unit: 'g' },
        ],
      },

      // 10. Quaker Old Fashioned Rolled Oats (Cereals & Breakfast, Tier 1 High Fiber)
      {
        name: 'Old Fashioned 100% Whole Grain Rolled Oats',
        brand: 'Quaker',
        category: 'Cereals & Breakfast',
        barcode: '0030000010204',
        description: '100% whole grain oat flakes without added sodium, sugar, or preservatives, delivering natural beta-glucan soluble dietary fiber.',
        servingSize: 40,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 96,
        dietaryTags: ['Vegan', 'Vegetarian', 'Kosher', 'Halal', 'Low-Sugar'],
        ingredients: [
          { name: '100% Whole Grain Rolled Oats', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 375, amountPerServing: 150, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 7.5, amountPerServing: 3.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 1.25, amountPerServing: 0.5, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 67.5, amountPerServing: 27.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 2.5, amountPerServing: 1.0, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 10.0, amountPerServing: 4.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 12.5, amountPerServing: 5.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.01, amountPerServing: 0.00, unit: 'g' },
        ],
      },

      // 11. Jif Creamy Peanut Butter (Pantry & Condiments, Tier 2 Moderate Processing)
      {
        name: 'Creamy Peanut Butter',
        brand: 'Jif',
        category: 'Pantry & Condiments',
        barcode: '0051500255162',
        description: 'Smooth spreadable peanut butter produced with fresh roasted peanuts, hydrogenated rapeseed/soybean oil stabilizer, and salt.',
        servingSize: 33,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 74,
        dietaryTags: ['Gluten-Free', 'Kosher', 'Vegetarian'],
        ingredients: [
          { name: 'Roasted Peanuts', isAllergen: true, allergenType: 'Peanut', hazardLevel: 'caution', explanation: 'Major allergen for sensitized individuals.' },
          { name: 'Sugar', hazardLevel: 'safe' },
          { name: 'Fully Hydrogenated Rapeseed and Soybean Oil', hazardLevel: 'caution', explanation: 'Processed vegetable oil stabilizer preventing oil separation.' },
          { name: 'Mono- and Diglycerides of Fatty Acids', additiveCode: 'E471', hazardLevel: 'safe', explanation: 'Food emulsifier.' },
          { name: 'Salt', hazardLevel: 'safe' },
          { name: 'Molasses', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 576, amountPerServing: 190, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 48.5, amountPerServing: 16.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 10.6, amountPerServing: 3.5, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 24.2, amountPerServing: 8.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 9.1, amountPerServing: 3.0, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 6.1, amountPerServing: 2.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 21.2, amountPerServing: 7.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 1.06, amountPerServing: 0.35, unit: 'g' },
        ],
      },

      // 12. Heinz Tomato Ketchup (Pantry & Condiments, Tier 2 Moderate Processing)
      {
        name: 'Tomato Ketchup (Classic)',
        brand: 'Heinz',
        category: 'Pantry & Condiments',
        barcode: '8715700017006',
        description: 'Classic condiment crafted with 148g field tomatoes per 100g, blended with spirit vinegar, salt, and natural celery herb extract.',
        servingSize: 15,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 68,
        dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Kosher', 'Halal'],
        ingredients: [
          { name: 'Tomatoes (148g per 100g Ketchup)', hazardLevel: 'safe' },
          { name: 'Spirit Vinegar', hazardLevel: 'safe' },
          { name: 'Sugar', hazardLevel: 'caution', explanation: 'Concentrated sugar contributor (22.8g per 100g).' },
          { name: 'Salt', hazardLevel: 'safe' },
          { name: 'Spice and Herb Extracts (contains Celery)', isAllergen: true, allergenType: 'Celery', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 102, amountPerServing: 15, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 0.1, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.0, amountPerServing: 0.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 23.2, amountPerServing: 3.5, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 22.8, amountPerServing: 3.4, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 0.5, amountPerServing: 0.1, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 1.2, amountPerServing: 0.2, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 1.80, amountPerServing: 0.27, unit: 'g' },
        ],
      },

      // 13. Barilla Spaghetti No. 5 (Pantry & Condiments, Tier 1 Clean Staple)
      {
        name: 'Spaghetti No. 5 (Durum Wheat)',
        brand: 'Barilla',
        category: 'Pantry & Condiments',
        barcode: '8076804215058',
        description: 'Authentic Italian dry pasta made from 100% premium non-GMO durum wheat semolina and pure spring water with high protein density.',
        servingSize: 85,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 88,
        dietaryTags: ['Vegan', 'Vegetarian', 'Halal', 'Kosher', 'Low-Sugar'],
        ingredients: [
          { name: 'Durum Wheat Semolina', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Water', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 359, amountPerServing: 305, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 2.0, amountPerServing: 1.7, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 0.5, amountPerServing: 0.4, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 71.2, amountPerServing: 60.5, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 3.5, amountPerServing: 3.0, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 3.0, amountPerServing: 2.6, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 12.5, amountPerServing: 10.6, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.01, amountPerServing: 0.01, unit: 'g' },
        ],
      },

      // 14. Maggi 2-Minute Masala Instant Noodles (Packaged Meals, Tier 3 Ultra Processed & High Salt)
      {
        name: '2-Minute Masala Instant Noodles',
        brand: 'Maggi',
        category: 'Packaged Meals',
        barcode: '8901058842746',
        description: 'Pre-cooked flash-fried instant noodles paired with a savory spice blend containing hydrolysed groundnut protein and disodium ribonucleotides.',
        servingSize: 70,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 48,
        dietaryTags: ['Vegetarian', 'Halal'],
        ingredients: [
          { name: 'Refined Wheat Flour (Maida)', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Palm Oil', hazardLevel: 'caution', explanation: 'High saturated fat used for frying noodle block.' },
          { name: 'Iodised Salt', hazardLevel: 'caution', explanation: 'Contributes to high sodium content (1028mg / 100g).' },
          { name: 'Wheat Gluten', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Potassium Carbonate', additiveCode: 'E501', hazardLevel: 'safe', explanation: 'Alkaline mineral salt for noodle texture.' },
          { name: 'Sodium Carbonate', additiveCode: 'E500', hazardLevel: 'safe' },
          { name: 'Tastemaker Spice Blend (Coriander, Turmeric, Chilli, Cumin, Clove)', hazardLevel: 'safe' },
          { name: 'Hydrolysed Groundnut Protein', isAllergen: true, allergenType: 'Peanut', hazardLevel: 'caution', explanation: 'Peanut hydrolysate allergen for umami enhancement.' },
          { name: 'Disodium 5-Ribonucleotides', additiveCode: 'E635', hazardLevel: 'caution', explanation: 'Potent synthetic umami flavor enhancer.' },
          { name: 'Caramel Color', additiveCode: 'E150d', hazardLevel: 'caution' },
          { name: 'Citric Acid', additiveCode: 'E330', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 389, amountPerServing: 272, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 13.5, amountPerServing: 9.5, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 8.2, amountPerServing: 5.7, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 59.6, amountPerServing: 41.7, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 1.8, amountPerServing: 1.3, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 2.0, amountPerServing: 1.4, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 8.2, amountPerServing: 5.7, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 2.57, amountPerServing: 1.80, unit: 'g' },
        ],
      },

      // 15. Amy's Kitchen Organic Vegetable Lasagna (Packaged Meals, Tier 1 High Quality Meal)
      {
        name: 'Organic Vegetable Lasagna',
        brand: 'Amy\'s Kitchen',
        category: 'Packaged Meals',
        barcode: '0042272000326',
        description: 'Frozen prepared meal featuring organic pasta layered with ricotta, mozzarella, and Parmesan cheeses, organic spinach, zucchini, and tomato sauce.',
        servingSize: 269,
        servingUnit: 'g',
        status: 'active',
        qualityScore: 85,
        dietaryTags: ['Vegetarian', 'Organic', 'Kosher'],
        ingredients: [
          { name: 'Organic Durum Wheat Pasta', isAllergen: true, allergenType: 'Gluten', hazardLevel: 'safe' },
          { name: 'Organic Tomato Puree', hazardLevel: 'safe' },
          { name: 'Organic Zucchini and Spinach', hazardLevel: 'safe' },
          { name: 'Part-Skim Ricotta and Mozzarella Cheeses', isAllergen: true, allergenType: 'Milk', hazardLevel: 'safe' },
          { name: 'Parmesan Cheese', isAllergen: true, allergenType: 'Milk', hazardLevel: 'safe' },
          { name: 'Organic Extra Virgin Olive Oil', hazardLevel: 'safe' },
          { name: 'Organic Basil and Garlic', hazardLevel: 'safe' },
          { name: 'Sea Salt', hazardLevel: 'safe' },
        ],
        nutritionFacts: [
          { nutrient: 'Energy', amountPer100g: 130, amountPerServing: 350, unit: 'kcal' },
          { nutrient: 'Fat', amountPer100g: 5.2, amountPerServing: 14.0, unit: 'g' },
          { nutrient: 'Saturated Fat', amountPer100g: 2.2, amountPerServing: 6.0, unit: 'g' },
          { nutrient: 'Carbohydrates', amountPer100g: 14.9, amountPerServing: 40.0, unit: 'g' },
          { nutrient: 'Sugars', amountPer100g: 2.6, amountPerServing: 7.0, unit: 'g' },
          { nutrient: 'Fiber', amountPer100g: 1.9, amountPerServing: 5.0, unit: 'g' },
          { nutrient: 'Protein', amountPer100g: 5.9, amountPerServing: 16.0, unit: 'g' },
          { nutrient: 'Salt', amountPer100g: 0.69, amountPerServing: 1.85, unit: 'g' },
        ],
      },
    ];

    for (const prodData of authenticProducts) {
      const existing = await this.productRepo.findOne({ where: { barcode: prodData.barcode } });
      if (existing) {
        continue;
      }

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
          manufacturerId,
          dietaryTags: prodData.dietaryTags,
        }),
      );

      // Save declared ingredients
      const ingredientEntities = prodData.ingredients.map((ing) =>
        this.ingredientRepo.create({
          name: ing.name,
          isAllergen: Boolean(ing.isAllergen),
          allergenType: ing.allergenType || null as any,
          additiveCode: ing.additiveCode || null as any,
          hazardLevel: ing.hazardLevel || 'safe',
          explanation: ing.explanation || null as any,
          product,
        }),
      );
      await this.ingredientRepo.save(ingredientEntities);

      // Save official nutrition facts
      const factEntities = prodData.nutritionFacts.map((fact) =>
        this.nutritionRepo.create({
          nutrient: fact.nutrient,
          amountPer100g: fact.amountPer100g,
          amountPerServing: fact.amountPerServing || null as any,
          unit: fact.unit,
          dailyValuePercentage: fact.dailyValuePercentage || null as any,
          product,
        }),
      );
      await this.nutritionRepo.save(factEntities);

      this.logger.log(`Seeded authentic product: ${product.brand} ${product.name} [Barcode: ${product.barcode}]`);
    }
  }

  private async seedManufacturerLicences() {
    const authenticLicences = [
      {
        licenceNumber: 'BSTI-DAIRY-BDS-1702-09',
        companyName: 'BRAC Enterprises (Aarong Dairy)',
        authority: 'Bangladesh Standards and Testing Institution (BSTI)',
        category: 'Dairy, Liquid Milk & Fermented Products',
        issueDate: '2024-01-01',
        expiryDate: '2027-12-31',
        status: 'valid' as const,
        address: 'Aarong Dairy Processing Plant, Gazipur, Bangladesh',
      },
      {
        licenceNumber: 'BFSA-REG-2024-PRAN-881',
        companyName: 'PRAN Foods Ltd.',
        authority: 'Bangladesh Food Safety Authority (BFSA)',
        category: 'Fruit Beverages & Processed Snacks',
        issueDate: '2023-06-01',
        expiryDate: '2026-06-01',
        status: 'valid' as const,
        address: 'PRAN Industrial Park, Ghorashal, Narsingdi, Bangladesh',
      },
      {
        licenceNumber: 'BSTI-FOOD-BDS-1552-2023',
        companyName: 'Nestlé Bangladesh Ltd.',
        authority: 'Bangladesh Standards and Testing Institution (BSTI)',
        category: 'Packaged Instant Noodles & Culinary Seasonings',
        issueDate: '2023-03-15',
        expiryDate: '2028-03-15',
        status: 'valid' as const,
        address: 'Nestlé Factory, Sreepur, Gazipur, Bangladesh',
      },
      {
        licenceNumber: 'EFSA-REG-SE-001-OATLY',
        companyName: 'Oatly AB',
        authority: 'European Food Safety Authority (EFSA / Livsmedelsverket)',
        category: 'Organic Plant Milks & Oat Beverages',
        issueDate: '2024-01-10',
        expiryDate: '2027-01-10',
        status: 'valid' as const,
        address: 'Jagaregatan 4, SE-211 19 Malmo, Sweden',
      },
      {
        licenceNumber: 'FDA-REG-10499283-HEINZ',
        companyName: 'The Kraft Heinz Company',
        authority: 'US Food and Drug Administration (FDA)',
        category: 'Condiments, Sauces & Tomato Products',
        issueDate: '2024-02-01',
        expiryDate: '2027-02-01',
        status: 'valid' as const,
        address: '1 PPG Place, Pittsburgh, PA 15222, USA',
      },
      {
        licenceNumber: 'IT-CE-01-2024-FERRERO',
        companyName: 'Ferrero SpA',
        authority: 'Italian Ministry of Health & EFSA',
        category: 'Confectionery, Cocoa & Hazelnut Spreads',
        issueDate: '2024-01-15',
        expiryDate: '2027-01-15',
        status: 'valid' as const,
        address: 'Piazzale Pietro Ferrero 1, 12051 Alba (CN), Italy',
      },
      {
        licenceNumber: 'BSTI-REG-SUSP-2023-091',
        companyName: 'Substandard Edible Oils Ltd.',
        authority: 'Bangladesh Standards and Testing Institution (BSTI)',
        category: 'Edible Oils & Shortenings',
        issueDate: '2021-01-01',
        expiryDate: '2023-01-01',
        status: 'suspended' as const,
        address: 'BSCIC Industrial Area, Tongi, Gazipur',
      },
      {
        licenceNumber: 'BFSA-EXP-2021-304',
        companyName: 'Old Town Confectionery Ltd.',
        authority: 'Bangladesh Food Safety Authority (BFSA)',
        category: 'Packaged Bakery & Cookies',
        issueDate: '2021-01-01',
        expiryDate: '2023-01-01',
        status: 'expired' as const,
        address: 'Swarighat, Old Dhaka, Bangladesh',
      },
    ];

    for (const lic of authenticLicences) {
      const existing = await this.licenceRepo.findOne({ where: { licenceNumber: lic.licenceNumber } });
      if (!existing) {
        await this.licenceRepo.save(this.licenceRepo.create(lic));
      }
    }
  }

  private async seedFoodSafetyDocuments() {
    const defaultManufacturer = await this.userRepo.findOne({
      where: { email: 'manufacturer@truelabel.demo' },
    });
    const manufacturerId = defaultManufacturer?.id || 2;

    const authenticDocs = [
      {
        manufacturerId,
        companyName: 'BRAC Enterprises (Aarong Dairy)',
        documentType: 'iso22000' as const,
        certificateNumber: 'ISO-22000-BDS1702-2024',
        issuer: 'SGS Bangladesh & BSTI',
        issueDate: '2024-01-10',
        expiryDate: '2027-01-10',
        fileUrl: 'https://truelabel.storage/demo/certs/aarong-iso22000.pdf',
        status: 'approved' as const,
        reviewedById: 3,
        reviewedByName: 'Dr. Marcus Vance',
        reviewDate: new Date('2024-01-15'),
        notes: 'ISO 22000:2018 food safety surveillance audit passed with 99% hygiene compliance. Zero coliform or pathogen presence confirmed.',
      },
      {
        manufacturerId,
        companyName: 'Oatly AB',
        documentType: 'organic' as const,
        certificateNumber: 'EU-ORG-SE-001-992',
        issuer: 'Kiwa Certification Sweden & EU Organic Bio-Siegel',
        issueDate: '2024-02-01',
        expiryDate: '2027-02-01',
        fileUrl: 'https://truelabel.storage/demo/certs/oatly-eu-organic.pdf',
        status: 'approved' as const,
        reviewedById: 3,
        reviewedByName: 'Dr. Marcus Vance',
        reviewDate: new Date('2024-02-05'),
        notes: 'Certified 100% organic oats sourced from pesticide-free Nordic certified cooperative agriculture.',
      },
      {
        manufacturerId,
        companyName: 'PRAN Foods Ltd.',
        documentType: 'halal' as const,
        certificateNumber: 'HALAL-IFB-2024-7721',
        issuer: 'Islamic Foundation Bangladesh',
        issueDate: '2024-01-15',
        expiryDate: '2027-01-15',
        fileUrl: 'https://truelabel.storage/demo/certs/pran-halal.pdf',
        status: 'approved' as const,
        reviewedById: 3,
        reviewedByName: 'Dr. Marcus Vance',
        reviewDate: new Date('2024-01-20'),
        notes: 'Beverage manufacturing facility inspected and certified 100% Shariah and Halal food safety compliant.',
      },
      {
        manufacturerId,
        companyName: 'Nestlé Bangladesh Ltd.',
        documentType: 'lab_test' as const,
        certificateNumber: 'LAB-HEAVYMETALS-ICDDRB-2024',
        issuer: 'National Food Safety Laboratory (ICDDR,B)',
        issueDate: '2024-08-01',
        expiryDate: '2025-08-01',
        fileUrl: 'https://truelabel.storage/demo/certs/maggi-icddrb-lab.pdf',
        status: 'approved' as const,
        reviewedById: 3,
        reviewedByName: 'Dr. Marcus Vance',
        reviewDate: new Date('2024-08-10'),
        notes: 'Heavy metal laboratory ICP-MS testing confirmed Lead < 0.05 ppm and Cadmium undetected (well within BSTI BDS 1552 limit).',
      },
      {
        manufacturerId,
        companyName: 'Barilla G. e R. Fratelli SpA',
        documentType: 'trade_licence' as const,
        certificateNumber: 'EU-TRADE-PARMA-2024',
        issuer: 'Chamber of Commerce of Parma & EFSA',
        issueDate: '2024-03-01',
        expiryDate: '2026-03-01',
        fileUrl: 'https://truelabel.storage/demo/certs/barilla-trade.pdf',
        status: 'pending' as const,
        notes: 'Commercial export and food safety renewal documentation awaiting inspector verification.',
      },
      {
        manufacturerId,
        companyName: 'Substandard Chemical Additives Co.',
        documentType: 'lab_test' as const,
        certificateNumber: 'LAB-AZO-DYE-2023-FAIL',
        issuer: 'Central Food Testing Laboratory',
        issueDate: '2023-11-01',
        expiryDate: '2024-11-01',
        fileUrl: 'https://truelabel.storage/demo/certs/azo-dye-fail.pdf',
        status: 'rejected' as const,
        rejectionReason: 'Detected non-permitted synthetic industrial Sudan Red dye adulteration exceeding 0.005mg/kg limit.',
        reviewedById: 3,
        reviewedByName: 'Dr. Marcus Vance',
        reviewDate: new Date('2023-11-15'),
        notes: 'Document rejected for unauthorized chemical coloring adulteration.',
      },
    ];

    for (const doc of authenticDocs) {
      const existing = await this.documentRepo.findOne({ where: { certificateNumber: doc.certificateNumber } });
      if (!existing) {
        await this.documentRepo.save(this.documentRepo.create(doc));
      }
    }
  }

  /**
   * Feature F11 & F13: Seed authentic credibility-weighted reviews and safety complaints (idempotent).
   */
  private async seedCommunityReviewsAndReports() {
    const sharah = await this.userRepo.findOne({ where: { email: 'consumer@truelabel.demo' } });
    const tariq = await this.userRepo.findOne({ where: { email: 'tariq.consumer@truelabel.demo' } });
    if (!sharah || !tariq) return;

    const oatly = await this.productRepo.findOne({ where: { barcode: '7394376311482' } });
    const chobani = await this.productRepo.findOne({ where: { barcode: '089470001382' } });
    const frooto = await this.productRepo.findOne({ where: { barcode: '0831730009403' } });
    const cola = await this.productRepo.findOne({ where: { barcode: '5449000000996' } });

    const seedReviews = [
      oatly && {
        productId: oatly.id,
        userId: sharah.id,
        tasteRating: 5,
        labelAccuracyRating: 5,
        packagingRating: 5,
        purchaseExperienceRating: 4,
        rating: 5,
        credibilityWeight: 1.14,
        visibility: 'visible' as const,
        title: 'Clean oat flavor and very clear allergen disclosure',
        comment:
          'Steams cleanly for espresso without separating. The nutrition table and oat percentage printed on the carton match TrueLabel exactly, and the cap seal was completely intact.',
        manufacturerReply:
          'Thank you for the detailed feedback, Sharah. Every Oatly Barista carton undergoes seal-integrity testing before dispatch.',
        repliedAt: '2026-11-16T10:30:00.000Z',
      },
      oatly && {
        productId: oatly.id,
        userId: tariq.id,
        tasteRating: 4,
        labelAccuracyRating: 5,
        packagingRating: 4,
        purchaseExperienceRating: 4,
        rating: 4,
        credibilityWeight: 1.06,
        visibility: 'visible' as const,
        title: 'Good dairy-free alternative, slightly pricey locally',
        comment:
          'Ingredient panel is straightforward with zero hidden dairy allergens. Packaging arrived unbruised, though stock sells out quickly at neighborhood supermarkets.',
        manufacturerReply: null,
        repliedAt: null,
      },
      chobani && {
        productId: chobani.id,
        userId: tariq.id,
        tasteRating: 5,
        labelAccuracyRating: 5,
        packagingRating: 4,
        purchaseExperienceRating: 5,
        rating: 5,
        credibilityWeight: 1.08,
        visibility: 'visible' as const,
        title: 'Thick texture and transparent protein count',
        comment:
          'High protein per serving with zero added refined sugar. The foil lid seal was tight and cold-chain storage at the store kept it fresh.',
        manufacturerReply: null,
        repliedAt: null,
      },
      cola && {
        productId: cola.id,
        userId: sharah.id,
        tasteRating: 4,
        labelAccuracyRating: 3,
        packagingRating: 5,
        purchaseExperienceRating: 4,
        rating: 4,
        credibilityWeight: 1.14,
        visibility: 'visible' as const,
        title: 'Familiar taste, but sugar and E150d additives stand out',
        comment:
          'Can seal and carbonation were consistent, but checking the nutrition breakdown here highlighted 10.6g sugar per 100ml and caramel color E150d which is easy to miss on the small printed panel.',
        manufacturerReply: null,
        repliedAt: null,
      },
    ].filter(Boolean);

    for (const item of seedReviews) {
      if (!item) continue;
      const existing = await this.reviewRepo.findOne({
        where: { productId: item.productId, userId: item.userId },
      });
      if (!existing) {
        await this.reviewRepo.save(this.reviewRepo.create(item));
      }
    }

    const seedReports = [
      frooto && {
        productId: frooto.id,
        userId: sharah.id,
        category: 'damaged' as const,
        batchCode: 'BATCH-FRT-2026-09',
        purchasePlace: 'Banani Road 11 Supermart, Dhaka',
        referenceNumber: 'TL-20261116-FRT001A1',
        description:
          'Purchased a 250ml mango drink pack from the chilled shelf; the bottom corner seam was visibly bulging and leaking sticky residue despite expiry date reading May 2027.',
        status: 'pending' as const,
      },
      frooto && {
        productId: frooto.id,
        userId: tariq.id,
        category: 'spoiled' as const,
        batchCode: 'BATCH-FRT-2026-09',
        purchasePlace: 'Gulshan 2 Convenience Store, Dhaka',
        referenceNumber: 'TL-20261117-FRT002B2',
        description:
          'Opened a carton from batch BATCH-FRT-2026-09 and noticed a strong fermented sour smell immediately upon piercing the seal. Did not consume the drink.',
        status: 'investigating' as const,
      },
      cola && {
        productId: cola.id,
        userId: sharah.id,
        category: 'mislabelled' as const,
        batchCode: 'CC-26-4412',
        purchasePlace: 'Dhanmondi Satmasjid Rd Grocer, Dhaka',
        referenceNumber: 'TL-20261117-CC003C3',
        description:
          'The printed best-before date stamp on the bottle neck was heavily smudged and unreadable, and the secondary import sticker partially covered the nutrition per 100ml column.',
        status: 'pending' as const,
      },
    ].filter(Boolean);

    for (const rep of seedReports) {
      if (!rep) continue;
      const existing = await this.reportRepo.findOne({
        where: { referenceNumber: rep.referenceNumber },
      });
      if (!existing) {
        await this.reportRepo.save(this.reportRepo.create(rep));
      }
    }
  }
}
