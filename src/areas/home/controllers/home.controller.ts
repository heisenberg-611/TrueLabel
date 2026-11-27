import { Controller, Get, Optional, Req, Render } from '@nestjs/common';
import { Request } from 'express';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { FoodScoreService } from '../../food-catalog/services/food-score.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';

@Controller()
export class HomeController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly documentService: DocumentService,
    private readonly preferenceService: PreferenceService,
    @Optional() private readonly foodScoreService?: FoodScoreService,
  ) { }

  /**
   * Home Landing Page: Central platform hub presenting core pillars,
   * live transparency metrics, interactive quick-verifier, and featured catalog foods.
   */
  @Get()
  @Render('areas/home/views/index')
  async getHomePage(@Req() req: Request) {
    // 1. Fetch featured food products from catalog (top 4 items)
    const { items: featuredProducts, total: totalProducts } =
      await this.catalogService.searchAndFilter({ limit: 4 });

    // 2. Fetch safety documents, scoring weights & compliance statistics
    const [docStats, sampleLicences, filterOptions, scoringConfig] = await Promise.all([
      this.documentService.getStatistics(),
      this.documentService.getSampleLicences(6),
      this.catalogService.getFilterOptions(),
      this.foodScoreService ? this.foodScoreService.getActiveConfig() : Promise.resolve(null),
    ]);

    // 3. User session & personalized health profile evaluation
    const user = req.session?.user || null;
    let userProfile = null;
    let manufacturerDocsCount = 0;

    if (user) {
      if (user.role === 'consumer') {
        userProfile = await this.preferenceService.findByUserId(user.id);
      }
      if (user.role === 'manufacturer' || user.role === 'admin') {
        const userDocs = await this.documentService.getDocuments({ manufacturerId: user.id });
        manufacturerDocsCount = userDocs.length;
      }
    }

    // Annotate featured items with user's allergen/dietary conflict status
    const annotatedFeatured = featuredProducts.map((prod) => {
      const conflict = userProfile
        ? this.preferenceService.evaluateProductConflict(userProfile, prod)
        : null;
      return {
        ...prod,
        userConflict: conflict,
      };
    });

    const userAllergenConflictsCount = annotatedFeatured.filter(
      (p) => p.userConflict?.hasAllergenConflict,
    ).length;
    const userSafeProductsCount = annotatedFeatured.filter(
      (p) => p.userConflict?.isSafeForUser,
    ).length;

    // Build authentic dynamic specimen dossier analysis for the hero highlight
    const dossierProduct = annotatedFeatured.length > 0 ? annotatedFeatured[0] : null;
    const dossierSpecimen = dossierProduct
      ? this.catalogService.buildDossierSpecimen(
        dossierProduct,
        sampleLicences.length > 0 ? sampleLicences[0].licenceNumber : undefined,
      )
      : null;

    return {
      title: 'TrueLabel — Food Quality, Safety & Diet Intelligence Platform',
      activeNav: 'home',
      featuredProducts: annotatedFeatured,
      dossierProduct,
      dossierSpecimen,
      sampleLicences,
      scoringConfig,
      quickCategories: filterOptions.categories.slice(0, 3),
      quickTags: filterOptions.dietaryTags.slice(0, 3),
      stats: {
        products: totalProducts,
        documents: docStats.total,
        approvedDocs: docStats.approved,
        pendingDocs: docStats.pending,
      },
      roleInsights: {
        manufacturerDocsCount,
        userAllergenConflictsCount,
        userSafeProductsCount,
      },
      user,
      userProfile,
    };
  }

  /**
   * Terms & Conditions Page
   */
  @Get('terms')
  @Render('areas/home/views/terms')
  getTermsPage(@Req() req: Request) {
    return {
      title: 'Terms of Service & Regulatory Compliance — TrueLabel',
      activeNav: 'terms',
      user: req.session?.user || null,
    };
  }

  /**
   * Privacy Policy & Personal Health Data Protection Page
   */
  @Get('privacy')
  @Render('areas/home/views/privacy')
  getPrivacyPage(@Req() req: Request) {
    return {
      title: 'Privacy Policy & Health Data Protection — TrueLabel',
      activeNav: 'privacy',
      user: req.session?.user || null,
    };
  }

  /**
   * Cache, Cookie & Storage Policy Page
   */
  @Get('cache-policy')
  @Render('areas/home/views/cache-policy')
  getCachePolicyPage(@Req() req: Request) {
    return {
      title: 'Cache, Cookies & Data Storage Policy — TrueLabel',
      activeNav: 'cache-policy',
      user: req.session?.user || null,
    };
  }

  /**
   * About TrueLabel & Public Standards Page
   */
  @Get('about')
  @Render('areas/home/views/about')
  getAboutPage(@Req() req: Request) {
    return {
      title: 'About TrueLabel & Public Quality Standards — TrueLabel',
      activeNav: 'about',
      user: req.session?.user || null,
    };
  }

  /**
   * Contact & Regulatory Inquiries Page
   */
  @Get('contact')
  @Render('areas/home/views/contact')
  getContactPage(@Req() req: Request) {
    return {
      title: 'Contact & Regulatory Inquiries — TrueLabel',
      activeNav: 'contact',
      user: req.session?.user || null,
    };
  }
}
