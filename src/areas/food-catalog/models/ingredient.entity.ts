import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FoodProduct } from './food-product.entity';

export type HazardLevel = 'safe' | 'caution' | 'warning';
export type IngredientAnalysisStatus = 'matched' | 'unknown';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column({ default: false })
  isAllergen: boolean;

  @Column({ length: 100, nullable: true })
  allergenType: string; // e.g. 'Peanut', 'Milk', 'Gluten', 'Soy', 'Tree Nut'

  @Column({ length: 50, nullable: true })
  additiveCode: string; // e.g. 'E150d', 'E621'

  @Column({
    type: 'varchar',
    length: 20,
    default: 'safe',
  })
  hazardLevel: HazardLevel;

  @Column({ type: 'text', nullable: true })
  explanation: string;

  // Feature F03: Rule-base traceability & unknown ingredient separation
  @Column({
    type: 'varchar',
    length: 20,
    default: 'unknown',
  })
  analysisStatus: IngredientAnalysisStatus;

  @Column({ type: 'int', nullable: true })
  matchedRuleId: number | null;

  @Column({ length: 200, nullable: true })
  ruleSource: string | null;

  @Column({ length: 120, nullable: true })
  fdaStatus: string | null;

  @Column({ length: 120, nullable: true })
  euStatus: string | null;

  @ManyToOne(() => FoodProduct, (product) => product.ingredients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: FoodProduct;
}
