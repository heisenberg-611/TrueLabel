import { Test, TestingModule } from '@nestjs/testing';
import { FoodCatalogController } from './food-catalog.controller';
import { CatalogService } from '../services/catalog.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import { DocumentService } from '../../food-safety/services/document.service';

describe('FoodCatalogController (Unit Tests)', () => {
  let controller: FoodCatalogController;
  let catalogService: jest.Mocked<Partial<CatalogService>>;
  let preferenceService: jest.Mocked<Partial<PreferenceService>>;
  let documentService: jest.Mocked<Partial<DocumentService>>;

  const mockProduct = {
    id: 1,
    name: 'Pure Oat Milk',
    brand: 'OatLand',
    category: 'Dairy & Plant Milks',
    barcode: '8901234567890',
    status: 'active' as const,
    qualityScore: 88,
    manufacturerId: 10,
    ingredients: [],
    nutritionFacts: [],
  };

  beforeEach(async () => {
    catalogService = {
      searchAndFilter: jest.fn(),
      findByBarcode: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      ban: jest.fn(),
      unban: jest.fn(),
      delete: jest.fn(),
      getFilterOptions: jest.fn().mockResolvedValue({
        categories: ['Dairy & Plant Milks'],
        dietaryTags: ['Vegan'],
      }),
    };

    preferenceService = {
      findByUserId: jest.fn().mockResolvedValue(null),
      evaluateProductConflict: jest.fn().mockReturnValue({
        hasConflicts: false,
        hasAllergenConflict: false,
        hasDietaryConflict: false,
        hasNutritionWarning: false,
        conflicts: [],
        matchedAllergies: [],
        dietaryMismatches: [],
        isSafeForUser: true,
        profileConfigured: false,
      }),
    };

    documentService = {
      hasApprovedDocument: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoodCatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: catalogService,
        },
        {
          provide: PreferenceService,
          useValue: preferenceService,
        },
        {
          provide: DocumentService,
          useValue: documentService,
        },
      ],
    }).compile();

    controller = module.get<FoodCatalogController>(FoodCatalogController);
  });

  describe('getCatalog', () => {
    it('should return catalog view model with products and filters', async () => {
      (catalogService.searchAndFilter as jest.Mock).mockResolvedValue({
        items: [mockProduct],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const mockReq = { session: { user: null } } as any;
      const result = await controller.getCatalog({}, mockReq);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.title).toContain('Food Catalog');
      expect(result.userProfile).toBeNull();
      expect(result.products[0].userConflict).toBeNull();
    });

    it('should not evaluate dietary profile for manufacturers in catalog discovery', async () => {
      (catalogService.searchAndFilter as jest.Mock).mockResolvedValue({
        items: [mockProduct],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const mockReq = { session: { user: { id: 10, role: 'manufacturer' } } } as any;
      const result = await controller.getCatalog({}, mockReq);

      expect(preferenceService.findByUserId).not.toHaveBeenCalled();
      expect(result.userProfile).toBeNull();
      expect(result.products[0].userConflict).toBeNull();
    });

    it('should evaluate dietary profile for consumers in catalog discovery', async () => {
      (catalogService.searchAndFilter as jest.Mock).mockResolvedValue({
        items: [mockProduct],
        total: 1,
        page: 1,
        totalPages: 1,
      });
      (preferenceService.findByUserId as jest.Mock).mockResolvedValue({ id: 1, allergies: [] });

      const mockReq = { session: { user: { id: 5, role: 'consumer' } } } as any;
      const result = await controller.getCatalog({}, mockReq);

      expect(preferenceService.findByUserId).toHaveBeenCalledWith(5);
      expect(preferenceService.evaluateProductConflict).toHaveBeenCalled();
      expect(result.userProfile).toBeDefined();
      expect(result.products[0].userConflict).toBeDefined();
    });
  });

  describe('searchBarcode', () => {
    it('should redirect to product page if barcode exists', async () => {
      (catalogService.findByBarcode as jest.Mock).mockResolvedValue(mockProduct);

      const mockRes = { redirect: jest.fn(), render: jest.fn() } as any;
      const mockReq = { session: {} } as any;

      await controller.searchBarcode('8901234567890', mockRes, mockReq);
      expect(mockRes.redirect).toHaveBeenCalledWith('/catalog/product/1');
    });

    it('should render not-found page if barcode does not exist', async () => {
      (catalogService.findByBarcode as jest.Mock).mockResolvedValue(null);

      const mockRes = { redirect: jest.fn(), render: jest.fn() } as any;
      const mockReq = { session: {} } as any;

      await controller.searchBarcode('999999999', mockRes, mockReq);
      expect(mockRes.render).toHaveBeenCalledWith(
        'areas/food-catalog/views/not-found',
        expect.objectContaining({ barcode: '999999999' }),
      );
    });
  });

  describe('getProductDetail', () => {
    it('should return product details with allergen and additive groupings and null conflictEvaluation for manufacturers', async () => {
      const productWithIngr = {
        ...mockProduct,
        ingredients: [
          { name: 'Peanut Paste', isAllergen: true, allergenType: 'Peanut' },
          { name: 'Caramel Color', additiveCode: 'E150d' },
        ],
      };
      (catalogService.findById as jest.Mock).mockResolvedValue(productWithIngr as any);

      const mockReq = { session: { user: { id: 10, role: 'manufacturer' } } } as any;
      const result = await controller.getProductDetail(1, mockReq);

      expect(result.product.name).toBe('Pure Oat Milk');
      expect(result.allergens).toHaveLength(1);
      expect(result.additives).toHaveLength(1);
      expect(result.isOwner).toBe(true);
      expect(result.conflictEvaluation).toBeNull();
      expect(result.userProfile).toBeNull();
      expect(preferenceService.findByUserId).not.toHaveBeenCalled();
    });

    it('should evaluate personal dietary conflict for consumer users on product detail', async () => {
      (catalogService.findById as jest.Mock).mockResolvedValue(mockProduct as any);
      (preferenceService.findByUserId as jest.Mock).mockResolvedValue({ id: 5, allergies: ['Peanut'] });

      const mockReq = { session: { user: { id: 5, role: 'consumer' } } } as any;
      const result = await controller.getProductDetail(1, mockReq);

      expect(result.conflictEvaluation).toBeDefined();
      expect(result.userProfile).toBeDefined();
      expect(preferenceService.findByUserId).toHaveBeenCalledWith(5);
      expect(preferenceService.evaluateProductConflict).toHaveBeenCalled();
    });
  });

  describe('getEditForm (BOLA / Ownership Authorization)', () => {
    it('should allow the product owner to access the edit form', async () => {
      (catalogService.findById as jest.Mock).mockResolvedValue(mockProduct as any);
      const mockReq = { session: { user: { id: 10, role: 'manufacturer' } } } as any;

      const result = await controller.getEditForm(1, mockReq);
      expect(result.product.id).toBe(1);
    });

    it('should throw ForbiddenException if another manufacturer attempts to access edit form', async () => {
      (catalogService.findById as jest.Mock).mockResolvedValue(mockProduct as any);
      const mockReq = { session: { user: { id: 99, role: 'manufacturer' } } } as any;

      await expect(controller.getEditForm(1, mockReq)).rejects.toThrow();
    });

    it('should allow an administrator to access edit form for any product', async () => {
      (catalogService.findById as jest.Mock).mockResolvedValue(mockProduct as any);
      const mockReq = { session: { user: { id: 99, role: 'admin' } } } as any;

      const result = await controller.getEditForm(1, mockReq);
      expect(result.product.id).toBe(1);
    });
  });

  describe('getCreateForm & handleCreate (F06 Safety Accreditation Gating)', () => {
    it('should block a manufacturer without approved safety document from create form', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(false);
      const mockReq = { session: { user: { id: 25, role: 'manufacturer' } } } as any;

      const result = await controller.getCreateForm(mockReq);
      expect(result.licenceBlocked).toBe(true);
      expect(result.error).toContain('not yet approved');
    });

    it('should allow a manufacturer with approved safety document to open create form', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(true);
      const mockReq = { session: { user: { id: 25, role: 'manufacturer' } } } as any;

      const result = await controller.getCreateForm(mockReq);
      expect(result.licenceBlocked).toBeUndefined();
      expect(result.categories).toBeDefined();
    });

    it('should allow an admin to open create form without safety document check', async () => {
      const mockReq = { session: { user: { id: 1, role: 'admin' } } } as any;

      const result = await controller.getCreateForm(mockReq);
      expect(documentService.hasApprovedDocument).not.toHaveBeenCalled();
      expect(result.categories).toBeDefined();
    });

    it('should reject food registration if manufacturer has no approved documents', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(false);
      const mockReq = { session: { user: { id: 25, role: 'manufacturer' } } } as any;
      const mockRes = { redirect: jest.fn(), render: jest.fn(), status: jest.fn().mockReturnThis() } as any;

      await controller.handleCreate({ name: 'Test', barcode: '123' } as any, mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith(
        'areas/food-catalog/views/create',
        expect.objectContaining({
          licenceBlocked: true,
          error: expect.stringContaining('not yet approved'),
        }),
      );
    });

    it('should successfully register product and redirect when manufacturer is approved', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(true);
      (catalogService.create as jest.Mock).mockResolvedValue({ id: 42 } as any);
      const mockReq = { session: { user: { id: 25, role: 'manufacturer' } } } as any;
      const mockRes = { redirect: jest.fn(), render: jest.fn(), status: jest.fn().mockReturnThis() } as any;

      await controller.handleCreate({ name: 'Test', barcode: '123' } as any, mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/catalog/product/42');
    });

    it('should map nutrition facts and parsed ingredients from form submission', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(true);
      (catalogService.create as jest.Mock).mockImplementation((dto) => Promise.resolve({ id: 88, ...dto }));
      const mockReq = {
        session: { user: { id: 25, role: 'manufacturer' } },
        body: {
          servingSize: '200',
          nutrition_energy: '120',
          nutrition_fat: '4.5',
          rawIngredients: 'Whole Cow Milk, Cocoa Powder, Soy Lecithin (E322), Salt',
        },
      } as any;
      const mockRes = { redirect: jest.fn(), render: jest.fn(), status: jest.fn().mockReturnThis() } as any;

      const dto = { name: 'Chocolate Drink', barcode: '88888888' } as any;
      await controller.handleCreate(dto, mockReq, mockRes);

      expect(catalogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Chocolate Drink',
          nutritionFacts: expect.arrayContaining([
            expect.objectContaining({ nutrient: 'Energy', amountPer100g: 120, amountPerServing: 240, unit: 'kcal' }),
            expect.objectContaining({ nutrient: 'Fat', amountPer100g: 4.5, amountPerServing: 9, unit: 'g' }),
          ]),
          ingredients: expect.arrayContaining([
            expect.objectContaining({ name: 'Whole Cow Milk', isAllergen: true, allergenType: 'Milk' }),
            expect.objectContaining({ name: 'Soy Lecithin (E322)', isAllergen: true, allergenType: 'Soy', additiveCode: 'E322' }),
          ]),
        }),
        25,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith('/catalog/product/88');
    });

    it('should render create view with error when service throws a ConflictException for duplicate barcode', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(true);
      (catalogService.create as jest.Mock).mockRejectedValue(
        new Error('A food product with barcode "123" already exists in the catalog'),
      );
      const mockReq = { session: { user: { id: 25, role: 'manufacturer' } } } as any;
      const mockRes = { redirect: jest.fn(), render: jest.fn(), status: jest.fn().mockReturnThis() } as any;

      const dto = { name: 'Duplicate Item', barcode: '123' } as any;
      await controller.handleCreate(dto, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith(
        'areas/food-catalog/views/create',
        expect.objectContaining({
          error: expect.stringContaining('already exists'),
          productData: dto,
        }),
      );
    });

    it('should route handleCreateAlias to handleCreate seamlessly', async () => {
      (documentService.hasApprovedDocument as jest.Mock).mockResolvedValue(true);
      (catalogService.create as jest.Mock).mockResolvedValue({ id: 99 } as any);
      const mockReq = { session: { user: { id: 25, role: 'manufacturer' } } } as any;
      const mockRes = { redirect: jest.fn(), render: jest.fn(), status: jest.fn().mockReturnThis() } as any;

      await controller.handleCreateAlias({ name: 'Alias Test', barcode: '555' } as any, mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/catalog/product/99');
    });
  });

  describe('Administrative Food Governance Actions (Feature F01)', () => {
    it('handleBan should call catalogService.ban and redirect to product detail with success message', async () => {
      // Arrange
      (catalogService.ban as jest.Mock).mockResolvedValue({ id: 1, name: 'Pure Oat Milk' } as any);
      const mockReq = { session: { user: { id: 99, role: 'admin' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleBan(1, { reason: 'Undeclared peanut traces' }, mockReq, mockRes);

      // Assert
      expect(catalogService.ban).toHaveBeenCalledWith(1, 'Undeclared peanut traces', mockReq.session.user);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/catalog/product/1?success='),
      );
    });

    it('handleUnban should call catalogService.unban and redirect with success message', async () => {
      // Arrange
      (catalogService.unban as jest.Mock).mockResolvedValue({ id: 1, name: 'Pure Oat Milk' } as any);
      const mockReq = { session: { user: { id: 99, role: 'admin' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleUnban(1, mockReq, mockRes);

      // Assert
      expect(catalogService.unban).toHaveBeenCalledWith(1, mockReq.session.user);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/catalog/product/1?success='),
      );
    });

    it('handleDelete should call catalogService.delete and redirect to admin catalog dashboard', async () => {
      // Arrange
      (catalogService.delete as jest.Mock).mockResolvedValue(undefined);
      const mockReq = { session: { user: { id: 99, role: 'admin' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      // Act
      await controller.handleDelete(1, mockReq, mockRes);

      // Assert
      expect(catalogService.delete).toHaveBeenCalledWith(1, mockReq.session.user);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/admin?tab=catalog&success='),
      );
    });
  });
});

