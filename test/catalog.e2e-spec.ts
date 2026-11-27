import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureE2eApp } from './e2e-helper';

describe('Food Catalog, Ingredient Analysis & Food Comparison (E2E Integration Test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureE2eApp(app);
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function resolveProductIdByBarcode(barcode: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get(`/catalog/barcode/${barcode}`)
      .expect(302);
    const loc = res.header.location as string;
    const match = /\/catalog\/product\/(\d+)/.exec(loc);
    if (!match) {
      throw new Error(`Expected product redirect for ${barcode}, got ${loc}`);
    }
    return match[1];
  }

  it('GET / should return 200 OK and render the authoritative Home Page', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .expect(200);

    expect(response.text).toContain('TrueLabel');
    expect(response.text).toContain('Every ingredient decoded');
    expect(response.text).toContain('Food Quality Formula');
    expect(response.text).toContain('Verify Manufacturer Accreditation Live');
  });

  it('GET /catalog should return 200 OK and render food catalog page', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog?q=Oatly')
      .expect(200);

    expect(response.text).toContain('Food Catalog & Transparency Discovery');
    expect(response.text).toContain('Oatly');
    expect(response.text).toContain('Barista Edition Oat Drink');
  });

  it('GET /catalog?minScore=80 and empty query params (?q=&minScore=) should apply numeric coercion and return 200 OK', async () => {
    const filtered = await request(app.getHttpServer())
      .get('/catalog?minScore=80')
      .expect(200);

    expect(filtered.text).toContain('option value="80" selected');
    expect(filtered.text).toContain('80/100');

    const emptyParams = await request(app.getHttpServer())
      .get('/catalog?q=&category=&tag=&minScore=')
      .expect(200);

    expect(emptyParams.text).toContain('Food Catalog & Transparency Discovery');
  });

  it('GET /catalog/barcode/7394376311482 should redirect to product detail page', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/barcode/7394376311482')
      .expect(302);

    expect(response.header.location).toContain('/catalog/product/');
  });

  it('GET /catalog/barcode/0000000000000 should render not-found page', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/barcode/0000000000000')
      .expect(200);

    expect(response.text).toContain('Barcode Not Found');
    expect(response.text).toContain('0000000000000');
  });

  it('GET /auth/login should render login page', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/login')
      .expect(200);

    expect(response.text).toContain('Sign In');
    expect(response.text).toContain('consumer@truelabel.demo');
  });

  it('GET /personal/profile without authentication should require login (401)', async () => {
    await request(app.getHttpServer())
      .get('/personal/profile')
      .expect(401);
  });

  it('GET /admin/rules without authentication should require login (401)', async () => {
    await request(app.getHttpServer())
      .get('/admin/rules')
      .expect(401);
  });

  it('GET /admin/scoring without authentication should require login (401)', async () => {
    await request(app.getHttpServer())
      .get('/admin/scoring')
      .expect(401);
  });

  it('GET /catalog/product/:id should render product details with F03 rule-based ingredient analysis, nutrition, F04 score breakdown & Compare actions', async () => {
    const barcodeRes = await request(app.getHttpServer())
      .get('/catalog/barcode/7394376311482')
      .expect(302);

    const productPath = barcodeRes.header.location;
    const response = await request(app.getHttpServer())
      .get(productPath)
      .expect(200);

    expect(response.text).toContain('Barista Edition Oat Drink');
    expect(response.text).toContain('Nutrition Facts');
    expect(response.text).toContain('Ingredient, additive &amp; allergen analysis');
    expect(response.text).toContain('Rule base coverage:');
    expect(response.text).toContain('Rule-verified ingredients &amp; additives');
    expect(response.text).toContain('Explainable Food Quality Score Breakdown');
    expect(response.text).toContain('Ingredient &amp; allergen transparency');
    expect(response.text).toContain('Nutrition profile');
    expect(response.text).toContain('Verification &amp; certification');
    expect(response.text).toContain('Recall &amp; safety incidents');
    expect(response.text).toContain('Community feedback');
    expect(response.text).toContain('Score history &amp; audit trail');
    expect(response.text).toContain('data-compare-toggle');
    expect(response.text).toContain('Compare in Dairy &amp; Plant Milks');
  });

  it('GET /catalog/compare should render F05 empty comparison picker with categories', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/compare')
      .expect(200);

    expect(response.text).toContain('Food Comparison Engine');
    expect(response.text).toContain('Select packaged foods to compare');
    expect(response.text).toContain('Dairy &amp; Plant Milks');
  });

  it('GET /catalog/compare?ids=<oatly>,<chobani> should render F05 side-by-side matrix with standardized bases and Not declared handling', async () => {
    const oatlyId = await resolveProductIdByBarcode('7394376311482');
    const chobaniId = await resolveProductIdByBarcode('089470001382');

    const response = await request(app.getHttpServer())
      .get(`/catalog/compare?ids=${oatlyId},${chobaniId}`)
      .expect(200);

    expect(response.text).toContain('Quality score &amp; five-pillar breakdown');
    expect(response.text).toContain('Standardized nutrition facts');
    expect(response.text).toContain('Ingredients, additives &amp; formulation differences');
    expect(response.text).toContain('Allergen comparison &amp; dietary safety');
    expect(response.text).toContain('Certifications &amp; regulatory verification');
    expect(response.text).toContain('Barista Edition Oat Drink');
    expect(response.text).toContain('Non-Fat Plain Greek Yogurt');
    expect(response.text).toContain('per 100 ml');
    expect(response.text).toContain('per 100 g');
    expect(response.text).toContain('Not declared');
  });

  it('GET /catalog/compare?ids=<oatly>,<cola> should block cross-category comparisons cleanly', async () => {
    const oatlyId = await resolveProductIdByBarcode('7394376311482');
    const colaId = await resolveProductIdByBarcode('5449000000996');

    const response = await request(app.getHttpServer())
      .get(`/catalog/compare?ids=${oatlyId},${colaId}`)
      .expect(200);

    expect(response.text).toContain('Cross-category comparison is blocked');
    expect(response.text).toContain('Dairy &amp; Plant Milks vs. Beverages');
    expect(response.text).toContain('Keep Dairy &amp; Plant Milks');
    expect(response.text).not.toContain('Standardized nutrition facts');
  });
});
