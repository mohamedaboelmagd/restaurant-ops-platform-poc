import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { OpsStore } from '../domain/store';
import type { Tenant } from '../domain/types';
import { CurrentTenant, STORE, TenantGuard } from './tenant';

@Controller('api/v1')
@UseGuards(TenantGuard)
export class CatalogController {
  constructor(@Inject(STORE) private readonly store: OpsStore) {}

  @Get('me')
  me(@CurrentTenant() tenant: Tenant) {
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }

  @Get('brands')
  brands(@CurrentTenant() tenant: Tenant) {
    return this.store.listBrands(tenant.id);
  }

  @Get('locations')
  locations(@CurrentTenant() tenant: Tenant) {
    return this.store.listLocations(tenant.id);
  }

  @Get('integrations')
  integrations(@CurrentTenant() tenant: Tenant) {
    return this.store.listConnectors(tenant.id);
  }

  @Get('customers')
  customers(@CurrentTenant() tenant: Tenant) {
    return this.store.listCustomers(tenant.id);
  }
}
