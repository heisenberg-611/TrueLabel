import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { FoodReport } from '../models/food-report.entity';
import { ReportEvidence } from '../models/report-evidence.entity';
import { ReportEvidenceService } from './report-evidence.service';
import { ReportService } from './report.service';

describe('ReportService (F13)', () => {
  let service: ReportService;
  const reports = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const products = { findOne: jest.fn() };
  const evidence = { create: jest.fn(), save: jest.fn() };
  const storage = {
    validatePhoto: jest.fn(),
    upload: jest.fn(),
    remove: jest.fn(),
    signedUrl: jest.fn(),
    resolveEvidence: jest.fn(),
  };
  const dto = { category: 'spoiled' as const, batchCode: 'BA-001',
    purchasePlace: 'Campus Store', description: 'The food had a bad smell and unusual colour' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getRepositoryToken(FoodReport), useValue: reports },
        { provide: getRepositoryToken(FoodProduct), useValue: products },
        { provide: getRepositoryToken(ReportEvidence), useValue: evidence },
        { provide: ReportEvidenceService, useValue: storage },
      ],
    }).compile();
    service = mod.get(ReportService);
    products.findOne.mockResolvedValue({ id: 5, status: 'active' });
    reports.create.mockImplementation(data => data);
    reports.save.mockImplementation(async data => ({ ...data, id: 7 }));
    evidence.create.mockImplementation(data => data);
    evidence.save.mockImplementation(async data => data);
    storage.validatePhoto.mockReturnValue('image/png');
    storage.remove.mockResolvedValue(undefined);
    storage.signedUrl.mockResolvedValue('https://private.example/signed');
  });

  it('creates a pending report with a reference number and batch', async () => {
    await service.create(5, 3, dto);
    expect(reports.create).toHaveBeenCalledWith(expect.objectContaining({
      productId: 5, userId: 3, category: 'spoiled', purchasePlace: 'Campus Store',
      referenceNumber: expect.stringMatching(/^TL-\d{8}-[0-9A-F]{8}$/),
    }));
    expect(reports.save).toHaveBeenCalledTimes(1);
  });

  it('validates purchase location', async () => {
    await expect(service.create(5, 3, { ...dto, purchasePlace: ' ' }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects reports of unknown foods', async () => {
    products.findOne.mockResolvedValue(null);
    await expect(service.create(99, 3, dto)).rejects.toThrow(NotFoundException);
  });

  it('uploads evidence to private storage and saves its path', async () => {
    const photo = { buffer: Buffer.from([137,80,78,71,13,10,26,10]), mimetype: 'image/png', size: 8 };
    await service.create(5, 3, dto, photo);
    expect(storage.upload).toHaveBeenCalled();
    expect(evidence.save).toHaveBeenCalledWith(expect.objectContaining({
      reportId: 7, mimeType: 'image/png',
    }));
  });

  it('lists only the current user reports', async () => {
    reports.find.mockResolvedValue([]);
    await service.forConsumer(3);
    expect(reports.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 3 },
    }));
  });

  it('counts reports sharing the same product and batch', async () => {
    reports.find.mockResolvedValue([
      { id: 1, productId: 5, batchCode: 'A1' },
      { id: 2, productId: 5, batchCode: 'A1' },
      { id: 3, productId: 5, batchCode: 'B1' },
    ]);
    expect((await service.queue())[0].linkedCount).toBe(2);
  });

  it('restricts evidence access by owner', async () => {
    reports.findOne.mockResolvedValue({ id: 7, userId: 3, evidence: [{ filePath: 'safe/private.png' }] });
    await expect(service.evidenceUrl(7, { id: 4, role: 'consumer' }))
      .rejects.toThrow(ForbiddenException);
    expect(await service.evidenceUrl(7, { id: 3, role: 'consumer' }))
      .toBe('https://private.example/signed');
  });

  it('allows inspectors to change report status', async () => {
    reports.findOne.mockResolvedValue({ id: 7, status: 'pending' });
    await service.updateStatus(7, 'investigating', 'inspector');
    expect(reports.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'investigating' }));
    await expect(service.updateStatus(7, 'resolved', 'consumer'))
      .rejects.toThrow(ForbiddenException);
  });

  it('filters complaint queue by status and category while preserving batch cluster telemetry', async () => {
    // Arrange
    reports.find.mockResolvedValue([
      { id: 1, productId: 5, batchCode: 'B-99', status: 'pending', category: 'spoiled' },
      { id: 2, productId: 5, batchCode: 'b-99', status: 'investigating', category: 'damaged' },
      { id: 3, productId: 6, batchCode: 'C-10', status: 'resolved', category: 'mislabelled' },
    ]);

    // Act
    const result = await service.getQueueWithStats({ status: 'pending', category: 'spoiled' });

    // Assert
    expect(result.stats.total).toBe(3);
    expect(result.stats.pending).toBe(1);
    expect(result.stats.batchClusters).toBe(1);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].linkedCount).toBe(2);
    expect(result.reports[0].hasLinkedBatchCluster).toBe(true);
  });

  it('resolves private evidence access for authorized owner or inspector', async () => {
    // Arrange
    reports.findOne.mockResolvedValue({
      id: 7,
      userId: 3,
      evidence: [{ filePath: 'local:test.png', mimeType: 'image/png' }],
    });
    storage.resolveEvidence.mockResolvedValue({ mode: 'local', absolutePath: '/tmp/test.png' });

    // Act & Assert
    await expect(service.getEvidenceAccess(7, { id: 9, role: 'consumer' })).rejects.toThrow(
      ForbiddenException,
    );
    const result = await service.getEvidenceAccess(7, { id: 2, role: 'inspector' });
    expect(result.mimeType).toBe('image/png');
    expect(result.access).toEqual({ mode: 'local', absolutePath: '/tmp/test.png' });
  });
});
