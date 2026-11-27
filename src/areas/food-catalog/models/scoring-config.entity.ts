import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Feature F04: Administrative Food Quality Score Weight Configuration
 * Stores the 5 configurable component weights (summing to 100%).
 */
@Entity('scoring_configs')
export class ScoringConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40, unique: true, default: 'default' })
  configKey: string;

  @Column({ type: 'int', default: 35 })
  ingredientWeight: number;

  @Column({ type: 'int', default: 30 })
  nutritionWeight: number;

  @Column({ type: 'int', default: 15 })
  verificationWeight: number;

  @Column({ type: 'int', default: 10 })
  recallWeight: number;

  @Column({ type: 'int', default: 10 })
  communityWeight: number;

  @Column({ type: 'int', nullable: true })
  updatedBy: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
