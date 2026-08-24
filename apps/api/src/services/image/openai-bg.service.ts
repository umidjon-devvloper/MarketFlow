/**
 * OpenAI (gpt-image-1) bilan rasm fonini oq qilish.
 *
 * Nega bu — Higgsfield API o'lik (api.higgsfield.ai → Cloudflare 521), shuning
 * uchun kartochka AI'sida allaqachon ishlatilayotgan OpenAI kaliti qayta
 * ishlatiladi (qo'shimcha xizmat/kalit kerak emas).
 *
 * MUHIM CHEKLOV: bu segmentatsiya (aniq qirqib olish) EMAS — gpt-image-1 rasmni
 * QAYTA CHIZADI. Natija ozoda oq fon beradi, lekin mahsulotni biroz
 * o'zgartirishi mumkin (matn, logo, mayda detal). Marketplace uchun bu xavf,
 * shuning uchun asl rasm hech qachon o'chirilmaydi.
 *
 * SEKINLIK: gpt-image-1 bitta rasmni ~20-60s ishlaydi. Bu so'rovni bloklaydi;
 * ba'zi hostinglar (serverless, proksi) so'rovni 30-60s da uzib qo'yishi
 * mumkin — shunda "javob bermadi" chiqadi. Xato SABABINI aniq qaytaramiz,
 * toki foydalanuvchi (timeout / 403 / kalit yo'q) farqini ko'ra olsin.
 */

const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const MODEL = 'gpt-image-1';
/** gpt-image-1 sekin — 30-60s odatiy, shuning uchun keng timeout */
const TIMEOUT_MS = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS) || 90_000;

const PROMPT =
  'Place this exact product on a pure white (#FFFFFF) seamless studio background. ' +
  'Keep the product 100% identical — same shape, colors, text, logos, proportions and every ' +
  'small detail. Only replace the background with solid white. Do not add drop shadows, ' +
  'reflections, props, or any new elements, and do not crop or remove any part of the product.';

export type RemoveBgResult = { ok: true; buffer: Buffer } | { ok: false; error: string };

/**
 * Rasm fonini oq qiladi. Hech qachon exception otmaydi — muvaffaqiyatsiz
 * bo'lsa { ok:false, error } qaytaradi (chaqiruvchi asl rasm bilan davom etadi).
 */
export async function removeBackgroundOpenAI(
  image: Buffer,
  mime = 'image/png',
): Promise<RemoveBgResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY sozlanmagan" };

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', PROMPT);
  // "auto" — asl nisbatni saqlashga harakat qiladi; yakuniy o'lcham baribir
  // adapt.service da marketplace kanvasiga moslanadi
  form.append('size', 'auto');
  form.append('quality', process.env.OPENAI_IMAGE_QUALITY || 'medium');
  form.append('n', '1');
  form.append('image', new Blob([new Uint8Array(image)], { type: mime }), `product.${ext}`);

  let res: Response;
  try {
    res = await fetch(OPENAI_IMAGE_EDIT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      ok: false,
      error: timedOut
        ? `OpenAI ${Math.round(TIMEOUT_MS / 1000)}s ichida javob bermadi (rasm katta yoki model band)`
        : `OpenAI'ga ulanib bo'lmadi: ${err?.message || 'tarmoq xatosi'}`,
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let reason = detail.slice(0, 160);
    try {
      reason = JSON.parse(detail)?.error?.message || reason;
    } catch {
      /* JSON emas — o'z holicha */
    }
    // Ko'p uchraydigan sabablarni aniq ataймиз
    if (res.status === 403) {
      reason = `tashkilotingiz gpt-image-1 uchun tasdiqlanmagan bo'lishi mumkin (${reason})`;
    } else if (res.status === 429) {
      reason = `OpenAI limitiga yetdingiz (${reason})`;
    }
    return { ok: false, error: `OpenAI ${res.status}: ${reason}` };
  }

  const data: any = await res.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: 'OpenAI natija rasmini qaytarmadi' };
  return { ok: true, buffer: Buffer.from(b64, 'base64') };
}
