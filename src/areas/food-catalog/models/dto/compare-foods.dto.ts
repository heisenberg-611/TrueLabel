import { IsOptional, IsString } from 'class-validator';

export class CompareFoodsDto {
  @IsOptional()
  ids?: string | string[];

  @IsOptional()
  @IsString()
  category?: string;
}

/**
 * Parse `?ids=1,2,3` or repeated `?ids=1&ids=2` into ordered unique positive integer IDs.
 */
export function parseCompareProductIds(
  rawIds?: string | string[] | number[] | null,
): number[] {
  if (rawIds === undefined || rawIds === null) {
    return [];
  }

  const tokens: string[] = Array.isArray(rawIds)
    ? rawIds.flatMap((entry) => String(entry).split(','))
    : String(rawIds).split(',');

  const uniqueIds: number[] = [];
  for (const token of tokens) {
    const cleaned = token.trim();
    if (!cleaned || !/^\d+$/.test(cleaned)) continue;
    const id = parseInt(cleaned, 10);
    if (Number.isInteger(id) && id > 0 && !uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  }

  return uniqueIds;
}
