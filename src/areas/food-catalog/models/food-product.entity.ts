import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Ingredient } from './ingredient.entity';
import { NutritionFact } from './nutrition-fact.entity';

export type FoodProductStatus = 'active' | 'archived' | 'banned';

@Entity('food_products')
export class FoodProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 150 })
  brand: string;

  @Column({ length: 100 })
  category: string; // e.g. Dairy, Beverages, Bakery, Snacks, Pantry

  @Index({ unique: true })
  @Column({ length: 64, unique: true })
  barcode: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'float', default: 100 })
  servingSize: number;

  @Column({ length: 20, default: 'g' })
  servingUnit: string; // 'g' or 'ml'

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: FoodProductStatus;

  // Regulatory Ban & Quarantine Metadata (Feature F01 Governance)
  @Column({ type: 'text', nullable: true })
  banReason: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bannedAt: string | null;

  @Column({ type: 'int', nullable: true })
  bannedBy: number | null;

  // Explainable Quality Score (provisional baseline 0-100 until F04 scoring engine computes dynamic updates)
  @Column({ type: 'float', default: 75 })
  qualityScore: number;

  @Column({ default: 1 })
  manufacturerId: number;

  @Column({ type: 'simple-array', nullable: true })
  dietaryTags: string[]; // e.g. ['vegan', 'gluten-free', 'halal']

  @OneToMany(() => Ingredient, (ingredient) => ingredient.product, {
    cascade: true,
    eager: true,
  })
  ingredients: Ingredient[];

  @OneToMany(() => NutritionFact, (fact) => fact.product, {
    cascade: true,
    eager: true,
  })
  nutritionFacts: NutritionFact[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

