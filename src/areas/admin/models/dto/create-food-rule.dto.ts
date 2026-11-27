import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { FoodRuleType } from '../food-rule.entity';
import { HazardLevel } from '../../../food-catalog/models/ingredient.entity';

/**
 * Feature F03: DTO for creating or updating an administrative FoodRule
 */
export class CreateFoodRuleDto {
  @IsNotEmpty({ message: 'Rule name is required' })
  @IsString()
  @MaxLength(160)
  name: string;

  @IsNotEmpty({ message: 'Match pattern or keywords are required' })
  @IsString()
  pattern: string;

  @IsNotEmpty({ message: 'Rule type is required' })
  @IsIn(['ingredient', 'additive', 'allergen', 'category_restriction'], {
    message: 'Rule type must be ingredient, additive, allergen, or category_restriction',
  })
  ruleType: FoodRuleType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  additiveCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  allergenType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryScope?: string;

  @IsNotEmpty({ message: 'Hazard level is required' })
  @IsIn(['safe', 'caution', 'warning'], {
    message: 'Hazard level must be safe, caution, or warning',
  })
  hazardLevel: HazardLevel;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fdaStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  euStatus?: string;

  @IsNotEmpty({ message: 'Rule explanation is required' })
  @IsString()
  explanation: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 'on' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return true;
  })
  @IsBoolean()
  isActive?: boolean;
}
