/**
 * Rasmni marketplace talabiga moslashtirish
 *
 * Oqim:
 *   1. Rasmni yuklab olamiz
 *   2. (ixtiyoriy) OpenAI (gpt-image-1) bilan fonni oq qilamiz — kalit bo'lsa
 *   3. sharp bilan marketplace kanvasiga joylaymiz (o'lcham, nisbat, oq fon, JPEG)
 *   4. Natijani UploadThing'ga yuklab, URL qaytaramiz
 *
 * AI ishlamasa ham 3-qadam baribir bajariladi — ya'ni rasm hech
 * bo'lmaganda to'g'ri o'lcham va oq fon bilan chiqadi.
 */

import sharp from 'sharp';
import { MarketplaceSpec } from '../marketplace/specs';
import { removeBackgroundOpenAI } from './openai-bg.service';
import { storeImage } from './storage';

export interface AdaptResult {
  url: string;
  fileKey: string;
  width: number;
  height: number;
  sizeKB: number;
  steps: string[];
  warnings: string[];
  source: {
    width?: number;
    height?: number;
    format?: string;
  };
}

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rasmni yuklab bo'lmadi (${res.status})`);

  const lengthHeader = res.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > MAX_DOWNLOAD_BYTES) {
    throw new Error('Rasm juda katta (25MB dan oshdi)');
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('Rasm juda katta (25MB dan oshdi)');
  }
  return buffer;
}

/**
 * Bitta rasmni marketplace spetsifikatsiyasiga moslashtirish
 */
export async function adaptImageToSpec(
  imageUrl: string,
  spec: MarketplaceSpec,
  options: { removeBg?: boolean; fileName?: string } = {},
): Promise<AdaptResult> {
  const steps: string[] = [];
  const warnings: string[] = [];
  const { targetWidth, targetHeight, maxSizeMB } = spec.image;

  // 1. Asl rasm
  const originalBuffer = await downloadImage(imageUrl);
  const sourceMeta = await sharp(originalBuffer).metadata();
  steps.push(
    `Asl rasm o'qildi (${sourceMeta.width ?? '?'}×${sourceMeta.height ?? '?'}, ${sourceMeta.format ?? '?'})`,
  );

  if ((sourceMeta.width ?? 0) < spec.image.minWidth || (sourceMeta.height ?? 0) < spec.image.minHeight) {
    warnings.push(
      `Asl rasm ${spec.name} talabidan kichik (${sourceMeta.width}×${sourceMeta.height} < ${spec.image.minWidth}×${spec.image.minHeight}). Kattalashtirildi — sifat biroz pasayishi mumkin.`,
    );
  }

  // 2. AI fon — standart O'CHIQ. gpt-image-1 sekin (~20-60s) va OpenAI
  // tashkilot tasdig'ini talab qiladi, shuning uchun avtomatik ishlamaydi.
  // Yoqish: .env da AI_BG_REMOVAL="on", yoki so'rovda removeBg=true.
  let bodyBuffer = originalBuffer;
  const removeBg = options.removeBg ?? process.env.AI_BG_REMOVAL === 'on';
  if (removeBg) {
    const result = await removeBackgroundOpenAI(
      originalBuffer,
      sourceMeta.format ? `image/${sourceMeta.format}` : 'image/png',
    );
    if (result.ok) {
      bodyBuffer = result.buffer;
      steps.push('AI fonni oq fonga almashtirdi (OpenAI gpt-image-1)');
    } else {
      // Aniq sabab bilan — "javob bermadi" o'rniga (timeout / 403 / kalit yo'q)
      warnings.push(`AI fon o'chirish ishlamadi: ${result.error} — rasm faqat o'lchamga moslandi`);
    }
  }

  // 3. Kanvasga joylash: mahsulot to'liq sig'adi, atrofi oq
  let output = await sharp(bodyBuffer)
    .flatten({ background: '#FFFFFF' }) // shaffof PNG → oq
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'contain',
      background: '#FFFFFF',
      withoutEnlargement: false,
    })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();

  steps.push(
    `${targetWidth}×${targetHeight} (${spec.image.aspectRatio}) oq kanvasga joylandi, JPEG sifat 92`,
  );

  // 4. Hajm chegarasi
  const limitBytes = maxSizeMB * 1024 * 1024;
  let quality = 92;
  while (output.byteLength > limitBytes && quality > 55) {
    quality -= 12;
    output = await sharp(bodyBuffer)
      .flatten({ background: '#FFFFFF' })
      .resize({ width: targetWidth, height: targetHeight, fit: 'contain', background: '#FFFFFF' })
      .jpeg({ quality })
      .toBuffer();
    steps.push(`Hajm ${maxSizeMB}MB dan oshgani uchun sifat ${quality} ga tushirildi`);
  }

  // 5. Saqlash
  const fileName = options.fileName || `${spec.id.toLowerCase()}-${targetWidth}x${targetHeight}.jpg`;
  const uploaded = await storeImage(output, fileName, 'image/jpeg');
  steps.push('Moslashtirilgan rasm saqlandi');

  return {
    url: uploaded.url,
    fileKey: uploaded.fileKey,
    width: targetWidth,
    height: targetHeight,
    sizeKB: Math.round(output.byteLength / 1024),
    steps,
    warnings,
    source: {
      width: sourceMeta.width,
      height: sourceMeta.height,
      format: sourceMeta.format,
    },
  };
}
