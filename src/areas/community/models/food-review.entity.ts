import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { User } from '../../identity/models/user.entity';

@Entity('food_reviews')
@Unique(['productId', 'userId'])
export class FoodReview {
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

  // F11: Overall rating is the rounded mean of the four ratings.
  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'int', default: 3 })
  tasteRating: number;

  @Column({ type: 'int', default: 3 })
  labelAccuracyRating: number;

  @Column({ type: 'int', default: 3 })
  packagingRating: number;

  @Column({ type: 'int', default: 3 })
  purchaseExperienceRating: number;

  @Column({ type: 'float', default: 1 })
  credibilityWeight: number;

  // F12 will manage hidden/visible transitions and audit logging later.
  @Column({ length: 20, default: 'visible' })
  visibility: 'visible' | 'hidden';

  @Column({ length: 120, default: '' })
  title: string;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'text', nullable: true })
  manufacturerReply: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  repliedAt: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
