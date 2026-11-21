import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { User } from '../../identity/models/user.entity';
import { FoodReview } from '../models/food-review.entity';
import { ReviewService } from './review.service';

describe('ReviewService (F11)', () => {
  let service: ReviewService;
  const reviews = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn() };
  const products = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const product = { id: 5, name: 'Oat Milk', status: 'active', manufacturerId: 20 };
  const dto = { tasteRating: 5, labelAccuracyRating: 4, packagingRating: 4,
    purchaseExperienceRating: 3, comment: 'Good taste and packaging' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(FoodReview), useValue: reviews },
        { provide: getRepositoryToken(FoodProduct), useValue: products },
        { provide: getRepositoryToken(User), useValue: users },
      ],
    }).compile();
    service = mod.get(ReviewService);
    products.findOne.mockResolvedValue(product);
    users.findOne.mockResolvedValue({ id: 3, createdAt: new Date(Date.now() - 365 * 86400000) });
    reviews.create.mockImplementation(data => data);
    reviews.save.mockImplementation(async data => data);
    reviews.remove.mockImplementation(async data => data);
  });

  it('calculates an average using credibility weights', async () => {
    reviews.find.mockResolvedValue([
      { rating: 5, credibilityWeight: 1.2 },
      { rating: 3, credibilityWeight: 1 },
    ]);
    const result = await service.forProduct(5);
    expect(result.averageRating).toBe('4.1');
    expect(reviews.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 5, visibility: 'visible' },
    }));
  });

  it('does not rate products without visible reviews', async () => {
    reviews.find.mockResolvedValue([]);
    expect((await service.forProduct(5)).averageRating).toBeNull();
  });

  it('saves all four ratings and provisional credibility', async () => {
    reviews.findOne.mockResolvedValue(null);
    await service.create(5, 3, dto);
    expect(reviews.create).toHaveBeenCalledWith(expect.objectContaining({
      productId: 5, userId: 3, tasteRating: 5, packagingRating: 4,
      rating: 4, credibilityWeight: 1.2, visibility: 'visible',
    }));
    expect(reviews.save).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate reviews', async () => {
    reviews.findOne.mockResolvedValue({ id: 7 });
    await expect(service.create(5, 3, dto)).rejects.toThrow(ConflictException);
  });

  it('rejects non-existent products', async () => {
    products.findOne.mockResolvedValue(null);
    await expect(service.create(99, 3, dto)).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid ratings even when service is used directly', async () => {
    reviews.findOne.mockResolvedValue(null);
    await expect(service.create(5, 3, { ...dto, tasteRating: 9 }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects blank text', async () => {
    await expect(service.create(5, 3, { ...dto, comment: '     ' }))
      .rejects.toThrow(BadRequestException);
  });

  it('allows authors to edit their own reviews', async () => {
    reviews.findOne.mockResolvedValue({ id: 7, productId: 5, userId: 3 });
    const updated = await service.update(7, 3, dto);
    expect(updated.rating).toBe(4);
    expect(updated.tasteRating).toBe(5);
  });

  it('blocks someone else editing a review', async () => {
    reviews.findOne.mockResolvedValue({ id: 7, productId: 5, userId: 4 });
    await expect(service.update(7, 3, dto)).rejects.toThrow(ForbiddenException);
  });

  it('removes an author-owned review', async () => {
    reviews.findOne.mockResolvedValue({ id: 7, productId: 5, userId: 3 });
    expect(await service.remove(7, 3)).toBe(5);
    expect(reviews.remove).toHaveBeenCalled();
  });

  it('blocks other consumers deleting a review', async () => {
    reviews.findOne.mockResolvedValue({ id: 7, productId: 5, userId: 4 });
    await expect(service.remove(7, 3)).rejects.toThrow(ForbiddenException);
  });

  it('allows manufacturer replies only on owned products', async () => {
    reviews.findOne.mockResolvedValue({ id: 7, productId: 5, product });
    await service.reply(7, 'Thank you', { id: 20, role: 'manufacturer' });
    expect(reviews.save).toHaveBeenCalledWith(expect.objectContaining({
      manufacturerReply: 'Thank you',
    }));
    await expect(service.reply(7, 'Thanks', { id: 30, role: 'manufacturer' }))
      .rejects.toThrow(ForbiddenException);
  });

  it('computes four-dimension weighted averages and product summary for detail view', async () => {
    // Arrange
    reviews.find.mockResolvedValue([
      {
        id: 1,
        productId: 5,
        userId: 3,
        rating: 5,
        tasteRating: 5,
        labelAccuracyRating: 5,
        packagingRating: 4,
        purchaseExperienceRating: 4,
        credibilityWeight: 1.2,
        comment: 'Very clean oat drink',
        author: { name: 'Sharah' },
        createdAt: new Date('2026-11-16'),
      },
      {
        id: 2,
        productId: 5,
        userId: 4,
        rating: 3,
        tasteRating: 3,
        labelAccuracyRating: 4,
        packagingRating: 3,
        purchaseExperienceRating: 3,
        credibilityWeight: 1.0,
        comment: 'Average taste',
        author: { name: 'Tariq' },
        createdAt: new Date('2026-11-17'),
      },
    ]);

    // Act
    const summary = await service.getProductSummary(5);

    // Assert
    expect(summary.reviewCount).toBe(2);
    expect(summary.averageRating).toBe('4.1');
    expect(summary.dimensionAverages).toHaveLength(4);
    expect(summary.recentReviews).toHaveLength(2);
  });

  describe('admin moderation (F12)', () => {
    it('adminRemove should allow administrator to delete any review', async () => {
      // Arrange
      reviews.findOne.mockResolvedValue({ id: 10, productId: 5, userId: 99 });

      // Act
      const productId = await service.adminRemove(10, { id: 1, role: 'admin' });

      // Assert
      expect(productId).toBe(5);
      expect(reviews.remove).toHaveBeenCalled();
    });

    it('adminRemove should throw ForbiddenException when non-admin attempts removal', async () => {
      await expect(
        service.adminRemove(10, { id: 2, role: 'consumer' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('adminToggleVisibility should update review visibility when called by admin', async () => {
      // Arrange
      const reviewObj = { id: 10, visibility: 'visible' as const };
      reviews.findOne.mockResolvedValue(reviewObj);

      // Act
      const updated = await service.adminToggleVisibility(10, 'hidden', { id: 1, role: 'admin' });

      // Assert
      expect(updated.visibility).toBe('hidden');
      expect(reviews.save).toHaveBeenCalled();
    });

    it('adminToggleVisibility should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.adminToggleVisibility(10, 'hidden', { id: 2, role: 'consumer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
