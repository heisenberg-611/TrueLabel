import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  Render,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CatalogService } from '../services/catalog.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { ReviewService } from '../../community/services/review.service';
import { CreateFoodProductDto } from '../models/dto/create-food-product.dto';
import { SearchFoodProductDto } from '../models/dto/search-food-product.dto';
import { BanFoodProductDto } from '../models/dto/ban-food-product.dto';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('catalog')
export class FoodCatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly preferenceService: PreferenceService,
    private readonly documentService: DocumentService,
    @Optional() private readonly reviewService?: ReviewService,
  ) {}

  /**
   * Catalog Discovery: Search, filter by category/tag, score breakdown
   */
  @Get()
  @Render('areas/food-catalog/views/index')
  async getCatalog(@Query() searchDto: SearchFoodProductDto, @Req() req: Request) {
    const { items, total, page, totalPages } =
      await this.catalogService.searchAndFilter(searchDto);
    const filterOptions = await this.catalogService.getFilterOptions();

    let userProfile = null;
    if (req.session?.user && req.session.user.role === 'consumer') {
      userProfile = await this.preferenceService.findByUserId(req.session.user.id);
    }

    const annotatedItems = items.map((prod) => {
      const conflict = userProfile
        ? this.preferenceService.evaluateProductConflict(userProfile, prod)
        : null;
      return {
        ...prod,
        userConflict: conflict,
      };
    });

    return {
      title: 'Food Catalog & Transparency Score — TrueLabel',
      activeNav: 'catalog',
      products: annotatedItems,
      total,
      page,
      totalPages,
      query: searchDto.q || '',
      selectedCategory: searchDto.category || '',
      selectedTag: searchDto.tag || '',
      minScore: searchDto.minScore || '',
      categories: filterOptions.categories,
      dietaryTags: filterOptions.dietaryTags,
      user: req.session?.user || null,
      userProfile,
    };
  }

  /**
   * Manufacturer View: Product Creation Form
   * F06 Gate: Manufacturer must have at least one approved safety document.
   */
  @Get('manage/create')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @Render('areas/food-catalog/views/create')
  async getCreateForm(
    @Req() req: Request,
    @Query('barcode') barcode?: string,
  ) {
    const user = req.session?.user;

    // Admins bypass the licence gate
    if (user?.role === 'manufacturer') {
      const isApproved = await this.documentService.hasApprovedDocument(user.id);
      if (!isApproved) {
        return {
          title: 'Submit Food to Catalog — TrueLabel',
          activeNav: 'catalog',
          user,
          licenceBlocked: true,
          error:
            'Your account is not yet approved. Please submit a safety document and wait for an Inspector to approve it before listing food products.',
          categories: [],
          dietaryTags: [],
          barcode: '',
        };
      }
    }

    const filterOptions = await this.catalogService.getFilterOptions();
    return {
      title: 'Submit Food to Catalog — TrueLabel',
      activeNav: 'catalog',
      categories: filterOptions.categories,
      dietaryTags: filterOptions.dietaryTags,
      barcode: barcode ? barcode.trim() : '',
      user,
    };
  }

  /**
   * Process Product Creation Form
   * F06 Gate: Manufacturer must have at least one approved safety document.
   */
  @Post('manage/create')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Validation failed for food product submission',
        );
      },
    }),
  )
  async handleCreate(
    @Body() dto: CreateFoodProductDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = req.session.user;

      // Admins bypass the licence gate
      if (user?.role === 'manufacturer') {
        const isApproved = await this.documentService.hasApprovedDocument(user.id);
        if (!isApproved) {
          const filterOptions = await this.catalogService.getFilterOptions();
          return res.status(403).render('areas/food-catalog/views/create', {
            title: 'Submit Food to Catalog — TrueLabel',
            activeNav: 'catalog',
            user,
            licenceBlocked: true,
            error:
              'Your account is not yet approved. Please submit a safety document and wait for an Inspector to approve it before listing food products.',
            categories: filterOptions.categories,
            dietaryTags: filterOptions.dietaryTags,
            barcode: dto.barcode || '',
            productData: dto,
          });
        }
      }

      const body = req.body || {};

      // Extract and map nutrition facts & ingredients from form submission
      if (!dto.nutritionFacts || dto.nutritionFacts.length === 0) {
        dto.nutritionFacts = buildNutritionFactsFromForm(body);
      }
      if (!dto.ingredients || dto.ingredients.length === 0) {
        dto.ingredients = parseRawIngredients(body.rawIngredients);
      }

      const product = await this.catalogService.create(dto, user.id);
      return res.redirect(`/catalog/product/${product.id}`);
    } catch (err) {
      const filterOptions = await this.catalogService.getFilterOptions();
      return res.status(400).render('areas/food-catalog/views/create', {
        title: 'Submit Food to Catalog — TrueLabel',
        activeNav: 'catalog',
        error: err.message || 'Failed to register product',
        productData: dto,
        categories: filterOptions.categories,
        dietaryTags: filterOptions.dietaryTags,
        user: req.session?.user,
      });
    }
  }

  /**
   * Alias: POST /catalog/manage -> maps to handleCreate
   */
  @Post('manage')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Validation failed for food product submission',
        );
      },
    }),
  )
  async handleCreateAlias(
    @Body() dto: CreateFoodProductDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleCreate(dto, req, res);
  }

  /**
   * Barcode Search: Direct lookup or Request-to-Add page
   */
  @Get('barcode/:barcode')
  async searchBarcode(
    @Param('barcode') barcode: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const product = await this.catalogService.findByBarcode(barcode);
    if (product) {
      return res.redirect(`/catalog/product/${product.id}`);
    }
    return res.render('areas/food-catalog/views/not-found', {
      title: 'Barcode Not Found — TrueLabel',
      activeNav: 'catalog',
      barcode,
      user: req.session?.user || null,
    });
  }

  /**
   * Product Details: Ingredients, Nutrition Facts, Transparency breakdown
   */
  @Get('product/:id')
  @Render('areas/food-catalog/views/detail')
  async getProductDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Query('success') success?: string,
    @Query('error') error?: string,
  ) {
    const product = await this.catalogService.findById(id);

    // Group ingredients by hazard level for clear presentation
    const allergens = product.ingredients?.filter((i) => i.isAllergen) || [];
    const additives = product.ingredients?.filter((i) => i.additiveCode) || [];

    // Personal Allergen & Dietary Conflict Evaluation (Feature F16 - Consumer only)
    let conflictEvaluation = null;
    let userProfile = null;
    if (req.session?.user && req.session.user.role === 'consumer') {
      userProfile = await this.preferenceService.findByUserId(req.session.user.id);
      conflictEvaluation = this.preferenceService.evaluateProductConflict(
        userProfile,
        product,
      );
    }

    // Feature F11: Credibility-weighted community review summary on product dossier
    const reviewSummary = this.reviewService
      ? await this.reviewService.getProductSummary(id)
      : { reviewCount: 0, averageRating: null, dimensionAverages: [], recentReviews: [] };

    return {
      title: `${product.name} (${product.brand}) — TrueLabel`,
      activeNav: 'catalog',
      product,
      allergens,
      additives,
      conflictEvaluation,
      userProfile,
      reviewSummary,
      isOwner:
        req.session?.user?.role === 'admin' ||
        (req.session?.user?.role === 'manufacturer' &&
          req.session?.user?.id === product.manufacturerId),
      user: req.session?.user || null,
      success: success ? decodeURIComponent(success) : null,
      error: error ? decodeURIComponent(error) : null,
    };
  }

  /**
   * Manufacturer View: Product Edit Form
   */
  @Get('manage/:id/edit')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @Render('areas/food-catalog/views/edit')
  async getEditForm(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const product = await this.catalogService.findById(id);
    const user = req.session?.user;

    // Strict Object-Level Authorization: Manufacturers may only access their own product edit form
    if (user?.role === 'manufacturer' && product.manufacturerId !== user.id) {
      throw new ForbiddenException(
        'Manufacturers are only permitted to edit their own food products',
      );
    }

    const filterOptions = await this.catalogService.getFilterOptions();

    const nutritionMap: Record<string, number> = {};
    (product.nutritionFacts || []).forEach((n) => {
      nutritionMap[n.nutrient] = n.amountPer100g;
      if (n.nutrient === 'Saturated Fat') nutritionMap.SaturatedFat = n.amountPer100g;
    });
    const rawIngredients = (product.ingredients || []).map((i) => i.name).join(', ');

    return {
      title: `Edit ${product.name} — TrueLabel`,
      activeNav: 'catalog',
      product,
      nutritionMap,
      rawIngredients,
      categories: filterOptions.categories,
      dietaryTags: filterOptions.dietaryTags,
      user,
    };
  }

  /**
   * Process Product Edit Form
   */
  @Post('manage/:id/edit')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  async handleEdit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateFoodProductDto>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const body = req.body || {};
      if (body.nutrition_energy !== undefined) {
        dto.nutritionFacts = buildNutritionFactsFromForm(body);
      }
      if (body.rawIngredients !== undefined) {
        dto.ingredients = parseRawIngredients(body.rawIngredients);
      }
      await this.catalogService.update(id, dto, req.session.user);
      return res.redirect(`/catalog/product/${id}`);
    } catch (err) {
      const product = await this.catalogService.findById(id);
      const filterOptions = await this.catalogService.getFilterOptions();
      return res.render('areas/food-catalog/views/edit', {
        title: `Edit ${product.name} — TrueLabel`,
        error: err.message || 'Failed to update product',
        product,
        categories: filterOptions.categories,
        dietaryTags: filterOptions.dietaryTags,
        user: req.session?.user,
      });
    }
  }

  /**
   * Process Product Archive
   */
  @Post('manage/:id/archive')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  async handleArchive(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.catalogService.archive(id, req.session.user);
    return res.redirect('/catalog');
  }

  /**
   * Process Product Ban (Feature F01: Administrative Regulatory Governance)
   */
  @Post('manage/:id/ban')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('admin')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleBan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BanFoodProductDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const product = await this.catalogService.ban(id, dto.reason, req.session.user);
      return res.redirect(
        `/catalog/product/${id}?success=${encodeURIComponent(`Product "${product.name}" has been placed under regulatory ban.`)}`,
      );
    } catch (err: any) {
      return res.redirect(
        `/catalog/product/${id}?error=${encodeURIComponent(err.message || 'Failed to ban food product')}`,
      );
    }
  }

  /**
   * Process Product Reinstatement / Unban (Feature F01: Administrative Regulatory Governance)
   */
  @Post('manage/:id/unban')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('admin')
  async handleUnban(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const product = await this.catalogService.unban(id, req.session.user);
      return res.redirect(
        `/catalog/product/${id}?success=${encodeURIComponent(`Product "${product.name}" has been reinstated to active status.`)}`,
      );
    } catch (err: any) {
      return res.redirect(
        `/catalog/product/${id}?error=${encodeURIComponent(err.message || 'Failed to reinstate product')}`,
      );
    }
  }

  /**
   * Process Permanent Product Deletion (Feature F01: Administrative Regulatory Governance)
   */
  @Post('manage/:id/delete')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('admin')
  async handleDelete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.catalogService.delete(id, req.session.user);
      return res.redirect(
        `/dashboard/admin?tab=catalog&success=${encodeURIComponent(`Product #${id} has been permanently deleted from the catalog.`)}`,
      );
    } catch (err: any) {
      return res.redirect(
        `/dashboard/admin?tab=catalog&error=${encodeURIComponent(err.message || 'Failed to delete food product')}`,
      );
    }
  }
}

/**
 * Helper to parse comma-separated raw ingredients with allergen & additive detection
 */
export function parseRawIngredients(raw?: string) {
  if (!raw || !raw.trim()) return [];
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return items.map((name) => {
    const lower = name.toLowerCase();
    let isAllergen = false;
    let allergenType: string | undefined = undefined;

    if (/peanut|groundnut/.test(lower)) {
      isAllergen = true;
      allergenType = 'Peanut';
    } else if (/milk|dairy|cheese|cream|whey|casein|butter|lactose|yogurt/.test(lower)) {
      isAllergen = true;
      allergenType = 'Milk';
    } else if (/wheat|gluten|barley|rye|spelt/.test(lower)) {
      isAllergen = true;
      allergenType = 'Gluten';
    } else if (/soy|soya|soybean/.test(lower)) {
      isAllergen = true;
      allergenType = 'Soy';
    } else if (/almond|walnut|cashew|hazelnut|pecan|pistachio|macadamia|tree nut/.test(lower)) {
      isAllergen = true;
      allergenType = 'Tree Nut';
    } else if (/egg|albumin/.test(lower)) {
      isAllergen = true;
      allergenType = 'Egg';
    } else if (/celery/.test(lower)) {
      isAllergen = true;
      allergenType = 'Celery';
    } else if (/sesame/.test(lower)) {
      isAllergen = true;
      allergenType = 'Sesame';
    }

    const match = /E-?(\d{3,4}[a-z]?)/i.exec(name);
    const additiveCode = match ? `E${match[1].toUpperCase()}` : undefined;

    let hazardLevel: 'safe' | 'caution' | 'warning' = 'safe';
    if (additiveCode && /E150|E211|E635|E250|E102|E110|E129/.test(additiveCode)) {
      hazardLevel = 'caution';
    } else if (/high fructose|palm oil|hydrogenated|artificial/.test(lower)) {
      hazardLevel = 'caution';
    }

    return {
      name,
      isAllergen,
      allergenType,
      additiveCode,
      hazardLevel,
    };
  });
}

/**
 * Helper to build nutrition facts from standard form inputs
 */
export function buildNutritionFactsFromForm(body: any) {
  const servingSize = Number(body.servingSize) || 100;

  const specs = [
    { key: 'nutrition_energy', name: 'Energy', unit: 'kcal' },
    { key: 'nutrition_fat', name: 'Fat', unit: 'g' },
    { key: 'nutrition_saturatedFat', name: 'Saturated Fat', unit: 'g' },
    { key: 'nutrition_carbohydrates', name: 'Carbohydrates', unit: 'g' },
    { key: 'nutrition_sugars', name: 'Sugars', unit: 'g' },
    { key: 'nutrition_fiber', name: 'Fiber', unit: 'g' },
    { key: 'nutrition_protein', name: 'Protein', unit: 'g' },
    { key: 'nutrition_salt', name: 'Salt', unit: 'g' },
  ];

  return specs.map((spec) => {
    const rawVal = body[spec.key];
    const amountPer100g = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : 0;
    const amountPerServing = Math.round(((amountPer100g * servingSize) / 100) * 10) / 10;
    return {
      nutrient: spec.name,
      amountPer100g: isNaN(amountPer100g) ? 0 : amountPer100g,
      amountPerServing,
      unit: spec.unit,
    };
  });
}

