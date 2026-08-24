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
 * shuning uchun:
 *   - asl rasm hech qachon o'chirilmaydi (adapt.service moslashtirilgan
 *     variantni alohida saqlaydi),
 *   - ishlamasa oddiy o'lcham-moslash bilan davom etadi (rasm yo'qolmaydi).
 */

const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const MODEL = 'gpt-image-1';
/** gpt-image-1 sekin — 30-60s odatiy, shuning uchun keng timeout */
const TIMEOUT_MS = 90_000;

const PROMPT =
  'Place this exact product on a pure white (#FFFFFF) seamless studio background. ' +
  'Keep the product 100% identical — same shape, colors, text, logos, proportions and every ' +
  'small detail. Only replace the background with solid white. Do not add drop shadows, ' +
  'reflections, props, or any new elements, and do not crop or remove any part of the product.';

/**
 * Rasm fonini oq qiladi. Muvaffaqiyatsiz bo'lsa null (chaqiruvchi asl rasm
 * bilan davom etadi) — hech qachon exception otmaydi.
 */
export async function removeBackgroundOpenAI(
  image: Buffer,
  mime = 'image/png',
): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

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
    console.warn("OpenAI fon o'chirish ulanmadi:", err?.message);
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn(`OpenAI fon o'chirish xato (${res.status}):`, detail.slice(0, 200));
    return null;
  }

  const data: any = await res.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return null;
  return Buffer.from(b64, 'base64');
}
