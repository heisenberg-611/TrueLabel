// Feature F16: Food Preference & Allergen Profile Orchestrator Unit Tests
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenceService } from './preference.service';
import { ConflictEvaluatorService } from './conflict-evaluator.service';
import { MetabolicCalculatorService } from './metabolic-calculator.service';
import { PreferenceProfile } from '../models/preference-profile.entity';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { UpdatePreferenceProfileDto } from '../models/dto/update-preference-profile.dto';

describe('PreferenceService (Orchestrator Unit Tests)', () => {
  let service: PreferenceService;
  let repo: jest.Mocked<Repository<PreferenceProfile>>;
  let conflictEvaluator: jest.Mocked<ConflictEvaluatorService>;
  let metabolicCalculator: jest.Mocked<MetabolicCalculatorService>;

  const mockProfile: PreferenceProfile = {
    id: 1,
    userId: 10,
    allergies: ['Peanut', 'Milk'],
    dietaryPreferences: ['Vegan'],
    dislikedIngredients: ['Cilantro'],
    calorieGoal: 2000,
    maxSugarPerServing: 5,
    maxSodiumPerServing: 1.5,
    minProteinPerServing: 10,
    age: 28,
    gender: 'female',
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockConflictEvaluator = {
      evaluateProductConflict: jest.fn(),
    };

    const mockMetabolicCalculator = {
      calculateMetabolicPlan: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferenceService,
        {
          provide: getRepositoryToken(PreferenceProfile),
          useValue: mockRepo,
        },
        {
          provide: ConflictEvaluatorService,
          useValue: mockConflictEvaluator,
        },
        {
          provide: MetabolicCalculatorService,
          useValue: mockMetabolicCalculator,
        },
      ],
    }).compile();

    service = module.get<PreferenceService>(PreferenceService);
    repo = module.get(getRepositoryToken(PreferenceProfile));
    conflictEvaluator = module.get(ConflictEvaluatorService);
    metabolicCalculator = module.get(MetabolicCalculatorService);
  });

  describe('findByUserId', () => {
    it('should return the user profile when found (Arrange-Act-Assert)', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockProfile);

      // Act
      const result = await service.findByUserId(10);

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: 10 } });
      expect(result).toEqual(mockProfile);
    });

    it('should return null when profile does not exist', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByUserId(99);

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: 99 } });
      expect(result).toBeNull();
    });
  });

  describe('findOrCreate', () => {
    it('should return existing profile if present', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockProfile);

      // Act
      const result = await service.findOrCreate(10);

      // Assert
      expect(result).toEqual(mockProfile);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should create and save a new profile if not found', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);
      const defaultNewProfile = {
        userId: 25,
        allergies: [],
        dietaryPreferences: [],
        dislikedIngredients: [],
        calorieGoal: null,
        maxSugarPerServing: null,
        maxSodiumPerServing: null,
        minProteinPerServing: null,
      };
      repo.create.mockReturnValue(defaultNewProfile as any);
      repo.save.mockResolvedValue({ id: 2, ...defaultNewProfile } as any);

      // Act
      const result = await service.findOrCreate(25);

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: 25 } });
      expect(repo.create).toHaveBeenCalledWith(defaultNewProfile);
      expect(repo.save).toHaveBeenCalledWith(defaultNewProfile);
      expect(result.id).toBe(2);
      expect(result.userId).toBe(25);
    });
  });

  describe('updateProfile', () => {
    it('should update and persist modified fields', async () => {
      // Arrange
      repo.findOne.mockResolvedValue({ ...mockProfile });
      repo.save.mockImplementation(async (entity) => entity as PreferenceProfile);

      const dto: UpdatePreferenceProfileDto = {
        allergies: ['Gluten', 'Soy'],
        dietaryPreferences: ['Vegetarian', 'Halal'],
        dislikedIngredients: ['Mushrooms'],
        calorieGoal: 2200,
        maxSugarPerServing: 8,
        maxSodiumPerServing: 2.0,
        minProteinPerServing: 15,
        age: 30,
        gender: 'male',
        heightCm: 180,
        weightKg: 75,
        activityLevel: 'active',
      };

      // Act
      const result = await service.updateProfile(10, dto);

      // Assert
      expect(repo.save).toHaveBeenCalled();
      expect(result.allergies).toEqual(['Gluten', 'Soy']);
      expect(result.dietaryPreferences).toEqual(['Vegetarian', 'Halal']);
      expect(result.dislikedIngredients).toEqual(['Mushrooms']);
      expect(result.calorieGoal).toBe(2200);
      expect(result.maxSugarPerServing).toBe(8);
      expect(result.maxSodiumPerServing).toBe(2.0);
      expect(result.minProteinPerServing).toBe(15);
      expect(result.age).toBe(30);
      expect(result.gender).toBe('male');
      expect(result.heightCm).toBe(180);
      expect(result.weightKg).toBe(75);
      expect(result.activityLevel).toBe('active');
    });

    it('should gracefully handle null and undefined numeric body metric inputs', async () => {
      repo.findOne.mockResolvedValue({ ...mockProfile });
      repo.save.mockImplementation(async (entity) => entity as PreferenceProfile);

      const dto: UpdatePreferenceProfileDto = {
        age: null,
        heightCm: null,
        weightKg: null,
        calorieGoal: null,
      };

      const result = await service.updateProfile(10, dto);
      expect(result.age).toBeNull();
      expect(result.heightCm).toBeNull();
      expect(result.weightKg).toBeNull();
      expect(result.calorieGoal).toBeNull();
    });
  });

  describe('evaluateProductConflict (Delegation)', () => {
    it('should delegate evaluation to ConflictEvaluatorService and return its result', () => {
      const mockResult: any = {
        hasConflicts: false,
        hasAllergenConflict: false,
        hasDietaryConflict: false,
        hasNutritionWarning: false,
        conflicts: [],
        matchedAllergies: [],
        dietaryMismatches: [],
        isSafeForUser: true,
        profileConfigured: true,
      };
      conflictEvaluator.evaluateProductConflict.mockReturnValue(mockResult);

      const mockProduct = { id: 100, name: 'Sample Granola' } as FoodProduct;
      const result = service.evaluateProductConflict(mockProfile, mockProduct);

      expect(conflictEvaluator.evaluateProductConflict).toHaveBeenCalledWith(mockProfile, mockProduct);
      expect(result).toEqual(mockResult);
    });
  });

  describe('calculateMetabolicPlan (Delegation)', () => {
    it('should delegate calculation to MetabolicCalculatorService and return its result', () => {
      const mockPlan: any = {
        isCalculated: true,
        bmr: 1730,
        tdee: 2682,
        dailyCalorieTarget: 2682,
        macroSplit: { proteinGrams: 168, carbsGrams: 335, fatGrams: 75 },
      };
      metabolicCalculator.calculateMetabolicPlan.mockReturnValue(mockPlan);

      const result = service.calculateMetabolicPlan(mockProfile);

      expect(metabolicCalculator.calculateMetabolicPlan).toHaveBeenCalledWith(mockProfile);
      expect(result).toEqual(mockPlan);
    });
  });
});
