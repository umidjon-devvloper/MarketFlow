/**
 * Higgsfield AI servisi
 * Rasm ustida ish: fon o'chirish, upscale, outpaint
 * Bu servis async ishlaydi — job yaratadi va status'ni tekshiradi
 */

const HIGGSFIELD_API_URL = process.env.HIGGSFIELD_API_URL || 'https://api.higgsfield.ai/v1';

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
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) {
    throw new Error('HIGGSFIELD_API_KEY .env da yo\'q');
  }

  const res = await fetch(`${HIGGSFIELD_API_URL}/images/background-remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
      output_format: 'jpg',
      background_color: '#FFFFFF', // marketplace uchun oq fon
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Higgsfield remove-bg xato: ${errText}`);
  }

  const data = (await res.json()) as any;
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
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) throw new Error('HIGGSFIELD_API_KEY yo\'q');

  const res = await fetch(`${HIGGSFIELD_API_URL}/images/upscale`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
      scale,
    }),
  });

  if (!res.ok) {
    throw new Error(`Higgsfield upscale xato: ${await res.text()}`);
  }

  const data = (await res.json()) as any;
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
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) throw new Error('HIGGSFIELD_API_KEY yo\'q');

  const res = await fetch(`${HIGGSFIELD_API_URL}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Higgsfield status xato: ${await res.text()}`);
  }

  const data = (await res.json()) as any;
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

  while (Date.now() - startTime < maxWaitMs) {
    const job = await checkJobStatus(jobId);

    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return {
    jobId,
    status: 'failed',
    error: 'Timeout: 60 sekund ichida yakunlanmadi',
  };
}
