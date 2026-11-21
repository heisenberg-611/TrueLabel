import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReviewService } from '../services/review.service';
import { ReviewController } from './review.controller';

describe('ReviewController (F11)', () => {
  let controller: ReviewController;
  const service = {
    forProduct: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reply: jest.fn(),
    adminRemove: jest.fn(),
    adminToggleVisibility: jest.fn(),
  };
  const consumer = { session: { user: { id: 3, role: 'consumer' } } } as any;
  const dto = {
    tasteRating: 5,
    labelAccuracyRating: 4,
    packagingRating: 4,
    purchaseExperienceRating: 3,
    comment: 'Good food for breakfast',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: service }],
    }).compile();
    controller = mod.get(ReviewController);
  });

  it('renders ratings, dimension averages and hides the form for previous authors', async () => {
    // Arrange
    service.forProduct.mockResolvedValue({
      product: { id: 5, name: 'Oat Milk', manufacturerId: 20 },
      averageRating: '4.0',
      reviewCount: 1,
      dimensionAverages: [{ label: 'Taste & quality', score: '5.0', percent: 100 }],
      viewReviews: [{ id: 2, rating: 4, authorName: 'Sam', weightFormatted: '1.20x' }],
      alreadyReviewed: true,
      canReview: false,
    });

    // Act
    const model = await controller.view(5, consumer);

    // Assert
    expect(service.forProduct).toHaveBeenCalledWith(5, consumer.session.user);
    expect(model.reviews[0].authorName).toBe('Sam');
    expect(model.canReview).toBe(false);
    expect(model.dimensionAverages).toHaveLength(1);
  });

  it('sends a new review to the service and redirects with success message', async () => {
    // Arrange
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.create(5, dto, consumer, res);

    // Assert
    expect(service.create).toHaveBeenCalledWith(5, 3, dto);
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/community/products/5/reviews?success='),
    );
  });

  it('redirects with error message when duplicate review is rejected', async () => {
    // Arrange
    service.create.mockRejectedValue(new ConflictException('You have already reviewed this product'));
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.create(5, dto, consumer, res);

    // Assert
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/community/products/5/reviews?error='),
    );
  });

  it('updates and deletes reviews owned by the consumer', async () => {
    // Arrange
    service.update.mockResolvedValue({ productId: 5 });
    service.remove.mockResolvedValue(5);
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.update(2, dto, consumer, res);
    await controller.remove(2, consumer, res);

    // Assert
    expect(service.update).toHaveBeenCalledWith(2, 3, dto);
    expect(service.remove).toHaveBeenCalledWith(2, 3);
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/community/products/5/reviews?success='),
    );
  });

  it('sends manufacturer replies to the service', async () => {
    // Arrange
    service.reply.mockResolvedValue({ productId: 5 });
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.reply(
      2,
      { reply: 'Thank you' },
      { session: { user: { id: 20, role: 'manufacturer' } } } as any,
      res,
    );

    // Assert
    expect(service.reply).toHaveBeenCalledWith(2, 'Thank you', expect.any(Object));
  });

  it('adminRemove deletes review and redirects with success message', async () => {
    // Arrange
    service.adminRemove.mockResolvedValue(5);
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.adminRemove(2, { session: { user: { id: 1, role: 'admin' } } } as any, res);

    // Assert
    expect(service.adminRemove).toHaveBeenCalledWith(2, expect.objectContaining({ role: 'admin' }));
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/community/products/5/reviews?success='),
    );
  });

  it('toggleVisibility changes review visibility and redirects with success message', async () => {
    // Arrange
    service.adminToggleVisibility.mockResolvedValue({ productId: 5, visibility: 'hidden' });
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.toggleVisibility(
      2,
      'hidden',
      { session: { user: { id: 1, role: 'admin' } } } as any,
      res,
    );

    // Assert
    expect(service.adminToggleVisibility).toHaveBeenCalledWith(
      2,
      'hidden',
      expect.objectContaining({ role: 'admin' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/community/products/5/reviews?success='),
    );
  });
});
