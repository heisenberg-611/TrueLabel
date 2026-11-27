// Feature F06: Food safety documents & licence verification (E2E Integration Test)
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureE2eApp } from './e2e-helper';

describe('Food Safety & Licences (E2E Integration Test - F06)', () => {
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

  it('GET /safety/documents should return 200 OK and render documents registry', async () => {
    const response = await request(app.getHttpServer())
      .get('/safety/documents')
      .expect(200);

    expect(response.text).toContain('Safety Documents & Verified Accreditations');
    expect(response.text).toContain('Official Food Safety Registry');
  });

  it('GET /safety/documents/upload without authentication should require login (401)', async () => {
    await request(app.getHttpServer())
      .get('/safety/documents/upload')
      .expect(401);
  });

  it('GET /safety/licence/verify should return 200 OK and render verification page', async () => {
    const response = await request(app.getHttpServer())
      .get('/safety/licence/verify')
      .expect(200);

    expect(response.text).toContain('Manufacturer Licence Verification');
    expect(response.text).toContain('Verify Credential');
  });

  it('GET /safety/licence/verify?licenceNumber=BSTI-FOOD-2024-001 should verify valid licence', async () => {
    const response = await request(app.getHttpServer())
      .get('/safety/licence/verify?licenceNumber=BSTI-FOOD-2024-001')
      .expect(200);

    expect(response.text).toContain('Verified Active & In Good Standing');
    expect(response.text).toContain('OatLand Organics Ltd.');
    expect(response.text).toContain('Bangladesh Standards and Testing Institution');
  });
});
