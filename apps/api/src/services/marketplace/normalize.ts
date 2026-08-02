/**
 * Marketplace javoblarini yagona formatga keltirish uchun yordamchilar.
 *
 * Har bir marketplace API'si turlicha javob qaytaradi (ba'zilari hujjatlashtirilmagan
 * yoki o'zgarib turadi) — shuning uchun maydonlarni "nomzod kalitlar" ro'yxati
 * bo'yicha ehtiyotkorona qidiramiz, topilmasa yiqilmaymiz.
 */

/** Obyekt ichidan birinchi massivni topish (kerakli kalitlarga ustunlik beriladi) */
export function firstArray(obj: unknown, preferredKeys: string[] = [], depth = 3): any[] {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== 'object' || depth <= 0) return [];

  const record = obj as Record<string, unknown>;

  for (const key of preferredKeys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  for (const key of preferredKeys) {
    const nested = firstArray(record[key], preferredKeys, depth - 1);
    if (nested.length) return nested;
  }
  for (const value of Object.values(record)) {
    if (Array.isArray(value) && value.length && typeof value[0] === 'object') return value;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const nested = firstArray(value, preferredKeys, depth - 1);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function pickString(obj: any, keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

export function pickNumber(obj: any, keys: string[]): number | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

/** Epoch (ms yoki s) yoki ISO satrni ISO sanaga o'girish */
export function pickDate(obj: any, keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && value > 0) {
      const ms = value > 1e12 ? value : value * 1000;
      return new Date(ms).toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return undefined;
}

export function pickTotal(obj: unknown, keys: string[]): number | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  return pickNumber(obj, keys);
}
