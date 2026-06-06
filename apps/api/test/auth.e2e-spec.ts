import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const email = `test-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  let accessToken: string;
  let refreshToken: string;

  describe('POST /api/v1/auth/register', () => {
    it('inscrit un nouvel utilisateur', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201)
        .then((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it('retourne 409 si l\'email est déjà pris', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('connecte avec les bons credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200)
        .then((res) => {
          expect(res.body.accessToken).toBeDefined();
        });
    });

    it('retourne 401 avec un mauvais mot de passe', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('GET /api/v1/account/me', () => {
    it('retourne le profil avec un token valide', () => {
      return request(app.getHttpServer())
        .get('/api/v1/account/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.email).toBe(email);
          expect(res.body.role).toBe('user');
        });
    });

    it('retourne 401 sans token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/account/me')
        .expect(401);
    });
  });

  describe('GET /api/v1/billing/products', () => {
    it('retourne la liste des produits publiquement', () => {
      return request(app.getHttpServer())
        .get('/api/v1/billing/products')
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveLength(4);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('priceEur');
        });
    });
  });

  describe('POST /api/v1/keys', () => {
    it('crée une clé API et retourne le raw', () => {
      return request(app.getHttpServer())
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ label: 'Test device' })
        .expect(201)
        .then((res) => {
          expect(res.body.key).toMatch(/^sb_/);
          expect(res.body.label).toBe('Test device');
        });
    });
  });
});
