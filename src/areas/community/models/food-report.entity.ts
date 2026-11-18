import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index,
} from 'typeorm';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { User } from '../../identity/models/user.entity';
import { ReportEvidence } from './report-evidence.entity';

export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';
export type ReportCategory = 'counterfeit' | 'spoiled' | 'contaminated' | 'damaged' | 'mislabelled';

@Entity('food_reports')
export class FoodReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @ManyToOne(() => FoodProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: FoodProduct;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  author: User;

  @Column({ type: 'varchar', length: 20 })
  category: ReportCategory;

  @Column({ type: 'varchar', length: 80, nullable: true })
  batchCode: string | null;

  @Column({ type: 'varchar', length: 200 })
  purchasePlace: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40, unique: true })
  referenceNumber: string;

  @Column({ type: 'text' })
  description: string;

  // F14 will add audited investigation transitions in Sprint 3.
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ReportStatus;

  @OneToMany(() => ReportEvidence, (evidence) => evidence.report)
  evidence: ReportEvidence[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
