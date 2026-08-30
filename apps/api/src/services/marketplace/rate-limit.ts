/**
 * Marketplace API'lari uchun umumiy so'rov boshqaruvi.
 *
 * Har bir marketplace o'z limitini qo'yadi (WB — daqiqasiga 1 ta statistika so'rovi,
 * Uzum — umumiy "too many requests"), lekin himoya mexanizmi bir xil:
 *   1) navbat — bir xil kalitdagi so'rovlar ketma-ket, minimal oraliq bilan;
 *   2) kesh — takroriy so'rov API'ga umuman bormaydi;
 *   3) 429 kelganda kutib qayta urinish, bo'lmasa eski keshni qaytarish.
 */

import { reserveSlot } from './rate-limit-store';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kalit bo'yicha keyingi so'rovga ruxsat etilgan vaqt */
const nextAllowedAt = new Map<string, number>();
/** Kalit bo'yicha so'rovlar zanjiri — bir vaqtda faqat bittasi ketadi */
const chains = new Map<string, Promise<unknown>>();

/** `key` navbatida, `gap` oralig'iga rioya qilib bajarish */
export function schedule<T>(key: string, gap: number, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.then(async () => {
    const wait = (nextAllowedAt.get(key) ?? 0) - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      nextAllowedAt.set(key, Date.now() + gap);
    }
  });
  // Zanjir uzilib qolmasligi uchun xatolarni yutamiz (chaqiruvchiga `run` orqali yetadi)
  chains.set(
    key,
    run.catch(() => {}),
  );
  return run;
}

/** Navbatda taxminan qancha kutishga to'g'ri kelishi */
export function pendingWaitMs(key: string): number {
  return Math.max(0, (nextAllowedAt.get(key) ?? 0) - Date.now());
}

// ─── KESH ────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  freshUntil: number;
}

const cache = new Map<string, CacheEntry>();

export function readCache<T>(key: string): { value: T; fresh: boolean } | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  return { value: hit.value as T, fresh: Date.now() < hit.freshUntil };
}

export function writeCache(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { value, freshUntil: Date.now() + ttlMs });
}

/** Kalitni xotirada saqlamaslik uchun qisqa identifikator */
export function tokenId(apiKey: string): string {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = (hash * 31 + apiKey.charCodeAt(i)) | 0;
  }
  return String(hash);
}

/** Navbat band — chaqiruvchi buni "hozircha imkoni yo'q" deb tushunadi */
export class QueueBusyError extends Error {
  readonly status = 429;
  constructor(public waitMs: number) {
    super(
      `Marketplace so'rov navbati band — ${Math.ceil(waitMs / 1000)} soniyadan keyin qayta urinib ko'ring`,
    );
    this.name = 'QueueBusyError';
  }
}

// ─── ASOSIY O'RAM ────────────────────────────────────────

export interface LimitedOptions<T> {
  /** Endpoint navbati (masalan `${token}|orders`) */
  key: string;
  /** Shu navbatdagi ikki so'rov orasidagi minimal oraliq */
  gapMs: number;
  /** Butun akkaunt bo'yicha umumiy navbat (ixtiyoriy) */
  globalKey?: string;
  globalGapMs?: number;
  /** Kesh kaliti; berilmasa keshlanmaydi */
  cacheKey?: string;
  cacheTtlMs?: number;
  /** Bundan uzoq kutish kerak bo'lsa — eski kesh qaytariladi */
  maxWaitMs?: number;
  /** 429 da nechi marta qayta urinish */
  retries?: number;
  isRateLimited: (err: unknown) => boolean;
  /** Xatodan kutish vaqtini aniqlash */
  retryAfterMs?: (err: unknown) => number;
  /** Navbat juda uzun bo'lsa va kesh ham bo'lmasa tashlanadigan xato */
  onQueueTooLong?: (waitMs: number) => Error;
  run: () => Promise<T>;
}

export async function limited<T>(opts: LimitedOptions<T>): Promise<T> {
  const {
    key,
    gapMs,
    globalKey,
    globalGapMs = 0,
    cacheKey,
    cacheTtlMs = 0,
    maxWaitMs = 12_000,
    retries = 2,
    isRateLimited,
    retryAfterMs,
    onQueueTooLong,
    run,
  } = opts;

  const cached = cacheKey ? readCache<T>(cacheKey) : undefined;
  if (cached?.fresh) return cached.value;

  const wait = Math.max(pendingWaitMs(key), globalKey ? pendingWaitMs(globalKey) : 0);
  if (wait > maxWaitMs) {
    if (cached) return cached.value;
    if (onQueueTooLong) throw onQueueTooLong(wait);
  }

  /**
   * Bazadagi umumiy cheklov — barcha nusxalar uchun bitta navbat.
   *
   * Xotiradagi `schedule` faqat shu jarayon ichida ishlaydi; serverless
   * muhitda esa har so'rov yangi jarayon, ya'ni u yerda cheklov yo'q edi.
   * Shuning uchun so'rovdan oldin bazadan "o'rin" so'raymiz.
   */
  const reserve = async () => {
    const slot = await reserveSlot(key, gapMs);
    if (slot.ok) return;

    // Qisqa kutish — shu yerda kutamiz. Uzoq bo'lsa kutib o'tirmaymiz:
    // serverless funksiyasining o'z vaqt chegarasi bor.
    if (slot.waitMs <= maxWaitMs) {
      await sleep(slot.waitMs);
      const second = await reserveSlot(key, gapMs);
      if (second.ok) return;
    }

    if (cached) throw new QueueBusyError(slot.waitMs);
    throw (onQueueTooLong?.(slot.waitMs) ?? new QueueBusyError(slot.waitMs));
  };

  const execute = async () => {
    await reserve();
    return globalKey ? schedule(globalKey, globalGapMs, run) : run();
  };

  let result: T;
  try {
    result = await schedule(key, gapMs, async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await execute();
        } catch (err) {
          lastErr = err;
          if (!isRateLimited(err) || attempt === retries) break;
          await sleep((retryAfterMs?.(err) ?? 5_000) * (attempt + 1));
        }
      }
      throw lastErr;
    });
  } catch (err) {
    // Limitga urildik — eski kesh bo'lsa shuni beramiz (yangilab keshlamaymiz)
    if (isRateLimited(err) && cached) return cached.value;
    throw err;
  }

  if (cacheKey && cacheTtlMs > 0) writeCache(cacheKey, result, cacheTtlMs);
  return result;
}
