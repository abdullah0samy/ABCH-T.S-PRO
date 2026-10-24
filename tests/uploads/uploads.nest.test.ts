import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../backend/src/prisma/prisma.module';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { UploadsModule } from '../../backend/src/modules/uploads/uploads.module';
import jwt from 'jsonwebtoken';
import type { INestApplication } from '@nestjs/common';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
const userToken = jwt.sign({ id: 1, role: 'end_user', departmentId: 1 }, ACCESS_SECRET, { expiresIn: '1h' });

describe('NestJS Uploads API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'upload', ttl: 3600000, limit: 100 }]),
        PrismaModule,
        UploadsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('POST /api/uploads returns 401 without token', async () => {
    const res = await request(app.getHttpServer()).post('/api/uploads');
    expect(res.status).toBe(401);
  });

  it('POST /api/uploads returns 400 when no file is provided', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(400);
  });

  it('POST /api/uploads validates PNG magic bytes and returns 201', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const res = await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', pngBuffer, { filename: 'test.png', contentType: 'image/png' });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('fileUrl');
    expect(res.body.fileName).toBe('test.png');
  });

  it('POST /api/uploads rejects spoofed MIME types with 422', async () => {
    const fakePng = Buffer.from('not-a-real-png-header');
    const res = await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', fakePng, { filename: 'spoof.png', contentType: 'image/png' });
    expect(res.status).toBe(422);
  });
});
