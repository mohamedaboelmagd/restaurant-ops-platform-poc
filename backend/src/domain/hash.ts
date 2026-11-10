export function payloadHash(...parts: unknown[]): string {
  const raw = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('|');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
