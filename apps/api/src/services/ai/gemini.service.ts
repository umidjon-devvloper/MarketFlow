/**
 * Google Gemini 1.5 Flash servisi
 * OpenAI ishlamasa fallback sifatida ishlatiladi
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
      maxOutputTokens: options.maxTokens || 1500,
    },
  };

  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini xato (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokens = data.usageMetadata?.totalTokenCount || 0;

  return { content, tokens };
}
