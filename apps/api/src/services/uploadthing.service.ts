/**
 * UploadThing bilan ishlash uchun helper
 * Rasmlar frontenddan to'g'ridan-to'g'ri UploadThing'ga yuboriladi,
 * biz esa faqat URL va fileKey ni bazaga saqlaymiz.
 * Kerak bo'lganda rasmni o'chirish uchun ham shu servis ishlatiladi.
 */

const UPLOADTHING_API_URL = 'https://api.uploadthing.com';

interface DeleteFileResponse {
  success: boolean;
  deletedCount?: number;
}

/**
 * Fayl(lar)ni UploadThing'dan o'chirish
 */
export async function deleteUploadThingFiles(fileKeys: string | string[]): Promise<DeleteFileResponse> {
  const token = process.env.UPLOADTHING_TOKEN;
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
