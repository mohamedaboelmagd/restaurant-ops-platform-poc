import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { computeInsights } from '../domain/insights';
import type { OpsStore } from '../domain/store';
import type { Tenant } from '../domain/types';
import { CurrentTenant, STORE, TenantGuard, assertLocation } from './tenant';

@Controller('api/v1')
@UseGuards(TenantGuard)
export class InsightsController {
  constructor(@Inject(STORE) private readonly store: OpsStore) {}

  private snapshotInsights(tenant: Tenant, locationId?: string) {
    assertLocation(this.store, tenant.id, locationId);
    const snapshot = this.store.getSnapshot(tenant.id);
    if (!snapshot) throw new Error('tenant not found');
    return computeInsights(snapshot, locationId);
  }

  @Get('insights')
  insights(@CurrentTenant() tenant: Tenant, @Query('locationId') locationId?: string) {
    return this.snapshotInsights(tenant, locationId);
  }

  @Get('anomalies')
  anomalies(@CurrentTenant() tenant: Tenant, @Query('locationId') locationId?: string) {
    return this.snapshotInsights(tenant, locationId).anomalies;
  }
}
