// Feature F01: Administrative Food Product Banning DTO
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class BanFoodProductDto {
  @IsNotEmpty({ message: 'A regulatory or safety reason is required to ban a food item' })
  @IsString({ message: 'Ban reason must be a valid text description' })
  @MinLength(5, { message: 'Ban reason must be at least 5 characters describing the violation or safety concern' })
  @MaxLength(1000, { message: 'Ban reason cannot exceed 1000 characters' })
  reason: string;
}
