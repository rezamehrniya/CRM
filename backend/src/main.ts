import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
import express from 'express';

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

  // 🔥 مهم — فعال کردن body parser صریح
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;

  const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.use('/api/uploads', express.static(join(process.cwd(), 'uploads')));

  await app.listen(port, '0.0.0.0');
  console.log(`Sakhtar CRM API listening on http://localhost:${port}`);
}

bootstrap().catch(console.error);
