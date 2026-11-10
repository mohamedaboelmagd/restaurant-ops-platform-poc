export function newId(prefix: string): string {
  const bytes = new Uint8Array(9);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `${prefix}_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

export function stableId(prefix: string, ...parts: string[]): string {
  const raw = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(16).padStart(8, '0')}`;
}
