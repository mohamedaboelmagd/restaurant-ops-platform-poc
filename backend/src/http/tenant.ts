import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { OpsStore } from '../domain/store';
import type { Tenant } from '../domain/types';

export const STORE = 'OPS_STORE';

export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): Tenant => {
  const req = ctx.switchToHttp().getRequest<{ tenant?: Tenant }>();
  if (!req.tenant) throw new UnauthorizedException('tenant not resolved');
  return req.tenant;
});

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(STORE) private readonly store: OpsStore) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; tenant?: Tenant }>();
    const raw = req.headers['x-api-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key) throw new UnauthorizedException('x-api-key header is required');
    const tenant = this.store.findTenantByApiKey(key);
    if (!tenant) throw new UnauthorizedException('unknown api key');
    req.tenant = tenant;
    return true;
  }
}

export function assertLocation(store: OpsStore, tenantId: string, locationId?: string): void {
  if (!locationId) return;
  if (!store.resolveLocation.byId(tenantId, locationId)) {
    throw new NotFoundException('location not found');
  }
}
