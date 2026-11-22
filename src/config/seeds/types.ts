export interface SeedProductIngredient {
  name: string;
  isAllergen?: boolean;
  allergenType?: string;
  additiveCode?: string;
  hazardLevel?: 'safe' | 'caution' | 'warning';
  explanation?: string;
}

export interface SeedProductNutritionFact {
  nutrient: string;
  amountPer100g: number;
  amountPerServing?: number;
  unit: string;
  dailyValuePercentage?: number;
}

export interface SeedProductDefinition {
  name: string;
  brand: string;
  category: string;
  barcode: string;
  description: string;
  servingSize: number;
  servingUnit: string;
  status: 'active' | 'archived' | 'banned';
  qualityScore: number;
  dietaryTags: string[];
  manufacturerEmail?: string;
  banReason?: string;
  bannedAt?: string;
  bannedBy?: number;
  ingredients: SeedProductIngredient[];
  nutritionFacts: SeedProductNutritionFact[];
}

export interface SeedUserDefinition {
  name: string;
  email: string;
  role: 'consumer' | 'manufacturer' | 'inspector' | 'admin';
  isVerified?: boolean;
}

export interface SeedLicenceDefinition {
  licenceNumber: string;
  companyName: string;
  authority: string;
  category: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'suspended';
  address: string;
}

export interface SeedDocumentDefinition {
  manufacturerEmail?: string;
  companyName: string;
  documentType: 'trade_licence' | 'iso22000' | 'halal' | 'organic' | 'lab_test';
  certificateNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  status: 'approved' | 'pending' | 'rejected';
  rejectionReason?: string;
  reviewedByName?: string;
  reviewDate?: Date;
  notes?: string;
}

export interface SeedReviewDefinition {
  productBarcode: string;
  userEmail: string;
  tasteRating: number;
  labelAccuracyRating: number;
  packagingRating: number;
  purchaseExperienceRating: number;
  rating: number;
  credibilityWeight: number;
  visibility: 'visible' | 'hidden';
  title: string;
  comment: string;
  manufacturerReply?: string | null;
  repliedAt?: string | null;
}

export interface SeedReportDefinition {
  productBarcode: string;
  userEmail: string;
  category: 'counterfeit' | 'spoiled' | 'contaminated' | 'damaged' | 'mislabelled';
  batchCode?: string;
  purchasePlace: string;
  referenceNumber: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
}
