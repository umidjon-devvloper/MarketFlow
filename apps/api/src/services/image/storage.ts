/**
 * Rasm saqlash — UploadThing bo'lsa o'sha, bo'lmasa lokal disk
 *
 * UPLOADTHING_TOKEN .env da bo'lsa rasmlar bulutga chiqadi.
 * Kalit bo'lmasa loyiha ishlab turishi uchun apps/api/uploads/ papkasiga
 * yoziladi va API o'zi /uploads/... manzilida statik tarqatadi.
 */

import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { uploadBufferToUploadThing, resolveUploadThingKey } from '../uploadthing.service';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function hasCloudStorage(): boolean {
  return Boolean(resolveUploadThingKey());
}

/** API ning tashqi manzili — lokal fayl URL'ini qurish uchun */
function publicBaseUrl(): string {
  return (
    process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
    `http://localhost:${process.env.PORT || 4000}`
  );
}

export interface StoredImage {
  url: string;
  fileKey: string;
  storage: 'uploadthing' | 'local';
}

export async function storeImage(
  buffer: Buffer,
  fileName: string,
  contentType = 'image/jpeg',
): Promise<StoredImage> {
  if (hasCloudStorage()) {
    try {
      const uploaded = await uploadBufferToUploadThing(buffer, fileName, contentType);
      return { ...uploaded, storage: 'uploadthing' };
    } catch (err) {
      // Kalit noto'g'ri yoki servis yotgan bo'lsa ham oqim to'xtamasin
      console.warn('UploadThing ishlamadi, rasm lokal saqlanadi:', (err as Error).message);
    }
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const ext = EXTENSIONS[contentType] || path.extname(fileName).replace('.', '') || 'jpg';
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
  const key = `${hash}-${randomBytes(4).toString('hex')}.${ext}`;

  await fs.writeFile(path.join(UPLOADS_DIR, key), buffer);

  return {
    url: `${publicBaseUrl()}/uploads/${key}`,
    fileKey: key,
    storage: 'local',
  };
}
