import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { User } from '../../identity/models/user.entity';
import { FoodReview } from '../models/food-review.entity';
import { CreateReviewDto } from '../models/dto/create-review.dto';
import { CredibilityCalculator } from './credibility-calculator';

export interface DimensionMetric {
  label: string;
  score: string;
  percent: number;
}

export interface ReviewViewItem {
  id: number;
  productId: number;
  productName?: string;
  rating: number;
  tasteRating: number;
  labelAccuracyRating: number;
  packagingRating: number;
  purchaseExperienceRating: number;
  credibilityWeight: number;
  weightFormatted: string;
  title: string;
  comment: string;
  manufacturerReply: string | null;
  repliedOn: string;
  authorName: string;
  postedOn: string;
  canReply: boolean;
  isMine: boolean;
}

export interface SessionViewer {
  id: number;
  role: string;
}

@Injectable()
export class ReviewService {
  private readonly credibility = new CredibilityCalculator();

  constructor(
    @InjectRepository(FoodReview)
    private readonly reviewRepo: Repository<FoodReview>,
    @InjectRepository(FoodProduct)
    private readonly productRepo: Repository<FoodProduct>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Feature F11: On-demand credibility-weighted aggregates stay accurate after create, edit, or removal.
  // Hidden reviews are excluded. Overall rating is distinct from the lab-based Food Quality Score.
  async forProduct(productId: number, viewer?: SessionViewer | null) {
    const product = await this.requireProduct(productId);
    const reviews = await this.reviewRepo.find({
      where: { productId, visibility: 'visible' },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });

    const summary = this.computeWeightedSummary(reviews);
    const ownReview = viewer?.role === 'consumer'
      ? reviews.find((review) => review.userId === viewer.id)
      : null;
    const canReply = viewer?.role === 'admin' ||
      (viewer?.role === 'manufacturer' && viewer.id === product.manufacturerId);

    const viewReviews: ReviewViewItem[] = reviews.map((review) =>
      this.toViewItem(review, viewer || null, canReply),
    );

    return {
      product,
      reviews,
      viewReviews,
      reviewCount: reviews.length,
      averageRating: summary.averageRating,
      dimensionAverages: summary.dimensionAverages,
      alreadyReviewed: Boolean(ownReview),
      canReview: viewer?.role === 'consumer' && !ownReview,
    };
  }

  // Feature F11: Lightweight product review summary for embedding on Food Catalog detail pages.
  async getProductSummary(productId: number) {
    const reviews = await this.reviewRepo.find({
      where: { productId, visibility: 'visible' },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
    const summary = this.computeWeightedSummary(reviews);
    return {
      reviewCount: reviews.length,
      averageRating: summary.averageRating,
      dimensionAverages: summary.dimensionAverages,
      recentReviews: reviews.slice(0, 2).map((review) => this.toViewItem(review, null, false)),
    };
  }

  // Feature F11: Fetch recent visible consumer reviews across a manufacturer's products for Dashboard visibility.
  async getForManufacturer(manufacturerId: number) {
    const reviews = await this.reviewRepo.find({
      where: { visibility: 'visible', product: { manufacturerId, status: 'active' } },
      relations: ['author', 'product'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return reviews.map((review) => ({
      ...this.toViewItem(review, { id: manufacturerId, role: 'manufacturer' }, true),
      productName: review.product?.name || `Product #${review.productId}`,
    }));
  }

  // Feature F11: One review per consumer per product (enforced by service + DB unique constraint).
  async create(productId: number, userId: number, dto: CreateReviewDto) {
    await this.requireProduct(productId);
    this.checkComment(dto.comment);
    const existing = await this.reviewRepo.findOne({ where: { productId, userId } });
    if (existing) throw new ConflictException('You have already reviewed this product');
    const author = await this.userRepo.findOne({ where: { id: userId } });
    if (!author) throw new NotFoundException('Consumer account not found');

    const ageDays = Math.floor(
      (Date.now() - new Date(author.createdAt).getTime()) / 86400000,
    );
    const credibilityWeight = this.credibility.calculate(ageDays);
    // Verified batch/purchase evidence bonuses remain 0 until F07 verification infrastructure exists.
    const review = this.reviewRepo.create({
      productId,
      userId,
      ...this.reviewFields(dto),
      credibilityWeight,
      visibility: 'visible',
    });
    return this.reviewRepo.save(review);
  }

  // Feature F11: Only the review author may edit an existing review.
  async update(reviewId: number, userId: number, dto: CreateReviewDto) {
    const review = await this.requireOwnedReview(reviewId, userId);
    this.checkComment(dto.comment);
    Object.assign(review, this.reviewFields(dto));
    return this.reviewRepo.save(review);
  }

  // Feature F11: Deleting a review immediately removes it from credibility-weighted aggregates.
  async remove(reviewId: number, userId: number) {
    const review = await this.requireOwnedReview(reviewId, userId);
    await this.reviewRepo.remove(review);
    return review.productId;
  }

  // Feature F12: Administrative moderation - permanently delete any review
  async adminRemove(reviewId: number, user: { id: number; role: string }) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only system administrators can delete customer reviews');
    }
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    const productId = review.productId;
    await this.reviewRepo.remove(review);
    return productId;
  }

  // Feature F12: Administrative moderation - toggle review visibility
  async adminToggleVisibility(
    reviewId: number,
    visibility: 'visible' | 'hidden',
    user: { id: number; role: string },
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only system administrators can moderate review visibility');
    }
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    review.visibility = visibility;
    return this.reviewRepo.save(review);
  }

  // Feature F11: Product owner manufacturer or admin may publish an official response.
  async reply(reviewId: number, message: string, user: { id: number; role: string }) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['product'],
    });
    if (!review) throw new NotFoundException('Review not found');
    if (
      user.role !== 'admin' &&
      (user.role !== 'manufacturer' || review.product.manufacturerId !== user.id)
    ) {
      throw new ForbiddenException('You cannot reply to this review');
    }
    if (!message?.trim() || message.trim().length < 2) {
      throw new BadRequestException('Response is too short');
    }
    review.manufacturerReply = message.trim();
    review.repliedAt = new Date().toISOString();
    return this.reviewRepo.save(review);
  }

  private computeWeightedSummary(reviews: FoodReview[]) {
    const totalWeight = reviews.reduce((total, item) => total + (item.credibilityWeight || 1), 0);
    if (totalWeight <= 0 || reviews.length === 0) {
      return { averageRating: null, dimensionAverages: [] as DimensionMetric[] };
    }

    const weightedAvg = (picker: (r: FoodReview) => number) => {
      const sum = reviews.reduce(
        (acc, item) => acc + picker(item) * (item.credibilityWeight || 1),
        0,
      );
      const val = sum / totalWeight;
      return { score: val.toFixed(1), percent: Math.round((val / 5) * 100) };
    };

    const overall = weightedAvg((r) => r.rating);
    const dimensionAverages: DimensionMetric[] = [
      { label: 'Taste & quality', ...weightedAvg((r) => r.tasteRating ?? r.rating) },
      { label: 'Label accuracy', ...weightedAvg((r) => r.labelAccuracyRating ?? r.rating) },
      { label: 'Packaging condition', ...weightedAvg((r) => r.packagingRating ?? r.rating) },
      {
        label: 'Purchase experience',
        ...weightedAvg((r) => r.purchaseExperienceRating ?? r.rating),
      },
    ];

    return { averageRating: overall.score, dimensionAverages };
  }

  private toViewItem(
    review: FoodReview,
    viewer: SessionViewer | null,
    canReply: boolean,
  ): ReviewViewItem {
    const weight = Number(review.credibilityWeight || 1);
    return {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      tasteRating: review.tasteRating,
      labelAccuracyRating: review.labelAccuracyRating,
      packagingRating: review.packagingRating,
      purchaseExperienceRating: review.purchaseExperienceRating,
      credibilityWeight: weight,
      weightFormatted: `${weight.toFixed(2)}x`,
      title: review.title || '',
      comment: review.comment,
      manufacturerReply: review.manufacturerReply || null,
      repliedOn: review.repliedAt
        ? new Date(review.repliedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '',
      authorName: review.author?.name || 'Consumer',
      postedOn: review.createdAt
        ? new Date(review.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '',
      canReply,
      isMine: viewer?.role === 'consumer' && viewer.id === review.userId,
    };
  }

  private reviewFields(dto: CreateReviewDto) {
    const values = [
      dto.tasteRating,
      dto.labelAccuracyRating,
      dto.packagingRating,
      dto.purchaseExperienceRating,
    ];
    if (values.some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5)) {
      throw new BadRequestException('Ratings must be whole numbers from 1 to 5');
    }
    return {
      tasteRating: dto.tasteRating,
      labelAccuracyRating: dto.labelAccuracyRating,
      packagingRating: dto.packagingRating,
      purchaseExperienceRating: dto.purchaseExperienceRating,
      rating: Math.round(values.reduce((sum, n) => sum + n, 0) / 4),
      title: dto.title?.trim() || '',
      comment: dto.comment.trim(),
    };
  }

  private checkComment(comment: string) {
    if (!comment?.trim() || comment.trim().length < 10) {
      throw new BadRequestException('Write at least 10 characters in your review');
    }
  }

  private async requireOwnedReview(reviewId: number, userId: number) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('This is not your review');
    return review;
  }

  private async requireProduct(id: number) {
    const product = await this.productRepo.findOne({
      where: { id, status: 'active' },
    });
    if (!product) throw new NotFoundException('Food product not found');
    return product;
  }
}
