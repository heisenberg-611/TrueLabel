import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Feature F04: Administrative Scoring Weight Configuration DTO
 * Individual component weights must be 0-100 integers; service enforces exact sum of 100.
 */
export class UpdateScoringWeightsDto {
  @Type(() => Number)
  @IsInt({ message: 'Ingredient weight must be a whole number.' })
  @Min(0, { message: 'Ingredient weight cannot be negative.' })
  @Max(100, { message: 'Ingredient weight cannot exceed 100%.' })
  ingredientWeight: number;

  @Type(() => Number)
  @IsInt({ message: 'Nutrition weight must be a whole number.' })
  @Min(0, { message: 'Nutrition weight cannot be negative.' })
  @Max(100, { message: 'Nutrition weight cannot exceed 100%.' })
  nutritionWeight: number;

  @Type(() => Number)
  @IsInt({ message: 'Verification weight must be a whole number.' })
  @Min(0, { message: 'Verification weight cannot be negative.' })
  @Max(100, { message: 'Verification weight cannot exceed 100%.' })
  verificationWeight: number;

  @Type(() => Number)
  @IsInt({ message: 'Recall & safety weight must be a whole number.' })
  @Min(0, { message: 'Recall & safety weight cannot be negative.' })
  @Max(100, { message: 'Recall & safety weight cannot exceed 100%.' })
  recallWeight: number;

  @Type(() => Number)
  @IsInt({ message: 'Community feedback weight must be a whole number.' })
  @Min(0, { message: 'Community feedback weight cannot be negative.' })
  @Max(100, { message: 'Community feedback weight cannot exceed 100%.' })
  communityWeight: number;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Configuration note cannot exceed 300 characters.' })
  notes?: string;
}
