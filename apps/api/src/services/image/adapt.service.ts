/**
 * Rasmni marketplace talabiga moslashtirish
 *
 * Oqim:
 *   1. Rasmni yuklab olamiz
 *   2. Fonni oq qilamiz: avval remove.bg (aniq qirqadi), u yo'q bo'lsa
 *      OpenAI gpt-image-1 (rasmni qayta chizadi — ogohlantirish bilan)
 *   3. Ortiqcha oq chekkalarni kesib, bir xil hoshiya bilan markazga qo'yamiz
 *   4. sharp bilan marketplace kanvasiga joylaymiz (o'lcham, nisbat, oq fon, JPEG)
 *   5. Natijani UploadThing'ga yuklab, URL qaytaramiz
 *
 * AI ishlamasa ham qolgan qadamlar bajariladi — rasm hech bo'lmaganda
 * to'g'ri o'lcham, bir xil hoshiya va oq fon bilan chiqadi.
 */

import sharp from 'sharp';
import { MarketplaceSpec } from '../marketplace/specs';
import { removeBackgroundRemoveBg, bgRemovalEnabled } from './remove-bg.service';
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

/**
 * Kanvasdagi hoshiya — mahsulot chekkaga yopishib turmasin.
 * Barcha kartochkalar bir xil nafas oladi, ro'yxatda tekis ko'rinadi.
 */
const MARGIN_RATIO = 0.04;

/**
 * remove.bg sozlanmagan bo'lsa OpenAI bilan urinib ko'rilsinmi.
 *
 * Sukut bo'yicha — ha, agar OPENAI_API_KEY bor bo'lsa: aks holda sotuvchi
 * "AI moslashtirish" tugmasini bosib, faqat o'lcham o'zgarganini ko'radi.
 * AI_BG_FALLBACK=off bilan o'chiriladi (masalan sekinligi uchun).
 */
function aiBgFallbackEnabled(): boolean {
  const flag = (process.env.AI_BG_FALLBACK || '').toLowerCase();
  if (flag === 'off') return false;
  if (flag === 'on') return true;
  return !!process.env.OPENAI_API_KEY;
}

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

  // 2. Fon o'chirish — remove.bg (maxsus xizmat, mahsulotni saqlaydi, tez).
  // REMOVE_BG_API_KEY bo'lsa avtomatik yoqiladi (AI_BG_REMOVAL bilan majburlash mumkin).
  let bodyBuffer = originalBuffer;
  let bgApplied = false;
  const sourceMime = sourceMeta.format ? `image/${sourceMeta.format}` : 'image/png';
  const removeBg = options.removeBg ?? bgRemovalEnabled();

  if (removeBg) {
    const result = await removeBackgroundRemoveBg(originalBuffer, sourceMime);
    if (result.ok) {
      bodyBuffer = result.buffer;
      bgApplied = true;
      steps.push('Fonni oq fonga almashtirdi (remove.bg)');
    } else {
      // Aniq sabab bilan (kalit yo'q / kredit tugagan / timeout)
      warnings.push(`remove.bg ishlamadi: ${result.error}`);
    }
  }

  // 2b. remove.bg yo'q yoki ishlamadi — OpenAI bilan urinamiz.
  // Bu qirqish emas, rasmni QAYTA CHIZADI: fon toza chiqadi, lekin mayda
  // detal o'zgarishi mumkin. Shuning uchun natijani tekshirishni so'raymiz.
  if (!bgApplied && aiBgFallbackEnabled()) {
    const ai = await removeBackgroundOpenAI(originalBuffer, sourceMime);
    if (ai.ok) {
      bodyBuffer = ai.buffer;
      bgApplied = true;
      steps.push('Fonni AI oq qildi (OpenAI gpt-image-1)');
      warnings.push(
        "Fon AI bilan qayta chizildi — mahsulot detallari (matn, logo, tikuv) o'zgarmaganini tekshiring",
      );
    } else {
      warnings.push(`AI bilan fon oqartirish ishlamadi: ${ai.error}`);
    }
  }

  if (!bgApplied) {
    warnings.push("Fon o'zgartirilmadi — rasm faqat o'lchamga moslandi");
  }

  // 3. Kadr: mahsulot atrofidagi ortiqcha oq joyni kesamiz.
  // Fon oq bo'lganda ishlaydi; rangli fonli suratga tegmaydi (trim faqat
  // ko'rsatilgan rangdagi chekkani oladi), ya'ni mahsulot kesilib qolmaydi.
  let framed = bodyBuffer;
  try {
    framed = await sharp(bodyBuffer)
      .flatten({ background: '#FFFFFF' })
      .trim({ background: '#FFFFFF', threshold: 12 })
      .toBuffer();
    const before = sourceMeta.width ?? 0;
    const after = (await sharp(framed).metadata()).width ?? 0;
    if (after && before && after < before) steps.push("Ortiqcha oq chekkalar kesildi");
  } catch {
    // Kesib bo'lmadi (masalan butun rasm bir xil rangda) — asl rasm qoladi
    framed = bodyBuffer;
  }

  // 4. Kanvasga joylash: bir xil hoshiya bilan markazda
  const margin = Math.round(Math.min(targetWidth, targetHeight) * MARGIN_RATIO);
  const render = async (quality: number): Promise<Buffer> => {
    const inner = await sharp(framed)
      .flatten({ background: '#FFFFFF' }) // shaffof PNG → oq
      .resize({
        width: targetWidth - margin * 2,
        height: targetHeight - margin * 2,
        fit: 'contain',
        background: '#FFFFFF',
        withoutEnlargement: false,
      })
      .toBuffer();

    return sharp(inner)
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: '#FFFFFF' })
      .jpeg({ quality, chromaSubsampling: '4:4:4' })
      .toBuffer();
  };

  let output = await render(92);

  steps.push(
    `${targetWidth}×${targetHeight} (${spec.image.aspectRatio}) oq kanvasga joylandi, JPEG sifat 92`,
  );

  // 5. Hajm chegarasi
  const limitBytes = maxSizeMB * 1024 * 1024;
  let quality = 92;
  while (output.byteLength > limitBytes && quality > 55) {
    quality -= 12;
    output = await render(quality);
    steps.push(`Hajm ${maxSizeMB}MB dan oshgani uchun sifat ${quality} ga tushirildi`);
  }

  // 6. Saqlash
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
