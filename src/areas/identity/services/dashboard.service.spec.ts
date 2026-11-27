import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { User } from '../models/user.entity';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import { RuleManagementService } from '../../admin/services/rule-management.service';

describe('DashboardService (Unit Tests)', () => {
  let service: DashboardService;
  let userRepo: any;
  let catalogService: any;
  let documentService: any;
  let preferenceService: any;
  let ruleManagementService: any;

  beforeEach(async () => {
    userRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, name: 'Consumer A', email: 'consumer@test.com', role: 'consumer', isVerified: true, createdAt: new Date('2026-01-01') },
        { id: 2, name: 'Brand B', email: 'brand@test.com', role: 'manufacturer', isVerified: true, createdAt: new Date('2026-01-02') },
        { id: 3, name: 'Inspector C', email: 'inspector@test.com', role: 'inspector', isVerified: false, createdAt: new Date('2026-01-03') },
        { id: 4, name: 'Admin D', email: 'admin@test.com', role: 'admin', isVerified: true, createdAt: new Date('2026-01-04') },
      ]),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 5, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 5, ...entity })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    catalogService = {
      searchAndFilter: jest.fn().mockResolvedValue({
        items: [{ id: 10, name: 'Oat Drink', brand: 'Oatly' }],
        total: 15,
      }),
      findByManufacturer: jest.fn().mockResolvedValue([
        { id: 10, name: 'Oat Drink', qualityScore: 88, manufacturerId: 2 },
      ]),
      countAll: jest.fn().mockResolvedValue({
        active: 15,
        archived: 0,
        banned: 0,
        total: 15,
      }),
      adminSearchAll: jest.fn().mockResolvedValue({
        items: [{ id: 10, name: 'Oat Drink', brand: 'Oatly', status: 'active', createdAt: new Date() }],
        total: 1,
        page: 1,
        totalPages: 1,
        statusCounts: { active: 1, archived: 0, banned: 0, total: 1 },
      }),
    };

    documentService = {
      getDocuments: jest.fn().mockResolvedValue([
        { id: 1, status: 'approved', companyName: 'Brand B', documentType: 'iso22000' },
        { id: 2, status: 'pending', companyName: 'Brand B', documentType: 'halal' },
      ]),
      getStatistics: jest.fn().mockResolvedValue({
        total: 10,
        approved: 7,
        pending: 2,
        rejected: 1,
        expiringSoon: 1,
      }),
      getSampleLicences: jest.fn().mockResolvedValue([
        { id: 1, licenceNumber: 'BSTI-100', companyName: 'Brand B', status: 'valid' },
      ]),
    };

    preferenceService = {
      findOrCreate: jest.fn().mockResolvedValue({
        userId: 1,
        allergies: ['Peanut'],
        dietaryPreferences: ['Vegan'],
      }),
      evaluateProductConflict: jest.fn().mockReturnValue({
        hasConflicts: false,
        isSafeForUser: true,
      }),
      calculateMetabolicPlan: jest.fn().mockReturnValue({
        isCalculated: true,
        bmr: 1330,
        tdee: 2000,
        dailyCalorieTarget: 2000,
        macroSplit: { proteinGrams: 125, carbsGrams: 250, fatGrams: 56 },
        dailyCeilings: { maxSugarGrams: 25, maxSodiumGrams: 2.0 },
      }),
    };

    ruleManagementService = {
      getQuickStats: jest.fn().mockResolvedValue({
        total: 35,
        active: 33,
        inactive: 2,
        safe: 16,
        caution: 11,
        warning: 8,
        allergens: 7,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: CatalogService, useValue: catalogService },
        { provide: DocumentService, useValue: documentService },
        { provide: PreferenceService, useValue: preferenceService },
        { provide: RuleManagementService, useValue: ruleManagementService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getConsumerDashboardData', () => {
    it('should aggregate profile and evaluated catalog products', async () => {
      const data = await service.getConsumerDashboardData(1);

      expect(data.profile).toBeDefined();
      expect(data.profile.allergies).toContain('Peanut');
      expect(data.recentProducts).toHaveLength(1);
      expect(data.recentProducts[0].conflict.isSafeForUser).toBe(true);
      expect(preferenceService.findOrCreate).toHaveBeenCalledWith(1);
      expect(catalogService.searchAndFilter).toHaveBeenCalled();
    });
  });

  describe('getManufacturerDashboardData', () => {
    it('should aggregate products, accreditation counts and licence for manufacturer', async () => {
      const data = await service.getManufacturerDashboardData({
        id: 2,
        name: 'Brand B',
        email: 'brand@test.com',
      });

      expect(data.products).toHaveLength(1);
      expect(data.totalProducts).toBe(1);
      expect(data.documentStats.total).toBe(2);
      expect(data.documentStats.approved).toBe(1);
      expect(data.documentStats.pending).toBe(1);
      expect(data.hasApprovedDocument).toBe(true);
      expect(data.licence).toBeDefined();
      expect(data.licence.companyName).toBe('Brand B');
      expect(catalogService.findByManufacturer).toHaveBeenCalledWith(2);
    });
  });

  describe('getInspectorDashboardData', () => {
    it('should aggregate pending queue and recent inspection decisions', async () => {
      const data = await service.getInspectorDashboardData();

      expect(data.stats.total).toBe(10);
      expect(data.pendingDocuments).toBeDefined();
      expect(data.sampleLicences).toHaveLength(1);
      expect(documentService.getStatistics).toHaveBeenCalled();
    });
  });

  describe('getAdminDashboardData', () => {
    it('should aggregate platform user directory, F03 rule stats, and system vitals', async () => {
      const data = await service.getAdminDashboardData();

      expect(data.totalUsers).toBe(4);
      expect(data.roleBreakdown.consumer).toBe(1);
      expect(data.roleBreakdown.manufacturer).toBe(1);
      expect(data.roleBreakdown.inspector).toBe(1);
      expect(data.roleBreakdown.admin).toBe(1);
      expect(data.totalProducts).toBe(15);
      expect(data.docStats.total).toBe(10);
      expect(data.ruleStats.total).toBe(35);
      expect(data.ruleStats.active).toBe(33);
      expect(ruleManagementService.getQuickStats).toHaveBeenCalled();
      expect(data.userTypesCount).toBe(4);
      expect(data.userTypes).toHaveLength(4);
      expect(data.users[0].status).toBeDefined();
    });

    it('should support pagination, sorting and role filtering', async () => {
      const paged = await service.getAdminDashboardData({
        page: 1,
        limit: 2,
        sort: 'name',
        order: 'ASC',
      });

      expect(paged.page).toBe(1);
      expect(paged.limit).toBe(2);
      expect(paged.totalPages).toBe(2);
      expect(paged.total).toBe(4);
      expect(paged.users).toHaveLength(2);
      // 'Admin D' should come first in ASC name order
      expect(paged.users[0].name).toBe('Admin D');

      const filtered = await service.getAdminDashboardData({
        role: 'consumer',
      });
      expect(filtered.users).toHaveLength(1);
      expect(filtered.users[0].role).toBe('consumer');

      const searched = await service.getAdminDashboardData({
        search: 'inspector',
      });
      expect(searched.users).toHaveLength(1);
      expect(searched.users[0].name).toBe('Inspector C');
      expect(searched.users[0].status).toBe('unverified');
    });

    it('should optimize query execution based on active tab', async () => {
      // Act: Catalog tab
      const catalogData = await service.getAdminDashboardData({ tab: 'catalog' });
      expect(catalogData.currentTab).toBe('catalog');
      expect(catalogData.catalogProducts).toHaveLength(1);
      expect(catalogData.users).toHaveLength(0); // Users list omitted on catalog tab for speed
      expect(catalogData.totalUsers).toBe(4); // User summary metrics still available
      expect(catalogService.adminSearchAll).toHaveBeenCalledWith(
        expect.objectContaining({ statusCounts: expect.any(Object) }),
      );

      // Act: Users tab
      catalogService.adminSearchAll.mockClear();
      const usersData = await service.getAdminDashboardData({ tab: 'users' });
      expect(usersData.currentTab).toBe('users');
      expect(usersData.users).toHaveLength(4);
      expect(catalogService.adminSearchAll).not.toHaveBeenCalled(); // Catalog search skipped on users tab
    });
  });

  describe('createAdminUser', () => {
    it('should create and persist a new user account with hashed password', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.createAdminUser({
        name: 'New Officer',
        email: 'officer@truelabel.org',
        role: 'inspector',
        password: 'securePassword123',
        isVerified: true,
      });

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'officer@truelabel.org' } });
      expect(userRepo.create).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('New Officer');
    });

    it('should throw ConflictException if email is already taken', async () => {
      userRepo.findOne.mockResolvedValue({ id: 99, email: 'taken@test.com' });

      await expect(
        service.createAdminUser({
          name: 'Duplicate Guy',
          email: 'taken@test.com',
          role: 'consumer',
        }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('updateAdminUser', () => {
    it('should update user fields and verification status', async () => {
      const mockUser = {
        id: 2,
        name: 'Old Name',
        email: 'old@test.com',
        role: 'consumer',
        isVerified: false,
      };
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.updateAdminUser(2, {
        name: 'Updated Name',
        role: 'manufacturer',
        isVerified: true,
      });

      expect(result.name).toBe('Updated Name');
      expect(result.role).toBe('manufacturer');
      expect(result.isVerified).toBe(true);
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateAdminUser(999, { name: 'Nonexistent' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteAdminUser', () => {
    it('should delete user when target is not current admin', async () => {
      userRepo.findOne.mockResolvedValue({ id: 2, name: 'Brand B' });

      const result = await service.deleteAdminUser(2, 4);

      expect(result.success).toBe(true);
      expect(userRepo.delete).toHaveBeenCalledWith(2);
    });

    it('should prevent deleting own administrative account', async () => {
      await expect(service.deleteAdminUser(4, 4)).rejects.toThrow('cannot delete your own');
    });

    it('should throw NotFoundException if target user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteAdminUser(999, 4)).rejects.toThrow('not found');
    });
  });
});
