import { Body, Controller, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { computeInsights } from '../domain/insights';
import type { OpsStore } from '../domain/store';
import type { Tenant } from '../domain/types';
import { createAskAssistant } from './ask-factory';
import { CurrentTenant, STORE, TenantGuard, assertLocation } from './tenant';

@Controller('api/v1')
@UseGuards(TenantGuard)
export class AskController {
  private readonly assistant = createAskAssistant();

  constructor(@Inject(STORE) private readonly store: OpsStore) {}

  @Post('insights/ask')
  async ask(
    @CurrentTenant() tenant: Tenant,
    @Body() body: { question?: string },
    @Query('locationId') locationId?: string,
  ) {
    assertLocation(this.store, tenant.id, locationId);
    const snapshot = this.store.getSnapshot(tenant.id)!;
    const insights = computeInsights(snapshot, locationId);
    return this.assistant.answer(body?.question ?? '', insights);
  }
}
