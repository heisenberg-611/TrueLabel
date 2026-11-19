// Feature F16 / N4 Preparation: MetabolicCalculatorService Unit Tests (Pure Scientific Engine)
import { MetabolicCalculatorService } from './metabolic-calculator.service';
import { PreferenceProfile } from '../models/preference-profile.entity';

describe('MetabolicCalculatorService (Pure Scientific Engine)', () => {
  let calculator: MetabolicCalculatorService;

  const mockProfile: PreferenceProfile = {
    id: 1,
    userId: 10,
    allergies: ['Peanut'],
    dietaryPreferences: ['Vegan'],
    dislikedIngredients: [],
    calorieGoal: null,
    maxSugarPerServing: null,
    maxSodiumPerServing: null,
    minProteinPerServing: null,
    age: 30,
    gender: 'male',
    heightCm: 180,
    weightKg: 75,
    activityLevel: 'moderate',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Pure calculation engine with zero database dependencies
    calculator = new MetabolicCalculatorService();
  });

  it('should return uncalculated result when profile is null', () => {
    const result = calculator.calculateMetabolicPlan(null);
    expect(result.isCalculated).toBe(false);
    expect(result.bmr).toBeNull();
    expect(result.missingMetrics).toEqual(['age', 'gender', 'height', 'weight', 'activity level']);
  });

  it('should list missing metrics when body fields are missing', () => {
    const incompleteProfile: PreferenceProfile = {
      ...mockProfile,
      heightCm: null,
      weightKg: null,
      activityLevel: null,
    };

    const result = calculator.calculateMetabolicPlan(incompleteProfile);
    expect(result.isCalculated).toBe(false);
    expect(result.missingMetrics).toContain('height');
    expect(result.missingMetrics).toContain('weight');
    expect(result.missingMetrics).toContain('activity level');
  });

  it('should accurately compute Mifflin-St Jeor BMR, TDEE, and macro splits for male', () => {
    // BMR = 10*75 + 6.25*180 - 5*30 + 5 = 750 + 1125 - 150 + 5 = 1730 kcal
    // TDEE = 1730 * 1.55 = 2681.5 -> Math.round = 2682 kcal
    const result = calculator.calculateMetabolicPlan(mockProfile);

    expect(result.isCalculated).toBe(true);
    expect(result.bmr).toBe(1730);
    expect(result.tdee).toBe(2682);
    expect(result.dailyCalorieTarget).toBe(2682);
    expect(result.calorieGoalSource).toBe('tdee_maintenance');

    // Macro splits: 25% protein, 50% carbs, 25% fat
    expect(result.macroSplit).toBeDefined();
    expect(result.macroSplit?.proteinPercentage).toBe(25);
    expect(result.macroSplit?.carbsPercentage).toBe(50);
    expect(result.macroSplit?.fatPercentage).toBe(25);

    // Ceilings: WHO default sodium <= 2.0g
    expect(result.dailyCeilings?.maxSodiumGrams).toBe(2.0);
  });

  it('should accurately compute Mifflin-St Jeor for female', () => {
    // BMR = 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330 kcal
    // TDEE = 1330 * 1.55 = 2061.5 -> 2062 kcal
    const femaleProfile: PreferenceProfile = {
      ...mockProfile,
      gender: 'female',
      age: 28,
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'moderate',
      maxSodiumPerServing: 1.5,
    };

    const result = calculator.calculateMetabolicPlan(femaleProfile);

    expect(result.isCalculated).toBe(true);
    expect(result.bmr).toBe(1330);
    expect(result.tdee).toBe(2062);
    expect(result.dailyCeilings?.maxSodiumGrams).toBe(4.5);
  });

  it('should flag underage users with a pediatric advisory note', () => {
    const underageProfile: PreferenceProfile = {
      ...mockProfile,
      age: 15,
    };

    const result = calculator.calculateMetabolicPlan(underageProfile);
    expect(result.isUnderage).toBe(true);
    expect(result.advisoryNote).toContain('pediatrician');
  });

  it('should warn when target calories fall below clinical safe floor', () => {
    const lowCalorieProfile: PreferenceProfile = {
      ...mockProfile,
      calorieGoal: 1000,
    };

    const result = calculator.calculateMetabolicPlan(lowCalorieProfile);
    expect(result.dailyCalorieTarget).toBe(1000);
    expect(result.calorieGoalSource).toBe('deficit');
    expect(result.advisoryNote).toContain('clinical safe floor');
  });

  it('should detect calorie surplus goal when custom goal exceeds TDEE by >= 250 kcal', () => {
    const surplusProfile: PreferenceProfile = {
      ...mockProfile,
      calorieGoal: 3000,
    };

    const result = calculator.calculateMetabolicPlan(surplusProfile);
    expect(result.dailyCalorieTarget).toBe(3000);
    expect(result.calorieGoalSource).toBe('surplus');
    expect(result.goalLabel).toContain('Calorie Surplus');
  });
});
