import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { ReportController } from './report.controller';

describe('ReportController (F13)', () => {
  let controller: ReportController;
  const service = {
    getProduct: jest.fn(),
    create: jest.fn(),
    forConsumer: jest.fn(),
    getQueueWithStats: jest.fn(),
    updateStatus: jest.fn(),
    getEvidenceAccess: jest.fn(),
  };
  const consumer = { session: { user: { id: 3, role: 'consumer' } } } as any;
  const dto = {
    category: 'spoiled' as const,
    purchasePlace: 'Campus Store',
    description: 'The food had a strange smell and texture',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [{ provide: ReportService, useValue: service }],
    }).compile();
    controller = mod.get(ReportController);
  });

  it('renders a product-specific complaint form', async () => {
    // Arrange
    service.getProduct.mockResolvedValue({ id: 5, name: 'Oat Milk' });

    // Act
    const model = await controller.form(5, consumer);

    // Assert
    expect(model.product.id).toBe(5);
    expect(model.activeNav).toBe('reports');
  });

  it('passes report and photo data to the service and redirects with reference number', async () => {
    // Arrange
    service.create.mockResolvedValue({ id: 7, referenceNumber: 'TL-20261118-ABCD1234' });
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.create(5, dto, consumer, res);

    // Assert
    expect(service.create).toHaveBeenCalledWith(5, 3, dto, undefined);
    expect(res.redirect).toHaveBeenCalledWith(
      '/community/reports/mine?submitted=TL-20261118-ABCD1234',
    );
  });

  it('re-renders the complaint form with status 400 when validation fails', async () => {
    // Arrange
    service.create.mockRejectedValue(new BadRequestException('Only JPEG, PNG or WebP photos are supported'));
    service.getProduct.mockResolvedValue({ id: 5, name: 'Oat Milk' });
    const render = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ render }) } as any;

    // Act
    await controller.create(5, dto, consumer, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(render).toHaveBeenCalledWith(
      'areas/community/views/report-form',
      expect.objectContaining({
        error: 'Only JPEG, PNG or WebP photos are supported',
        formData: dto,
      }),
    );
  });

  it('loads only personal report history and forwards submitted reference', async () => {
    // Arrange
    service.forConsumer.mockResolvedValue([]);

    // Act
    const model = await controller.mine(consumer, 'TL-20261118-ABCD1234');

    // Assert
    expect(service.forConsumer).toHaveBeenCalledWith(3);
    expect(model.submittedRef).toBe('TL-20261118-ABCD1234');
  });

  it('shows filtered complaint queue and telemetry stats to authorized staff', async () => {
    // Arrange
    service.getQueueWithStats.mockResolvedValue({
      reports: [{ id: 7 }],
      stats: { total: 1, pending: 1, investigating: 0, resolved: 0, dismissed: 0, batchClusters: 0 },
    });

    // Act
    const data = await controller.queue(
      { session: { user: { role: 'inspector' } } } as any,
      'pending',
      'spoiled',
    );

    // Assert
    expect(service.getQueueWithStats).toHaveBeenCalledWith({ status: 'pending', category: 'spoiled' });
    expect(data.reports).toHaveLength(1);
    expect(data.stats.pending).toBe(1);
  });

  it('redirects to a signed private evidence URL for cloud storage', async () => {
    // Arrange
    const res = { redirect: jest.fn() } as any;
    service.getEvidenceAccess.mockResolvedValue({
      access: { mode: 'redirect', url: 'https://private.example/image' },
      mimeType: 'image/png',
    });

    // Act
    await controller.evidence(7, consumer, res);

    // Assert
    expect(res.redirect).toHaveBeenCalledWith('https://private.example/image');
  });

  it('streams local private evidence with no-store header when stored locally', async () => {
    // Arrange
    const res = { setHeader: jest.fn(), sendFile: jest.fn() } as any;
    service.getEvidenceAccess.mockResolvedValue({
      access: { mode: 'local', absolutePath: '/tmp/private/photo.png' },
      mimeType: 'image/png',
    });

    // Act
    await controller.evidence(7, consumer, res);

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(res.sendFile).toHaveBeenCalledWith('/tmp/private/photo.png');
  });

  it('updates report status and redirects with confirmation', async () => {
    // Arrange
    const res = { redirect: jest.fn() } as any;

    // Act
    await controller.status(
      7,
      { status: 'investigating' },
      { session: { user: { role: 'inspector' } } } as any,
      res,
    );

    // Assert
    expect(service.updateStatus).toHaveBeenCalledWith(7, 'investigating', 'inspector');
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/community/reports/queue?success='),
    );
  });
});
