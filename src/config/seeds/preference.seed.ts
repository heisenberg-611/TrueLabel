export interface SeedPreferenceProfile {
  userEmail: string;
  allergies: string[];
  dietaryPreferences: string[];
  dislikedIngredients: string[];
  calorieGoal: number;
  maxSugarPerServing: number;
  maxSodiumPerServing: number;
  minProteinPerServing: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active';
}

export const SEED_PREFERENCE_PROFILES: SeedPreferenceProfile[] = [
  // 1. Sharah: Vegan consumer with Peanut and Cow's Milk allergies
  {
    userEmail: 'consumer@truelabel.demo',
    allergies: ['Peanut', 'Milk'],
    dietaryPreferences: ['Vegan'],
    dislikedIngredients: ['High Fructose Corn Syrup', 'Palm Oil'],
    calorieGoal: 2000,
    maxSugarPerServing: 10,
    maxSodiumPerServing: 1.5,
    minProteinPerServing: 10,
    age: 26,
    gender: 'female',
    heightCm: 168,
    weightKg: 58,
    activityLevel: 'moderate',
  },

  // 2. Maya: Celiac Disease (Strict Gluten Free) and Dairy Free
  {
    userEmail: 'maya.celiac@truelabel.demo',
    allergies: ['Gluten', 'Wheat', 'Milk'],
    dietaryPreferences: ['Gluten-Free', 'Vegetarian'],
    dislikedIngredients: ['Malt Extract', 'Artificial Color'],
    calorieGoal: 1850,
    maxSugarPerServing: 12,
    maxSodiumPerServing: 1.2,
    minProteinPerServing: 12,
    age: 29,
    gender: 'female',
    heightCm: 162,
    weightKg: 54,
    activityLevel: 'light',
  },

  // 3. Kabir: Cardiovascular Health — Strict Low-Sodium and Low-Sugar Diet
  {
    userEmail: 'kabir.health@truelabel.demo',
    allergies: ['Shellfish', 'Soy'],
    dietaryPreferences: ['Halal', 'Low-Sugar'],
    dislikedIngredients: ['Monosodium Glutamate', 'Sodium Benzoate', 'Hydrogenated Rapeseed and Soybean Oil'],
    calorieGoal: 2200,
    maxSugarPerServing: 5,
    maxSodiumPerServing: 0.8,
    minProteinPerServing: 15,
    age: 48,
    gender: 'male',
    heightCm: 175,
    weightKg: 76,
    activityLevel: 'moderate',
  },

  // 4. Tariq: High Protein Athletic Fitness profile
  {
    userEmail: 'tariq.consumer@truelabel.demo',
    allergies: [],
    dietaryPreferences: ['Halal'],
    dislikedIngredients: ['Aspartame', 'Acesulfame Potassium'],
    calorieGoal: 2600,
    maxSugarPerServing: 15,
    maxSodiumPerServing: 2.2,
    minProteinPerServing: 20,
    age: 24,
    gender: 'male',
    heightCm: 182,
    weightKg: 80,
    activityLevel: 'very_active',
  },
];
