import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FoodProduct } from '../../food-catalog/models/food-product.entity';
import { User } from '../../identity/models/user.entity';
import { FoodReport, ReportCategory, ReportStatus } from '../models/food-report.entity';
import { ReportEvidence } from '../models/report-evidence.entity';
import { CreateReportDto } from '../models/dto/create-report.dto';
import {
  EvidenceUpload,
  ReportEvidenceService,
  ResolvedEvidence,
} from './report-evidence.service';

export interface ReportQueueFilter {
  status?: string;
  category?: string;
}

export interface ReportStatistics {
  total: number;
  pending: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  batchClusters: number;
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  counterfeit: 'Suspected counterfeit',
  spoiled: 'Spoiled food',
  contaminated: 'Suspected contamination',
  damaged: 'Damaged packaging',
  mislabelled: 'Misleading or incorrect label',
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending review',
  investigating: 'Investigating',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(FoodReport)
    private readonly reportRepo: Repository<FoodReport>,
    @InjectRepository(FoodProduct)
    private readonly productRepo: Repository<FoodProduct>,
    @InjectRepository(ReportEvidence)
    private readonly evidenceRepo: Repository<ReportEvidence>,
    private readonly evidenceStorage: ReportEvidenceService,
    @Optional()
    @InjectRepository(User)
    private readonly userRepo?: Repository<User>,
  ) {}

  // Feature F13: Verify target product exists and is active before opening complaint form.
  async getProduct(productId: number) {
    const product = await this.productRepo.findOne({
      where: { id: productId, status: 'active' },
    });
    if (!product) throw new NotFoundException('Food product not found');
    return product;
  }

  // Feature F13: Issue a unique reference number even when no photo is attached.
  async create(productId: number, userId: number, dto: CreateReportDto, photo?: EvidenceUpload) {
    await this.getProduct(productId);
    if (this.userRepo) {
      const reporter = await this.userRepo.findOne({ where: { id: userId } });
      if (!reporter) {
        throw new NotFoundException(
          'Your session account could not be verified. Please sign out and sign in again (or re-select your role).',
        );
      }
    }
    if (!dto.description?.trim() || dto.description.trim().length < 20) {
      throw new BadRequestException('Please explain the problem in at least 20 characters');
    }
    if (!dto.purchasePlace?.trim() || dto.purchasePlace.trim().length < 2) {
      throw new BadRequestException('Purchase location is required');
    }

    const referenceNumber =
      'TL-' +
      new Date().toISOString().slice(0, 10).replace(/-/g, '') +
      '-' +
      randomUUID().slice(0, 8).toUpperCase();
    const report = this.reportRepo.create({
      productId,
      userId,
      category: dto.category,
      batchCode: dto.batchCode?.trim() || null,
      purchasePlace: dto.purchasePlace.trim(),
      description: dto.description.trim(),
      referenceNumber,
      status: 'pending',
    });

    if (!photo) return this.reportRepo.save(report);

    const mimeType = this.evidenceStorage.validatePhoto(photo);
    const extension =
      mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const initialPath = 'reports/' + randomUUID() + '.' + extension;
    // Upload first, then remove the private file if writing to the DB fails.
    const storedPath = (await this.evidenceStorage.upload(initialPath, photo, mimeType)) || initialPath;
    try {
      const saved = await this.reportRepo.save(report);
      const evidence = this.evidenceRepo.create({
        reportId: saved.id,
        filePath: storedPath,
        mimeType,
        byteSize: photo.size,
      });
      await this.evidenceRepo.save(evidence);
      return saved;
    } catch (error) {
      await this.evidenceStorage.remove(storedPath).catch(() => undefined);
      throw error;
    }
  }

  // Feature F13: Private report history visible only to the reporting consumer.
  async forConsumer(userId: number) {
    const reports = await this.reportRepo.find({
      where: { userId },
      relations: ['product', 'evidence'],
      order: { createdAt: 'DESC' },
    });
    return reports.map((report) => this.formatReport(report, 1));
  }

  // Feature F13: Staff queue with same-product + batch-code linking counts.
  async queue() {
    const reports = await this.reportRepo.find({
      relations: ['product', 'author', 'evidence'],
      order: { createdAt: 'DESC' },
    });
    return this.attachLinkedCounts(reports);
  }

  // Feature F13: Fast aggregate complaint telemetry for dashboards without eager multi-table joins.
  async getQuickStats(): Promise<ReportStatistics> {
    try {
      const [pending, investigating, resolved, dismissed] = await Promise.all([
        this.reportRepo.count({ where: { status: 'pending' } }),
        this.reportRepo.count({ where: { status: 'investigating' } }),
        this.reportRepo.count({ where: { status: 'resolved' } }),
        this.reportRepo.count({ where: { status: 'dismissed' } }),
      ]);

      return {
        total: pending + investigating + resolved + dismissed,
        pending,
        investigating,
        resolved,
        dismissed,
        batchClusters: 0,
      };
    } catch {
      const q = await this.getQueueWithStats();
      return q.stats;
    }
  }

  // Feature F13: Filtered inspector/admin complaint docket with telemetry counters.
  async getQueueWithStats(filter?: ReportQueueFilter) {
    const allReports = await this.reportRepo.find({
      relations: ['product', 'author', 'evidence'],
      order: { createdAt: 'DESC' },
    });
    const annotated = this.attachLinkedCounts(allReports);

    const clusterKeys = new Set<string>();
    for (const item of annotated) {
      if (item.batchCode && item.linkedCount > 1) {
        clusterKeys.add(`${item.productId}::${item.batchCode.toLowerCase()}`);
      }
    }

    const stats: ReportStatistics = {
      total: annotated.length,
      pending: annotated.filter((r) => r.status === 'pending').length,
      investigating: annotated.filter((r) => r.status === 'investigating').length,
      resolved: annotated.filter((r) => r.status === 'resolved').length,
      dismissed: annotated.filter((r) => r.status === 'dismissed').length,
      batchClusters: clusterKeys.size,
    };

    let filtered = annotated;
    if (filter?.status && filter.status !== 'all') {
      filtered = filtered.filter((r) => r.status === filter.status);
    }
    if (filter?.category && filter.category !== 'all') {
      filtered = filtered.filter((r) => r.category === filter.category);
    }

    return { reports: filtered, stats };
  }

  // Feature F13: Private evidence requires either the reporter or inspector/admin role.
  async evidenceUrl(reportId: number, user: { id: number; role: string }) {
    const evidence = await this.requireAuthorizedEvidence(reportId, user);
    return this.evidenceStorage.signedUrl(evidence.filePath);
  }

  // Feature F13: Resolve either signed cloud URL or local private file with RBAC enforcement.
  async getEvidenceAccess(
    reportId: number,
    user: { id: number; role: string },
  ): Promise<{ access: ResolvedEvidence; mimeType: string }> {
    const evidence = await this.requireAuthorizedEvidence(reportId, user);
    const access = await this.evidenceStorage.resolveEvidence(evidence.filePath);
    return { access, mimeType: evidence.mimeType };
  }

  // Feature F13 (interim F14 status control): Inspector/admin status transitions.
  async updateStatus(id: number, status: Exclude<ReportStatus, 'pending'>, role: string) {
    if (role !== 'inspector' && role !== 'admin') {
      throw new ForbiddenException('Only inspectors or admins may update reports');
    }
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Complaint not found');
    report.status = status;
    return this.reportRepo.save(report);
  }

  private async requireAuthorizedEvidence(
    reportId: number,
    user: { id: number; role: string },
  ): Promise<ReportEvidence> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['evidence'],
    });
    if (!report) throw new NotFoundException('Complaint not found');
    const staff = user.role === 'inspector' || user.role === 'admin';
    if (!staff && report.userId !== user.id) {
      throw new ForbiddenException('This photo does not belong to you');
    }
    const evidence = report.evidence?.[0];
    if (!evidence) throw new NotFoundException('Photo evidence not found');
    return evidence;
  }

  private attachLinkedCounts(reports: FoodReport[]) {
    return reports.map((report) => {
      const normalizedBatch = report.batchCode?.trim().toLowerCase() || '';
      const linkedCount = normalizedBatch
        ? reports.filter(
            (candidate) =>
              candidate.productId === report.productId &&
              (candidate.batchCode?.trim().toLowerCase() || '') === normalizedBatch,
          ).length
        : 1;
      return this.formatReport(report, linkedCount);
    });
  }

  private formatReport(report: FoodReport, linkedCount: number) {
    return {
      ...report,
      linkedCount,
      hasLinkedBatchCluster: Boolean(report.batchCode && linkedCount > 1),
      categoryLabel: CATEGORY_LABELS[report.category] || report.category,
      statusLabel: STATUS_LABELS[report.status] || report.status,
      submittedOn: report.createdAt
        ? new Date(report.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '—',
    };
  }
}
