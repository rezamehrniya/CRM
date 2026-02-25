import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';

@Module({})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes(
        { path: 't*', method: RequestMethod.ALL },
        { path: 'api/t*', method: RequestMethod.ALL },
      );
  }
}
