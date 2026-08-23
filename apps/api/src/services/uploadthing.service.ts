/**
 * UploadThing bilan ishlash uchun helper
 * Rasmlar frontenddan to'g'ridan-to'g'ri UploadThing'ga yuboriladi,
 * biz esa faqat URL va fileKey ni bazaga saqlaymiz.
 * Kerak bo'lganda rasmni o'chirish uchun ham shu servis ishlatiladi.
 */

import { UTApi } from 'uploadthing/server';

const UPLOADTHING_API_URL = 'https://api.uploadthing.com';

/** SDK klienti — birinchi ishlatilganda yaratiladi */
let utApi: UTApi | null = null;

function getUtApi(): UTApi | null {
  const token = (process.env.UPLOADTHING_TOKEN || '').trim();
  if (!token) return null;
  if (!utApi) utApi = new UTApi({ token });
  return utApi;
}

/**
 * API kalitini aniqlash.
 *
 * UPLOADTHING_TOKEN ikki xil ko'rinishda bo'ladi:
 *   - eski: to'g'ridan-to'g'ri `sk_live_...`
 *   - v7:   base64(JSON) — ichida { apiKey, appId, regions }
 * v6 REST API faqat `sk_live_...` ni qabul qiladi, shuning uchun kerak bo'lsa ochamiz.
 */
export function resolveUploadThingKey(): string | null {
  const raw = (process.env.UPLOADTHING_TOKEN || process.env.UPLOADTHING_SECRET || '').trim();
  if (!raw) return null;
  if (raw.startsWith('sk_')) return raw;

  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    if (typeof decoded?.apiKey === 'string' && decoded.apiKey) return decoded.apiKey;
  } catch {
    // base64 emas — xom holicha qaytaramiz, xatoni UploadThing o'zi aytadi
  }
  return raw;
}

interface DeleteFileResponse {
  success: boolean;
  deletedCount?: number;
}

/**
 * Fayl(lar)ni UploadThing'dan o'chirish
 */
export async function deleteUploadThingFiles(fileKeys: string | string[]): Promise<DeleteFileResponse> {
  const token = resolveUploadThingKey();
  if (!token) {
    console.warn('UPLOADTHING_TOKEN yo\'q, fayl o\'chirilmadi');
    return { success: false };
  }

  const keys = Array.isArray(fileKeys) ? fileKeys : [fileKeys];

  try {
    const response = await fetch(`${UPLOADTHING_API_URL}/v6/deleteFiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uploadthing-api-key': token,
      },
      body: JSON.stringify({ fileKeys: keys }),
    });

    if (!response.ok) {
      console.error('UploadThing delete xato:', await response.text());
      return { success: false };
    }

    const data = (await response.json()) as { success: boolean; deletedCount: number };
    return { success: data.success, deletedCount: data.deletedCount };
  } catch (err) {
    console.error('UploadThing delete xato:', err);
    return { success: false };
  }
}

/**
 * URL dan fileKey ajratib olish
 * Masalan: https://utfs.io/f/abc123-xyz → abc123-xyz
 */
export function extractFileKeyFromUrl(url: string): string | null {
  const match = url.match(/\/f\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Serverda tayyorlangan rasmni (Buffer) UploadThing'ga yuklash.
 * AI moslashtirilgan rasmlar shu yo'l bilan saqlanadi.
 *
 * Rasmiy v7 SDK (UTApi) ishlatiladi — eski v6 REST endpointi v7 ilovalar
 * uchun "Unsupported operation" qaytaradi.
 */
export async function uploadBufferToUploadThing(
  buffer: Buffer,
  fileName: string,
  contentType = 'image/jpeg',
): Promise<{ url: string; fileKey: string }> {
  const api = getUtApi();
  if (!api) throw new Error("UPLOADTHING_TOKEN .env da yo'q");

  // UTApi "FileEsque" kutadi: Blob + name. UTFile o'rniga oddiy Blob ishlatamiz —
  // UTFile ning tip deklaratsiyasi Node lib bilan to'g'ri kelmayapti.
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  const file = Object.assign(blob, { name: fileName });

  const result = await api.uploadFiles(file);

  if (result.error) {
    throw new Error(`UploadThing xato: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error('UploadThing javob qaytarmadi');
  }

  // 7.x da maydon nomi ufsUrl, eskiroq versiyalarda url
  const url = (result.data as any).ufsUrl || (result.data as any).url;
  return { url, fileKey: result.data.key };
}
