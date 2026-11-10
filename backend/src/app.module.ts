import { Module } from '@nestjs/common';
import { createDemoStore } from './domain/seed';
import { AskController } from './http/ask.controller';
import { CatalogController } from './http/catalog.controller';
import { IngestController } from './http/ingest.controller';
import { InsightsController } from './http/insights.controller';
import { STORE, TenantGuard } from './http/tenant';

@Module({
  controllers: [CatalogController, IngestController, InsightsController, AskController],
  providers: [
    { provide: STORE, useValue: createDemoStore() },
    TenantGuard,
  ],
})
export class AppModule {}
