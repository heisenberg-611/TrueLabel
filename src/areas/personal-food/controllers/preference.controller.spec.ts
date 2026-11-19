// Feature F16: Food Preference & Allergen Profile
import { Test, TestingModule } from '@nestjs/testing';
import { PreferenceController } from './preference.controller';
import { PreferenceService } from '../services/preference.service';
import { UpdatePreferenceProfileDto } from '../models/dto/update-preference-profile.dto';

describe('PreferenceController (Unit Tests)', () => {
  let controller: PreferenceController;
  let service: jest.Mocked<PreferenceService>;

  const mockProfile = {
    id: 1,
    userId: 5,
    allergies: ['Peanut'],
    dietaryPreferences: ['Vegan'],
    dislikedIngredients: [],
    calorieGoal: 2000,
    maxSugarPerServing: null,
    maxSodiumPerServing: null,
    minProteinPerServing: null,
    age: null,
    gender: null,
    heightCm: null,
    weightKg: null,
    activityLevel: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      findOrCreate: jest.fn(),
      updateProfile: jest.fn(),
      findByUserId: jest.fn(),
      evaluateProductConflict: jest.fn(),
      calculateMetabolicPlan: jest.fn().mockReturnValue({
        isCalculated: false,
        bmr: null,
        tdee: null,
        missingMetrics: ['age', 'gender', 'height', 'weight', 'activity level'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferenceController],
      providers: [
        {
          provide: PreferenceService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PreferenceController>(PreferenceController);
    service = module.get(PreferenceService);
  });

  describe('getProfile', () => {
    it('should return view model with user profile and standard options (Arrange-Act-Assert)', async () => {
      // Arrange
      service.findOrCreate.mockResolvedValue(mockProfile as any);
      const req: any = {
        session: {
          user: { id: 5, name: 'Alice', email: 'alice@test.com', role: 'consumer' },
        },
      };

      // Act
      const result = await controller.getProfile(req, 'true');

      // Assert
      expect(result).toBeDefined();
      expect(result.profile).toEqual(mockProfile);
      expect(result.saved).toBe(true);
      expect(result.standardAllergens).toContain('Peanut');
      expect(result.standardDiets).toContain('Vegan');
      expect(service.findOrCreate).toHaveBeenCalledWith(5);
    });

    it('should redirect non-consumer roles to their role dashboard', async () => {
      const req: any = {
        session: {
          user: { id: 10, name: 'PRAN', email: 'pran@test.com', role: 'manufacturer' },
        },
      };
      const res: any = { redirect: jest.fn() };

      await controller.getProfile(req, undefined, res);

      expect(res.redirect).toHaveBeenCalledWith('/dashboard/manufacturer');
      expect(service.findOrCreate).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should delegate update to PreferenceService and redirect', async () => {
      // Arrange
      service.updateProfile.mockResolvedValue(mockProfile as any);
      const req: any = {
        session: {
          user: { id: 5, name: 'Alice', email: 'alice@test.com', role: 'consumer' },
        },
        body: {
          allergies: ['Peanut', 'Milk'],
          dietaryPreferences: ['Vegan'],
        },
      };
      const res: any = {
        redirect: jest.fn(),
      };
      const dto: UpdatePreferenceProfileDto = {
        allergies: ['Peanut', 'Milk'],
        dietaryPreferences: ['Vegan'],
        calorieGoal: 2100,
      };

      // Act
      await controller.updateProfile(dto, req, res);

      // Assert
      expect(service.updateProfile).toHaveBeenCalledWith(5, dto);
      expect(res.redirect).toHaveBeenCalledWith('/personal/profile?saved=true');
    });

    it('should re-render profile view with error if service throws', async () => {
      // Arrange
      service.updateProfile.mockRejectedValue(new Error('Database write error'));
      service.findOrCreate.mockResolvedValue(mockProfile as any);
      const req: any = {
        session: {
          user: { id: 5, name: 'Alice', email: 'alice@test.com', role: 'consumer' },
        },
        body: {},
      };
      const res: any = {
        render: jest.fn(),
      };
      const dto: UpdatePreferenceProfileDto = {
        calorieGoal: 2100,
      };

      // Act
      await controller.updateProfile(dto, req, res);

      // Assert
      expect(res.render).toHaveBeenCalledWith(
        'areas/personal-food/views/profile',
        expect.objectContaining({
          error: 'Database write error',
        }),
      );
    });
  });
});

