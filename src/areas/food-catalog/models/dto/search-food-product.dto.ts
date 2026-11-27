import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export class SearchFoodProductDto {
  @IsOptional()
  @IsString()
  q?: string; // Query: matches name, brand, or barcode

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  status?: string; // e.g. 'all', 'active', 'archived', 'banned'

  @IsOptional()
  @IsString()
  tag?: string; // dietary tag (e.g. vegan, halal, gluten-free)

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  minScore?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  limit?: number = 12;
}
