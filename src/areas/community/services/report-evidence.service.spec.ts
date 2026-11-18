import { BadRequestException } from '@nestjs/common';
import { ReportEvidenceService } from './report-evidence.service';

describe('ReportEvidenceService photo validation (F13)', () => {
  let service: ReportEvidenceService;
  beforeEach(() => { service = new ReportEvidenceService(); });

  it('allows a PNG with the correct header and MIME type', () => {
    const buffer = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
    expect(service.validatePhoto({ buffer, mimetype: 'image/png', size: buffer.length }))
      .toBe('image/png');
  });

  it('rejects a spoofed MIME type', () => {
    const buffer = Buffer.from('not actually a picture');
    expect(() => service.validatePhoto({ buffer, mimetype: 'image/png', size: buffer.length }))
      .toThrow(BadRequestException);
  });

  it('rejects files over 3 MB', () => {
    const buffer = Buffer.alloc(3 * 1024 * 1024 + 1);
    expect(() => service.validatePhoto({ buffer, mimetype: 'image/png', size: buffer.length }))
      .toThrow(BadRequestException);
  });

  it('stores and removes private photo evidence locally when Supabase service key is absent', async () => {
    // Arrange
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

    try {
      // Act
      const storedPath = await service.upload(
        'reports/unit-test-evidence.png',
        { buffer, mimetype: 'image/png', size: buffer.length },
        'image/png',
      );
      const resolved = await service.resolveEvidence(storedPath);
      await service.remove(storedPath);

      // Assert
      expect(storedPath).toBe('local:unit-test-evidence.png');
      expect(resolved.mode).toBe('local');
    } finally {
      if (prevKey !== undefined) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
      }
    }
  });
});
