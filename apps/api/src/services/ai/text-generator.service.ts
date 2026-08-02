/**
 * Marketplace matn generatori
 * OpenAI birinchi ishlatadi, xato bo'lsa Gemini'ga o'tadi
 * 4 marketplace uchun optimallashtirilgan matn generatsiya qiladi
 */

import { callOpenAI } from './openai.service';
import { callGemini } from './gemini.service';

export type Marketplace = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';

export interface ProductInput {
  title: string;
  description: string;
  category: string;
  brand?: string;
  attributes?: Record<string, any>;
  basePrice: number | string;
  currency: string;
}

export interface GeneratedListing {
  marketplace: Marketplace;
  title: string;
  description: string;
  seoKeywords: string;
  suggestedPrice?: number;
}

/**
 * Marketplace uchun sistem prompt
 */
function getSystemPrompt(marketplace: Marketplace): string {
  const common =
    'Sen O\'zbekistondagi tajribali marketplace copywriter\'sisan. Ruscha va o\'zbekcha matn yozasan. Mahsulot uchun sotuvni ko\'paytiruvchi, SEO-optimal matn yaratasan. JSON formatda javob berasan.';

  const specific: Record<Marketplace, string> = {
    UZUM: `${common}
Uzum Market uchun matn yozayapsan:
- Sarlavha (title): 60-100 belgi, o'zbek/rus tilida, brend + model + asosiy xususiyat
- Tavsif (description): 300-500 so'z, aniq afzalliklar, xususiyatlar ro'yxati, kim uchun mos ekanligi
- SEO kalit so'zlar: 8-12 ta, vergul bilan ajratilgan, mahsulotga aloq
- Uzumda ko'p sotiladigan uslub — aniq, ishonchli, ehtiyoj asosli`,

    OZON: `${common}
Ozon uchun matn yozayapsan (asosan rus tilida):
- Sarlavha: 50-90 belgi, brend + model + rang/o'lcham
- Tavsif: 400-700 so'z, batafsil, xarakteristikalar bilan, sotib olish sabablarini keltir
- SEO: 10-15 ta ruscha kalit so'z
- Ozon uslubi — professional, ishonchli, texnik detallar bilan`,

    WB: `${common}
Wildberries uchun matn yozayapsan (rus tilida):
- Sarlavha: 60-100 belgi, kalit so'zlarga boy, brand'siz ham bo'lishi mumkin
- Tavsif: 500-1000 so'z, hissiy va foydali, life-style tavsifi bilan
- SEO: 15-20 ta ruscha kalit so'z (WB algoritmi kalit so'zlarga juda sezgir)
- WB uslubi — emotional, life-style, foydalanish stsenariylari`,

    YANDEX: `${common}
Yandex Market uchun matn yozayapsan (rus tilida):
- Sarlavha: 50-80 belgi, aniq va texnik, brend + model
- Tavsif: 300-600 so'z, texnik xarakteristikalarga urg'u
- SEO: 8-12 ta ruscha kalit so'z
- Yandex uslubi — texnik, aniq, taqqoslash uchun qulay`,
  };

  return specific[marketplace];
}

/**
 * Foydalanuvchi prompti (mahsulot ma'lumotlaridan)
 */
function buildUserPrompt(product: ProductInput, marketplace: Marketplace): string {
  const attrs = product.attributes
    ? Object.entries(product.attributes)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : '';

  return `Quyidagi mahsulot uchun ${marketplace} marketplace'iga mos matn yarat:

**Asl nom**: ${product.title}
**Kategoriya**: ${product.category}
${product.brand ? `**Brend**: ${product.brand}` : ''}
**Asl tavsif**: ${product.description}
**Narx**: ${product.basePrice} ${product.currency}
${attrs ? `**Xususiyatlar**:\n${attrs}` : ''}

Javobni AYNAN quyidagi JSON formatida ber (boshqa hech narsa yozma):
{
  "title": "marketplace uchun optimallashtirilgan sarlavha",
  "description": "to'liq, SEO'ga mos tavsif",
  "seoKeywords": "kalit1, kalit2, kalit3, ..."
}`;
}

/**
 * Bitta marketplace uchun matn generatsiyasi
 */
export async function generateListingText(
  product: ProductInput,
  marketplace: Marketplace,
): Promise<Omit<GeneratedListing, 'marketplace'>> {
  const systemPrompt = getSystemPrompt(marketplace);
  const userPrompt = buildUserPrompt(product, marketplace);

  let content: string;

  // 1-urinish: OpenAI
  try {
    const result = await callOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { jsonMode: true, temperature: 0.7 },
    );
    content = result.content;
  } catch (openaiErr) {
    console.warn('OpenAI xato, Gemini ga o\'tildi:', (openaiErr as Error).message);

    // 2-urinish: Gemini
    try {
      const result = await callGemini(userPrompt, {
        systemInstruction: systemPrompt,
        jsonMode: true,
        temperature: 0.7,
      });
      content = result.content;
    } catch (geminiErr) {
      throw new Error(
        `Ikkala AI ham ishlamadi. OpenAI: ${(openaiErr as Error).message}. Gemini: ${(geminiErr as Error).message}`,
      );
    }
  }

  // JSON parse
  try {
    const parsed = JSON.parse(content);
    return {
      title: parsed.title || product.title,
      description: parsed.description || product.description,
      seoKeywords: parsed.seoKeywords || '',
    };
  } catch (parseErr) {
    // Ba'zan model ```json``` bilan qaytaradi — tozalab qayta urin
    const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || product.title,
      description: parsed.description || product.description,
      seoKeywords: parsed.seoKeywords || '',
    };
  }
}

/**
 * Barcha 4 marketplace uchun parallel generatsiya
 */
export async function generateAllListings(
  product: ProductInput,
): Promise<GeneratedListing[]> {
  const marketplaces: Marketplace[] = ['UZUM', 'OZON', 'WB', 'YANDEX'];

  const results = await Promise.allSettled(
    marketplaces.map(async (mp) => {
      const gen = await generateListingText(product, mp);
      return { marketplace: mp, ...gen };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<GeneratedListing> => r.status === 'fulfilled')
    .map((r) => r.value);
}
