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
import { IngredientAnalyzerService } from '../services/ingredient-analyzer.service';
import { FoodScoreBreakdown, FoodScoreService, ScoreHistoryViewItem } from '../services/food-score.service';
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
  private _fallbackAnalyzer?: IngredientAnalyzerService;

  constructor(
    private readonly catalogService: CatalogService,
    private readonly preferenceService: PreferenceService,
    private readonly documentService: DocumentService,
    @Optional() private readonly reviewService?: ReviewService,
    @Optional() private readonly ingredientAnalyzer?: IngredientAnalyzerService,
    @Optional() private readonly foodScoreService?: FoodScoreService,
  ) {}

  private get analyzer(): IngredientAnalyzerService {
    if (this.ingredientAnalyzer) return this.ingredientAnalyzer;
    if (!this._fallbackAnalyzer) {
      this._fallbackAnalyzer = new IngredientAnalyzerService();
    }
    return this._fallbackAnalyzer;
  }

  /**
   * Build nutrient lookup map for `_nutrition_facts_form` partial, optionally
   * overlaying submitted POST form values so validation failures retain user input.
   */
  private buildNutritionMap(
    nutritionFacts: Array<{ nutrient: string; amountPer100g: number }> = [],
    submittedBody?: Record<string, any>,
  ): Record<string, number | string> {
    const map: Record<string, number | string> = {};
    (nutritionFacts || []).forEach((n) => {
      map[n.nutrient] = n.amountPer100g;
      if (n.nutrient === 'Saturated Fat') map.SaturatedFat = n.amountPer100g;
    });

    if (submittedBody) {
      const formFieldPairs: Array<[string, string]> = [
        ['nutrition_energy', 'Energy'],
        ['nutrition_fat', 'Fat'],
        ['nutrition_saturatedFat', 'SaturatedFat'],
        ['nutrition_carbohydrates', 'Carbohydrates'],
        ['nutrition_sugars', 'Sugars'],
        ['nutrition_fiber', 'Fiber'],
        ['nutrition_protein', 'Protein'],
        ['nutrition_salt', 'Salt'],
      ];
      for (const [field, key] of formFieldPairs) {
        if (submittedBody[field] !== undefined && submittedBody[field] !== '') {
          map[key] = submittedBody[field];
        }
      }
    }

    return map;
  }

  /**
   * Catalog Discovery: Search, filter by category/tag, score breakdown
   */
  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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

    const normalizedMinScore =
      searchDto.minScore !== undefined &&
      searchDto.minScore !== null &&
      String(searchDto.minScore).trim() !== '' &&
      Number.isFinite(Number(searchDto.minScore)) &&
      Number(searchDto.minScore) > 0
        ? Number(searchDto.minScore)
        : '';

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
      minScore: normalizedMinScore,
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

      // Delegate nutrition & raw ingredient parsing to pure F03 analyzer service
      if (!dto.nutritionFacts || dto.nutritionFacts.length === 0) {
        dto.nutritionFacts = this.analyzer.buildNutritionFactsFromForm(body);
      }
      if (!dto.ingredients || dto.ingredients.length === 0) {
        dto.ingredients = this.analyzer.parseRawIngredients(
          body.rawIngredients,
          [],
          dto.category,
        ).map((item) => ({
          name: item.name,
          isAllergen: item.isAllergen,
          allergenType: item.allergenType || undefined,
          additiveCode: item.additiveCode || undefined,
          hazardLevel: item.hazardLevel,
        }));
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
   * Product Details: Ingredients, Rule-Based Analysis (F03), Explainable Score (F04), Nutrition Facts
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

    // Feature F03: Rule-based ingredient, additive & allergen analysis (with unknown separation)
    const ingredientAnalysis =
      typeof this.catalogService.analyzeProductIngredients === 'function'
        ? await this.catalogService.analyzeProductIngredients(product)
        : this.analyzer.buildProductAnalysisReport(
            product.ingredients || [],
            [],
            product.category,
          );

    const allergens = ingredientAnalysis.allergens;
    const additives = ingredientAnalysis.additives;

    // Feature F04: Live 5-component Food Quality Score computation & snapshot sync
    let scoreBreakdown: FoodScoreBreakdown | null = null;
    let scoreHistory: ScoreHistoryViewItem[] = [];
    let scoringConfig: any = null;
    if (this.foodScoreService) {
      const scoreSync = await this.foodScoreService.evaluateAndSyncProduct(product, {
        trigger: 'signal_sync',
      });
      scoreBreakdown = scoreSync.breakdown;
      scoreHistory = scoreSync.history;
      scoringConfig = scoreSync.config;
    }

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
      ingredientAnalysis,
      scoreBreakdown,
      scoreHistory,
      scoringConfig,
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
    const nutritionMap = this.buildNutritionMap(product.nutritionFacts || []);
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
      if (body.servingSize !== undefined && String(body.servingSize).trim() !== '') {
        const parsedServing = Number(body.servingSize);
        if (Number.isFinite(parsedServing) && parsedServing > 0) {
          dto.servingSize = parsedServing;
        }
      }
      if (typeof body.dietaryTags === 'string') {
        dto.dietaryTags = body.dietaryTags
          .split(',')
          .map((tag: string) => tag.trim())
          .filter(Boolean);
      }
      if (body.nutrition_energy !== undefined) {
        dto.nutritionFacts = this.analyzer.buildNutritionFactsFromForm(body);
      }
      if (body.rawIngredients !== undefined) {
        dto.ingredients = this.analyzer.parseRawIngredients(
          body.rawIngredients,
          [],
          dto.category || body.category,
        ).map((item) => ({
          name: item.name,
          isAllergen: item.isAllergen,
          allergenType: item.allergenType || undefined,
          additiveCode: item.additiveCode || undefined,
          hazardLevel: item.hazardLevel,
        }));
      }
      await this.catalogService.update(id, dto, req.session.user);
      return res.redirect(`/catalog/product/${id}`);
    } catch (err) {
      const product = await this.catalogService.findById(id);
      const filterOptions = await this.catalogService.getFilterOptions();
      const body = req.body || {};
      const nutritionMap = this.buildNutritionMap(product.nutritionFacts || [], body);
      const rawIngredients =
        body.rawIngredients !== undefined
          ? body.rawIngredients
          : (product.ingredients || []).map((i) => i.name).join(', ');
      const statusCode = err instanceof ForbiddenException ? 403 : 400;

      const preservedProduct = {
        ...product,
        name: body.name ?? product.name,
        brand: body.brand ?? product.brand,
        category: body.category ?? product.category,
        barcode: body.barcode ?? product.barcode,
        description: body.description !== undefined ? body.description : product.description,
        servingSize: body.servingSize || product.servingSize,
        servingUnit: body.servingUnit || product.servingUnit,
      };

      return res.status(statusCode).render('areas/food-catalog/views/edit', {
        title: `Edit ${product.name} — TrueLabel`,
        activeNav: 'catalog',
        error: err.message || 'Failed to update product',
        product: preservedProduct,
        nutritionMap,
        rawIngredients,
        dietaryTagsRaw: typeof body.dietaryTags === 'string' ? body.dietaryTags : undefined,
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
