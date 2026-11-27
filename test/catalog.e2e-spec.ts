import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureE2eApp } from './e2e-helper';

describe('Food Catalog & Ingredient Analysis (E2E Integration Test)', () => {
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

  it('GET /catalog/product/:id should render product details with F03 rule-based ingredient analysis, nutrition & F04 score breakdown', async () => {
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
  });
});
