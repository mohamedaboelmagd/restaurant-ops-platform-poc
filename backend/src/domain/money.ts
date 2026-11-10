/** Integer minor units (piastres for EGP) — no floating point in the core path. */
export function parseAmountToMinor(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value !== 'string') throw new Error('amount must be a decimal string or number');
  const raw = value.trim().replace(/,/g, '');
  const match = raw.match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`invalid amount: ${value}`);
  const sign = match[1] ? -1 : 1;
  const whole = Number(match[2]);
  const frac = (match[3] ?? '00').padEnd(2, '0');
  return sign * (whole * 100 + Number(frac));
}

export function formatMoney(minor: number, currency = 'EGP'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${currency} ${whole.toLocaleString('en-US')}.${frac}`;
}

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function hoursBetween(startIso: string, endIso: string): number {
  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms < 0) throw new Error('invalid shift window');
  return Math.round((ms / 3_600_000) * 100) / 100;
}
