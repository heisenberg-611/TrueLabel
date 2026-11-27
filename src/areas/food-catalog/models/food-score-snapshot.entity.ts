import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FoodProduct } from './food-product.entity';

export type ScoreTrigger =
  | 'seed'
  | 'product_create'
  | 'product_edit'
  | 'rule_update'
  | 'weight_update'
  | 'product_ban'
  | 'product_unban'
  | 'signal_sync'
  | 'manual';

/**
 * Feature F04: Explainable Food Quality Score History Snapshot
 * Persists reproducible component breakdowns, weights, and provisional flags over time.
 */
@Entity('food_score_snapshots')
export class FoodScoreSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  productId: number;

  // Forward-compatible link for Sprint 3 F21 formulation version tracking
  @Column({ type: 'int', nullable: true })
  versionId: number | null;

  @Column({ type: 'float' })
  totalScore: number;

  @Column({ type: 'int', default: 2 })
  tierNumber: number;

  @Column({ type: 'float' })
  ingredientScore: number;

  @Column({ type: 'float' })
  nutritionScore: number;

  @Column({ type: 'float' })
  verificationScore: number;

  @Column({ type: 'float' })
  recallScore: number;

  @Column({ type: 'float' })
  communityScore: number;

  @Column({ type: 'int' })
  ingredientWeight: number;

  @Column({ type: 'int' })
  nutritionWeight: number;

  @Column({ type: 'int' })
  verificationWeight: number;

  @Column({ type: 'int' })
  recallWeight: number;

  @Column({ type: 'int' })
  communityWeight: number;

  @Column({ type: 'text' })
  componentDetailsJson: string;

  @Column({ type: 'simple-array', nullable: true })
  provisionalComponents: string[];

  @Column({ default: false })
  isProvisional: boolean;

  @Column({ length: 60, default: 'manual' })
  trigger: string;

  @ManyToOne(() => FoodProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: FoodProduct;

  @CreateDateColumn()
  createdAt: Date;
}
