import { hrConnector } from '../src/connectors/hr';
import { loyaltyConnector } from '../src/connectors/loyalty';
import { posConnector } from '../src/connectors/pos';
import { parseAmountToMinor } from '../src/domain/money';

describe('POS connector', () => {
  it('maps a vendor ticket into the canonical order model', () => {
    const result = posConnector.normalize({
      ticket_id: 'T-100',
      store_code: 'NSK-NC',
      opened_at: '2026-10-28T16:00:00.000Z',
      closed_at: '2026-10-28T16:45:00.000Z',
      guests: 3,
      service: 'Dine-In',
      items: [
        { sku: 'NSK-PST', item_name: 'Truffle mushroom pasta', qty: 2, unit_price: '295.00', category: 'mains' },
        { item_name: 'Sparkling citrus', qty: 1, unit_price: 45, category: 'beverages' },
      ],
      totals: { subtotal: '635.00', tax: '88.90', discount: '0.00', grand: '723.90' },
      currency: 'EGP',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.externalId).toBe('T-100');
    expect(result.value.channel).toBe('dine_in');
    expect(result.value.totalMinor).toBe(72390);
    expect(result.value.items).toHaveLength(2);
    expect(result.value.items[0].totalMinor).toBe(59000);
    expect(result.value.items[1].sku).toBe('sku-2');
    expect(result.value.status).toBe('closed');
  });

  it('rejects tickets without a store or items', () => {
    expect(posConnector.normalize({ ticket_id: 'T-1', store_code: '', closed_at: '2026-10-28T16:00:00.000Z', items: [] }).ok).toBe(false);
    expect(posConnector.normalize({ ticket_id: 'T-1', store_code: 'NSK-NC', closed_at: '2026-10-28T16:00:00.000Z', items: [] }).ok).toBe(false);
  });

  it('marks voided tickets without dropping them', () => {
    const result = posConnector.normalize({
      ticket_id: 'T-void',
      store_code: 'NSK-MD',
      closed_at: '2026-10-28T16:00:00.000Z',
      items: [{ item_name: 'Soup', qty: 1, unit_price: '95.00' }],
      voided: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('voided');
  });
});

describe('HR connector', () => {
  it('maps a timesheet row into a labor shift draft', () => {
    const result = hrConnector.normalize({
      shift_id: 'S-1',
      site: 'NSK-MD',
      employee_code: 'E-9',
      employee_name: 'Nour El-Sayed (sample)',
      role: 'server',
      clock_in: '2026-10-28T11:00:00.000Z',
      clock_out: '2026-10-28T16:00:00.000Z',
      wage_per_hour: '48.50',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hourlyRateMinor).toBe(4850);
    expect(result.value.locationCode).toBe('NSK-MD');
  });

  it('rejects inverted punch times', () => {
    const result = hrConnector.normalize({
      shift_id: 'S-bad',
      site: 'NSK-MD',
      employee_code: 'E-9',
      role: 'cook',
      clock_in: '2026-10-28T16:00:00.000Z',
      clock_out: '2026-10-28T11:00:00.000Z',
      wage_per_hour: 40,
    });
    expect(result.ok).toBe(false);
  });
});

describe('Loyalty connector', () => {
  it('accepts vendor synonyms for earn/redeem', () => {
    const earn = loyaltyConnector.normalize({
      event_id: 'L-1',
      store: 'NSE-DT',
      member_id: 'M1',
      event: 'accrual',
      pts: 20,
      ts: '2026-10-28T12:00:00.000Z',
    });
    const redeem = loyaltyConnector.normalize({
      event_id: 'L-2',
      store: 'NSE-DT',
      member_id: 'M1',
      event: 'burn',
      pts: 50,
      ts: '2026-10-28T12:05:00.000Z',
    });
    expect(earn.ok && earn.value.type).toBe('earn');
    expect(redeem.ok && redeem.value.type).toBe('redeem');
  });

  it('rejects unknown event types', () => {
    const result = loyaltyConnector.normalize({
      event_id: 'L-3',
      store: 'NSE-DT',
      member_id: 'M1',
      event: 'bonus-mystery',
      pts: 10,
      ts: '2026-10-28T12:00:00.000Z',
    });
    expect(result.ok).toBe(false);
  });
});

describe('money', () => {
  it('parses decimal strings without floating point', () => {
    expect(parseAmountToMinor('12.50')).toBe(1250);
    expect(parseAmountToMinor('12')).toBe(1200);
    expect(parseAmountToMinor(12.5)).toBe(1250);
  });
});
