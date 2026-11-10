import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { verifyWebhookSignature } from '../connectors/webhook';
import { ingestByKind } from '../domain/ingest';
import { createDemoStore } from '../domain/seed';
import type { OpsStore } from '../domain/store';
import type { ConnectorKind, Tenant } from '../domain/types';
import { MemoryStore } from '../domain/memory-store';
import { CurrentTenant, STORE, TenantGuard } from './tenant';

const KINDS: ConnectorKind[] = ['pos', 'hr', 'loyalty'];

@Controller('api/v1')
@UseGuards(TenantGuard)
export class IngestController {
  constructor(@Inject(STORE) private readonly store: OpsStore) {}

  @Post('integrations/:kind/events')
  ingest(
    @CurrentTenant() tenant: Tenant,
    @Param('kind') kind: string,
    @Body() body: unknown,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    if (!KINDS.includes(kind as ConnectorKind)) {
      throw new BadRequestException('kind must be pos, hr or loyalty');
    }
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const sig = Array.isArray(signature) ? signature[0] : signature;
    const ts = Array.isArray(timestamp) ? timestamp[0] : timestamp;
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    if (!verifyWebhookSignature(raw, sig, tenant.webhookSecret, ts)) {
      throw new UnauthorizedException('invalid webhook signature');
    }
    const events = Array.isArray(body) ? body : Array.isArray((body as { events?: unknown[] })?.events) ? (body as { events: unknown[] }).events : [body];
    return ingestByKind(this.store, tenant.id, kind as ConnectorKind, events);
  }

  @Post('demo/reset')
  reset(@CurrentTenant() tenant: Tenant) {
    if (process.env.DEMO_MODE === 'false') {
      throw new BadRequestException('demo reset is disabled');
    }
    if (this.store instanceof MemoryStore) {
      const fresh = createDemoStore().getSnapshot(tenant.id);
      if (fresh) this.store.load(fresh);
    }
    return { reset: true, tenantId: tenant.id };
  }
}
