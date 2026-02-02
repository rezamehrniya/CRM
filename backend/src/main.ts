import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.getHttpAdapter().getInstance().use('/api/uploads', express.static(join(process.cwd(), 'uploads')));
  await app.listen(port);
  console.log(`Sakhtar CRM API listening on http://localhost:${port}`);
}

bootstrap().catch(console.error);
