import { IsIn, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsIn(['counterfeit', 'spoiled', 'contaminated', 'damaged', 'mislabelled'])
  category: 'counterfeit' | 'spoiled' | 'contaminated' | 'damaged' | 'mislabelled';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  batchCode?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  purchasePlace: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;
}

export class UpdateReportStatusDto {
  @IsIn(['investigating', 'resolved', 'dismissed'])
  status: 'investigating' | 'resolved' | 'dismissed';
}
