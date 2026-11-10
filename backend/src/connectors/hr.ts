import { parseAmountToMinor } from '../domain/money';
import { payloadHash } from '../domain/hash';
import type { CanonicalShiftDraft, NormalizeResult } from '../domain/types';
import type { Connector, HrShiftRaw } from './types';

export function hashHrShift(raw: HrShiftRaw): string {
  return payloadHash('hr', raw.shift_id, raw.site, raw.employee_code, raw.clock_in, raw.clock_out, raw.wage_per_hour);
}

export const hrConnector: Connector<HrShiftRaw, CanonicalShiftDraft> = {
  kind: 'hr',
  vendor: 'mock-hr',
  normalize(payload: HrShiftRaw): NormalizeResult<CanonicalShiftDraft> {
    const externalId = String(payload?.shift_id ?? '').trim();
    if (!externalId) return { ok: false, externalId: '', message: 'shift_id is required' };
    if (!payload.site) return { ok: false, externalId, message: 'site is required' };
    if (!payload.employee_code) return { ok: false, externalId, message: 'employee_code is required' };
    if (!payload.clock_in || !payload.clock_out) {
      return { ok: false, externalId, message: 'clock_in and clock_out are required' };
    }
    if (Number.isNaN(Date.parse(payload.clock_in)) || Number.isNaN(Date.parse(payload.clock_out))) {
      return { ok: false, externalId, message: 'clock timestamps must be ISO-8601' };
    }
    if (Date.parse(payload.clock_out) <= Date.parse(payload.clock_in)) {
      return { ok: false, externalId, message: 'clock_out must be after clock_in' };
    }
    try {
      return {
        ok: true,
        value: {
          externalId,
          locationCode: String(payload.site),
          employeeExternalId: String(payload.employee_code),
          employeeName: payload.employee_name?.trim() || `Sample employee ${payload.employee_code}`,
          role: payload.role?.trim() || 'team_member',
          startedAt: payload.clock_in,
          endedAt: payload.clock_out,
          hourlyRateMinor: parseAmountToMinor(payload.wage_per_hour),
        },
      };
    } catch (err) {
      return { ok: false, externalId, message: err instanceof Error ? err.message : 'invalid HR payload' };
    }
  },
};
