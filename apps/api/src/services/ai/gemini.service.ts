/**
 * Google Gemini servisi
 * OpenAI ishlamasa fallback sifatida ishlatiladi
 *
 * Model nomi env orqali almashtiriladi — gemini-1.5-* qatori to'xtatilgan,
 * shuning uchun default 2.5-flash.
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = () => `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent`;

export interface GeminiResponse {
  content: string;
  tokens: number;
}

export async function callGemini(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    systemInstruction?: string;
  } = {},
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY .env da yo\'q');
  }

  const body: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens || 2500,
    },
  };

  // 2.5 qatoridagi modellar javobdan OLDIN "o'ylash" tokenlarini sarflaydi va
  // ular ham maxOutputTokens ichidan yeyiladi. Natijada javob o'rtasidan
  // kesilib qolardi — JSON yarim bo'lib kelardi. Bu chaqiruvlar qisqa va
  // aniq, shuning uchun o'ylashni o'chiramiz (env orqali qaytarish mumkin).
  const thinkingBudget = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
  if (GEMINI_MODEL.includes('2.5')) {
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }

  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const res = await fetch(`${GEMINI_API_URL()}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini xato (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || '';
  const tokens = data.usageMetadata?.totalTokenCount || 0;

  // Bo'sh yoki kesilgan javobni jimgina qaytarish eng yomoni: chaqiruvchi uni
  // parse qilmoqchi bo'ladi va tushunarsiz "JSON xato" chiqadi. Sababini
  // aytamiz — shunda fallback ham, log ham foydali bo'ladi.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini javobi token chegarasiga yetdi — javob to\'liq kelmadi');
  }
  if (!content.trim()) {
    throw new Error(
      `Gemini bo'sh javob qaytardi${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}`,
    );
  }

  return { content, tokens };
}
