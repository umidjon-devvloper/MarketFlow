/**
 * Higgsfield AI servisi
 * Rasm ustida ish: fon o'chirish, upscale, outpaint
 * Bu servis async ishlaydi — job yaratadi va status'ni tekshiradi
 */

const HIGGSFIELD_API_URL = process.env.HIGGSFIELD_API_URL || 'https://api.higgsfield.ai/v1';

/** Bitta so'rovni qancha kutamiz — Higgsfield osilib qolsa butun so'rov qotib qolmasin */
const REQUEST_TIMEOUT_MS = 20_000;

export class HiggsfieldError extends Error {
  constructor(
    message: string,
    /** HTTP kodi (tarmoq xatosida undefined) */
    public status?: number,
    /** Xizmatning o'zi ishlamayapti — foydalanuvchi aybi emas, keyinroq urinib ko'rish kerak */
    public isDown = false,
  ) {
    super(message);
    this.name = 'HiggsfieldError';
  }
}

/**
 * Xato javobidan qisqa, o'qishga yaroqli matn yasash.
 *
 * Higgsfield Cloudflare orqasida — u ishlamay qolganda JSON emas, to'liq HTML
 * xato sahifasi qaytadi. Uni o'z holicha uzatish 8 KB'lik HTML'ni ekranga
 * chiqarib yuboradi, shuning uchun bu yerda qisqartiramiz.
 */
function describeError(status: number, body: string, label: string): HiggsfieldError {
  const isHtml = /^\s*<(!doctype|html)/i.test(body);

  if (isHtml || status >= 500) {
    const title = body.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    return new HiggsfieldError(
      `Higgsfield xizmati javob bermayapti (${status}${title ? `: ${title.replace(/^.*\|\s*/, '')}` : ''}). ` +
        'Bu vaqtinchalik — birozdan keyin qayta urinib ko\'ring.',
      status,
      true,
    );
  }

  if (status === 401 || status === 403) {
    return new HiggsfieldError('Higgsfield API kaliti qabul qilinmadi — HIGGSFIELD_API_KEY ni tekshiring', status);
  }
  if (status === 429) {
    return new HiggsfieldError("Higgsfield limitiga yetdingiz — biroz kutib qayta urinib ko'ring", status);
  }

  // Haqiqiy API xatosi — JSON'dan xabarni ajratamiz, bo'lmasa qisqartiramiz
  let detail = body.trim();
  try {
    const parsed = JSON.parse(detail);
    detail = parsed?.error?.message || parsed?.message || parsed?.detail || detail;
  } catch {
    // JSON emas — o'z holicha qoladi
  }
  if (detail.length > 300) detail = `${detail.slice(0, 300)}…`;
  return new HiggsfieldError(`${label}: ${detail}`, status);
}

/** Umumiy so'rov — timeout, tarmoq xatosi va HTML javoblar bir joyda boshqariladi */
async function hfFetch(path: string, label: string, init: RequestInit = {}): Promise<any> {
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) throw new HiggsfieldError("HIGGSFIELD_API_KEY .env da yo'q");

  let res: Response;
  try {
    res = await fetch(`${HIGGSFIELD_API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new HiggsfieldError(
      timedOut
        ? `Higgsfield ${REQUEST_TIMEOUT_MS / 1000} soniyada javob bermadi — keyinroq urinib ko'ring`
        : `Higgsfield'ga ulanib bo'lmadi: ${err?.message || 'tarmoq xatosi'}`,
      undefined,
      true,
    );
  }

  if (!res.ok) throw describeError(res.status, await res.text().catch(() => ''), label);

  try {
    return await res.json();
  } catch {
    throw new HiggsfieldError(`${label}: javobni o'qib bo'lmadi (JSON emas)`, res.status, true);
  }
}

export interface HiggsfieldJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: string;
}

/**
 * Fon o'chirish so'rovi
 */
export async function removeBackground(imageUrl: string): Promise<HiggsfieldJob> {
  const data = await hfFetch('/images/background-remove', 'Fon o\'chirish xatosi', {
    method: 'POST',
    body: JSON.stringify({
      image_url: imageUrl,
      output_format: 'jpg',
      background_color: '#FFFFFF', // marketplace uchun oq fon
    }),
  });

  return {
    jobId: data.job_id || data.id,
    status: (data.status || 'pending').toLowerCase(),
    outputUrl: data.output_url,
  };
}

/**
 * Upscale (sifat oshirish)
 */
export async function upscaleImage(imageUrl: string, scale: 2 | 4 = 2): Promise<HiggsfieldJob> {
  const data = await hfFetch('/images/upscale', 'Upscale xatosi', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, scale }),
  });

  return {
    jobId: data.job_id || data.id,
    status: (data.status || 'pending').toLowerCase(),
    outputUrl: data.output_url,
  };
}

/**
 * Job holatini tekshirish
 */
export async function checkJobStatus(jobId: string): Promise<HiggsfieldJob> {
  const data = await hfFetch(`/jobs/${jobId}`, 'Job holati xatosi');

  return {
    jobId,
    status: (data.status || 'pending').toLowerCase(),
    outputUrl: data.output_url || data.result?.url,
    error: data.error,
  };
}

/**
 * Job tugaguncha kutish (polling)
 * Max 60 sekund kutadi
 */
export async function waitForJob(jobId: string, maxWaitMs = 60000): Promise<HiggsfieldJob> {
  const startTime = Date.now();
  const pollInterval = 3000;
  /** Ketma-ket nechta tekshiruv xato bo'lsa taslim bo'lamiz */
  const MAX_CONSECUTIVE_ERRORS = 3;
  let errors = 0;
  let lastError = '';

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const job = await checkJobStatus(jobId);
      errors = 0;
      if (job.status === 'completed' || job.status === 'failed') return job;
    } catch (err) {
      // Job allaqachon yuborilgan — bitta muvaffaqiyatsiz tekshiruv uni
      // bekor qilmaydi, shuning uchun bir necha marta qayta urinamiz
      lastError = (err as Error).message;
      if (++errors >= MAX_CONSECUTIVE_ERRORS) {
        return { jobId, status: 'failed', error: lastError };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return {
    jobId,
    status: 'failed',
    error: lastError || `Timeout: ${Math.round(maxWaitMs / 1000)} sekund ichida yakunlanmadi`,
  };
}
