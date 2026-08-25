/**
 * remove.bg — mahsulot rasmining fonini oq qilish.
 *
 * Nega remove.bg (Higgsfield/OpenAI emas): bu MAXSUS fon o'chirish xizmati —
 * mahsulotni QAYTA CHIZMAYDI (segmentatsiya qiladi), shuning uchun matn, logo,
 * detal aynan saqlanadi. Marketplace uchun eng to'g'ri variant. Sinxron va
 * tez (~1-3s), shuning uchun so'rovni bloklab timeout bermaydi.
 *
 * Kalit: REMOVE_BG_API_KEY (.env, gitignore'да). remove.bg da ro'yxatdan o'tib
 * olinadi. Bepul tarif oyiga ~50 rasm (preview o'lcham), keyin pullik.
 */

const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';
const TIMEOUT_MS = Number(process.env.REMOVE_BG_TIMEOUT_MS) || 30_000;

export type RemoveBgResult = { ok: true; buffer: Buffer } | { ok: false; error: string };

/**
 * AI fon o'chirish yoqilganmi:
 *   AI_BG_REMOVAL="off" — majburan o'chiq
 *   AI_BG_REMOVAL="on"  — majburan yoqiq
 *   ko'rsatilmasa       — REMOVE_BG_API_KEY bor bo'lsa yoqiq
 */
export function bgRemovalEnabled(): boolean {
  const flag = (process.env.AI_BG_REMOVAL || '').toLowerCase();
  if (flag === 'off') return false;
  if (flag === 'on') return true;
  return !!process.env.REMOVE_BG_API_KEY;
}

/**
 * Rasm fonini oq qiladi. Hech qachon exception otmaydi — muvaffaqiyatsiz
 * bo'lsa { ok:false, error } qaytaradi (chaqiruvchi asl rasm bilan davom etadi).
 */
export async function removeBackgroundRemoveBg(
  image: Buffer,
  mime = 'image/png',
): Promise<RemoveBgResult> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return { ok: false, error: 'REMOVE_BG_API_KEY sozlanmagan' };

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('image_file', new Blob([new Uint8Array(image)], { type: mime }), `product.${ext}`);
  // "auto" — akkaunt ruxsat bergan eng yuqori o'lcham (kredit sarflaydi;
  // bepul tarifда preview qaytadi). Sozlash uchun REMOVE_BG_SIZE.
  form.append('size', process.env.REMOVE_BG_SIZE || 'auto');
  // Fonni oq qilamiz — marketplace talabi (shaffof emas)
  form.append('bg_color', 'ffffff');
  form.append('format', 'png');

  let res: Response;
  try {
    res = await fetch(REMOVE_BG_URL, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      ok: false,
      error: timedOut
        ? `remove.bg ${Math.round(TIMEOUT_MS / 1000)}s ichida javob bermadi`
        : `remove.bg ga ulanib bo'lmadi: ${err?.message || 'tarmoq xatosi'}`,
    };
  }

  if (!res.ok) {
    // remove.bg xatoni JSON da beradi: { errors: [{ title, code }] }
    const detail = await res.text().catch(() => '');
    let reason = detail.slice(0, 160);
    try {
      reason = JSON.parse(detail)?.errors?.[0]?.title || reason;
    } catch {
      /* JSON emas */
    }
    if (res.status === 403) reason = `API kaliti qabul qilinmadi (${reason})`;
    else if (res.status === 402) reason = `remove.bg krediti tugagan (${reason})`;
    else if (res.status === 429) reason = `remove.bg limitiga yetdingiz (${reason})`;
    return { ok: false, error: `remove.bg ${res.status}: ${reason}` };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) return { ok: false, error: 'remove.bg bo\'sh javob qaytardi' };
  return { ok: true, buffer };
}
