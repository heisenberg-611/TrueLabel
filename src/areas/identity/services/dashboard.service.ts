import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/user.entity';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import { ReviewService } from '../../community/services/review.service';
import { ReportService } from '../../community/services/report.service';

export interface AdminDashboardQueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  role?: string;
  search?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly catalogService: CatalogService,
    private readonly documentService: DocumentService,
    private readonly preferenceService: PreferenceService,
    @Optional() private readonly reviewService?: ReviewService,
    @Optional() private readonly reportService?: ReportService,
  ) {}

  /**
   * Aggregate Consumer Dashboard Data (Feature F16 & F13 Personal Reports)
   */
  async getConsumerDashboardData(userId: number) {
    const profile = await this.preferenceService.findOrCreate(userId);
    const { items: recentProducts } = await this.catalogService.searchAndFilter({
      limit: 6,
    });

    const evaluatedProducts = recentProducts.map((p) => ({
      ...p,
      conflict: this.preferenceService.evaluateProductConflict(profile, p),
    }));

    const allReports = this.reportService ? await this.reportService.forConsumer(userId) : [];
    const metabolicPlan = this.preferenceService.calculateMetabolicPlan(profile);

    return {
      profile,
      metabolicPlan,
      recentProducts: evaluatedProducts,
      myReports: allReports.slice(0, 5),
      myReportsCount: allReports.length,
    };
  }

  /**
   * Aggregate Manufacturer Console Data (Feature F01, F06 & F11 Consumer Reviews)
   */
  async getManufacturerDashboardData(user: { id: number; name?: string; email?: string }) {
    const products = await this.catalogService.findByManufacturer(user.id);
    const documents = await this.documentService.getDocuments({
      manufacturerId: user.id,
    });

    const approvedDocs = documents.filter((d) => d.status === 'approved');
    const pendingDocs = documents.filter((d) => d.status === 'pending');
    const rejectedDocs = documents.filter((d) => d.status === 'rejected');

    // Attempt to lookup sample corporate licence based on company or default
    const sampleLicences = await this.documentService.getSampleLicences(10);
    const matchedLicence = sampleLicences.find(
      (l) =>
        (user.name && l.companyName.toLowerCase().includes(user.name.toLowerCase())) ||
        (user.name && user.name.toLowerCase().includes(l.companyName.toLowerCase())),
    ) || sampleLicences[0] || null;

    const productReviews = this.reviewService
      ? await this.reviewService.getForManufacturer(user.id)
      : [];

    return {
      products,
      totalProducts: products.length,
      documents,
      documentStats: {
        total: documents.length,
        approved: approvedDocs.length,
        pending: pendingDocs.length,
        rejected: rejectedDocs.length,
      },
      hasApprovedDocument: approvedDocs.length > 0,
      licence: matchedLicence,
      productReviews: productReviews.slice(0, 6),
      totalProductReviews: productReviews.length,
    };
  }

  /**
   * Aggregate Inspector Review Queue Data (Feature F06 Audit & F13 Complaint Queue)
   */
  async getInspectorDashboardData() {
    const stats = await this.documentService.getStatistics();
    const pendingDocuments = await this.documentService.getDocuments({
      status: 'pending',
    });
    const allDocuments = await this.documentService.getDocuments();
    const recentDecisions = allDocuments
      .filter((d) => d.status === 'approved' || d.status === 'rejected')
      .slice(0, 8);
    const sampleLicences = await this.documentService.getSampleLicences(6);

    const complaintQueue = this.reportService
      ? await this.reportService.getQueueWithStats()
      : {
          reports: [],
          stats: { total: 0, pending: 0, investigating: 0, resolved: 0, dismissed: 0, batchClusters: 0 },
        };

    return {
      stats,
      pendingDocuments,
      recentDecisions,
      sampleLicences,
      complaintStats: complaintQueue.stats,
      openComplaints: complaintQueue.reports
        .filter((r) => r.status === 'pending' || r.status === 'investigating')
        .slice(0, 6),
    };
  }

  /**
   * Aggregate Admin Command Center Data (Platform Users, Catalog, Accreditation & F13 Complaints)
   */
  async getAdminDashboardData(options?: AdminDashboardQueryOptions) {
    const allUsers = await this.userRepo.find({
      order: { createdAt: 'DESC' },
    });
    const docStats = await this.documentService.getStatistics();
    const { total: totalProducts } = await this.catalogService.searchAndFilter({ limit: 1 });
    const complaintQueue = this.reportService
      ? await this.reportService.getQueueWithStats()
      : {
          reports: [],
          stats: { total: 0, pending: 0, investigating: 0, resolved: 0, dismissed: 0, batchClusters: 0 },
        };

    const roleBreakdown = {
      consumer: allUsers.filter((u) => u.role === 'consumer').length,
      manufacturer: allUsers.filter((u) => u.role === 'manufacturer').length,
      inspector: allUsers.filter((u) => u.role === 'inspector').length,
      admin: allUsers.filter((u) => u.role === 'admin').length,
    };

    const userTypes = [
      {
        role: 'consumer',
        label: 'Consumer',
        count: roleBreakdown.consumer,
        description: 'Dietary preferences, allergen safety shield & personal scans',
        badgeClass: 'bg-blue-50 text-blue-800 border border-blue-200',
      },
      {
        role: 'manufacturer',
        label: 'Manufacturer',
        count: roleBreakdown.manufacturer,
        description: 'Formulation cataloging, packaging claims & accreditation filings',
        badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      },
      {
        role: 'inspector',
        label: 'Safety Inspector',
        count: roleBreakdown.inspector,
        description: 'Accreditation verification, inspection audits & safety oversight',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
      },
      {
        role: 'admin',
        label: 'Platform Administrator',
        count: roleBreakdown.admin,
        description: 'Identity governance, catalog control & administrative operations',
        badgeClass: 'bg-slate-900 text-white border border-slate-900',
      },
    ];

    // Filter by role
    let filtered = [...allUsers];
    if (options?.role && options.role !== 'all') {
      filtered = filtered.filter((u) => u.role === options.role);
    }

    // Filter by search query (name or email)
    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)),
      );
    }

    // Sorting
    const sortField = options?.sort || 'createdAt';
    const sortOrder = options?.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    filtered.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'createdAt') {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Number(options?.limit) || 10);
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    const formattedUsers = paginated.map((u) => ({
      ...u,
      status: u.isVerified !== false ? 'active' : 'unverified',
      isVerified: u.isVerified !== false,
      formattedDate: u.createdAt
        ? new Date(u.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '—',
    }));

    return {
      users: formattedUsers,
      totalUsers: allUsers.length,
      roleBreakdown,
      userTypes,
      userTypesCount: userTypes.length,
      totalProducts,
      docStats,
      complaintStats: complaintQueue.stats,
      page,
      limit,
      total,
      totalPages,
      currentSort: sortField,
      currentOrder: sortOrder,
      selectedRole: options?.role || 'all',
      query: options?.search || '',
    };
  }

  /**
   * Admin User CRUD: Create a new user account
   */
  async createAdminUser(data: {
    name: string;
    email: string;
    role: UserRole;
    password?: string;
    isVerified?: boolean;
  }) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('User name is required.');
    }
    if (!data.email || !data.email.trim()) {
      throw new BadRequestException('User email address is required.');
    }

    const email = data.email.toLowerCase().trim();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`An account with email "${email}" already exists.`);
    }

    const password =
      data.password && data.password.trim().length >= 6
        ? data.password.trim()
        : 'password123';

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const validRoles: UserRole[] = ['consumer', 'manufacturer', 'inspector', 'admin'];
    const role: UserRole = validRoles.includes(data.role) ? data.role : 'consumer';

    const newUser = this.userRepo.create({
      name: data.name.trim(),
      email,
      role,
      passwordHash,
      isVerified: data.isVerified !== false,
    });

    return await this.userRepo.save(newUser);
  }

  /**
   * Admin User CRUD: Update an existing user account
   */
  async updateAdminUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      role?: UserRole;
      password?: string;
      isVerified?: boolean;
    },
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User account #${id} not found.`);
    }

    if (data.name && data.name.trim()) {
      user.name = data.name.trim();
    }

    if (data.email && data.email.trim()) {
      const email = data.email.toLowerCase().trim();
      if (email !== user.email.toLowerCase()) {
        const conflict = await this.userRepo.findOne({ where: { email } });
        if (conflict && conflict.id !== id) {
          throw new ConflictException(`An account with email "${email}" already exists.`);
        }
        user.email = email;
      }
    }

    if (data.role) {
      const validRoles: UserRole[] = ['consumer', 'manufacturer', 'inspector', 'admin'];
      if (validRoles.includes(data.role)) {
        user.role = data.role;
      }
    }

    if (data.isVerified !== undefined) {
      user.isVerified = Boolean(data.isVerified);
    }

    if (data.password && data.password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(data.password.trim(), salt);
    }

    return await this.userRepo.save(user);
  }

  /**
   * Admin User CRUD: Delete a user account (prevents deleting currently logged-in admin)
   */
  async deleteAdminUser(targetId: number, currentAdminId: number) {
    if (Number(targetId) === Number(currentAdminId)) {
      throw new BadRequestException('You cannot delete your own administrative account.');
    }

    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException(`User account #${targetId} not found.`);
    }

    await this.userRepo.delete(targetId);
    return { success: true };
  }
}
