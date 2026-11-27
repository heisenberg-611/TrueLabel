import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HazardLevel } from '../../food-catalog/models/ingredient.entity';

export type FoodRuleType =
  | 'ingredient'
  | 'additive'
  | 'allergen'
  | 'category_restriction';

/**
 * Feature F03: Administrative Food Rule Base Entity
 * Stores canonical ingredient, additive (E-code/INS), allergen, and category-specific
 * regulatory classification rules maintained by platform administrators.
 */
@Entity('food_rules')
export class FoodRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 160 })
  name: string;

  /**
   * Comma-separated lowercase matching terms/synonyms (e.g. "caramel color, e150d, sulfite ammonia caramel")
   */
  @Column({ type: 'text' })
  pattern: string;

  @Column({
    type: 'varchar',
    length: 40,
    default: 'ingredient',
  })
  ruleType: FoodRuleType;

  @Column({ length: 50, nullable: true })
  additiveCode: string | null;

  @Column({ length: 100, nullable: true })
  allergenType: string | null;

  /**
   * Optional product category restriction (e.g. "Beverages", "Snacks & Confectionery").
   * Null means the rule applies globally across all food categories.
   */
  @Column({ length: 120, nullable: true })
  categoryScope: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'safe',
  })
  hazardLevel: HazardLevel;

  @Column({ length: 120, nullable: true })
  fdaStatus: string | null;

  @Column({ length: 120, nullable: true })
  euStatus: string | null;

  @Column({ type: 'text' })
  explanation: string;

  @Column({ length: 200, default: 'TrueLabel Regulatory Rule Base' })
  source: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
