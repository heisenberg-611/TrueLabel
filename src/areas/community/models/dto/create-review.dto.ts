import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  tasteRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  labelAccuracyRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  packagingRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  purchaseExperienceRating: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  comment: string;
}

export class ReplyToReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reply: string;
}
