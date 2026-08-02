/**
 * AI savdo maslahatchisi.
 *
 * Marketplace analitikasini (insights.service) olib, sotuvchiga tushunarli
 * xulosa va aniq qadamlar beradi: nima yaxshi ketyapti, nima yomon,
 * savdoni oshirish uchun nima qilish kerak.
 *
 * OpenAI birinchi, xato bo'lsa Gemini'ga o'tadi (loyihadagi umumiy qoida).
 */

import { callOpenAI } from './openai.service';
import { callGemini } from './gemini.service';
import type { MarketplaceInsights } from '../marketplace/insights.service';

const MP_LABELS: Record<string, string> = {
  UZUM: 'Uzum Market',
  OZON: 'Ozon',
  WB: 'Wildberries',
  YANDEX: 'Yandex Market',
};

export interface AdviceItem {
  title: string;
  detail: string;
  /** high | medium | low — nimadan boshlash kerakligini ko'rsatadi */
  priority: 'high' | 'medium' | 'low';
}

export interface SalesAdvice {
  summary: string;
  bestSellers: string;
  problems: string[];
  recommendations: AdviceItem[];
}

const SYSTEM_PROMPT = `Sen O'zbekistondagi marketplace sotuvchilariga yordam beradigan tajribali e-commerce analitiksan.
Senga bitta marketplace bo'yicha real savdo statistikasi beriladi. Sen:
- faqat berilgan raqamlarga tayanasan, hech narsa o'ylab topmaysan;
- javobni SODDA o'zbek tilida yozasan, sotuvchi tushunadigan qilib;
- tavsiyalar aniq va bajarib bo'ladigan bo'lsin ("narxni 5-10% tushiring", "qoldiqni to'ldiring" kabi), umumiy gap bo'lmasin;
- agar ma'lumot yetarli bo'lmasa, buni ochiq aytasan va nimani yoqish kerakligini tushuntirasan.
Javobni faqat JSON formatida berasan.`;

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ${currency}`;
}

function buildUserPrompt(insights: MarketplaceInsights): string {
  const mp = MP_LABELS[insights.marketplace] || insights.marketplace;
  const t = insights.totals;

  const top = insights.topProducts.length
    ? insights.topProducts
        .map(
          (p, i) =>
            `${i + 1}. ${p.name || p.sku || "noma'lum"} (SKU: ${p.sku || '—'}) — ${p.qty} dona, ${money(p.revenue, insights.currency)}, daromadning ${p.share}%`,
        )
        .join('\n')
    : "Ma'lumot yo'q";

  const slow = insights.slowMovers.length
    ? insights.slowMovers.map((p) => `- ${p.name || p.sku} — atigi ${p.qty} dona`).join('\n')
    : "Ma'lumot yo'q";

  const out = insights.outOfStock.length
    ? insights.outOfStock.slice(0, 10).map((s) => `- ${s.name || s.sku}`).join('\n')
    : 'Yo\'q';

  const low = insights.lowStock.length
    ? insights.lowStock.slice(0, 10).map((s) => `- ${s.name || s.sku}: ${s.amount} dona qoldi`).join('\n')
    : 'Yo\'q';

  const trend = (v: number | null) => (v === null ? "taqqoslash uchun ma'lumot yo'q" : `${v > 0 ? '+' : ''}${v}%`);

  return `Marketplace: ${mp}
Davr: so'nggi ${insights.periodDays} kun
Valyuta: ${insights.currency}

UMUMIY:
- Buyurtmalar: ${t.orders} ta (oldingi davrga nisbatan ${trend(insights.trend.ordersPct)})
- Daromad: ${money(t.revenue, insights.currency)} (${trend(insights.trend.revenuePct)})
- O'rtacha chek: ${money(t.avgOrder, insights.currency)}
- Bekor qilingan: ${t.cancelled} ta
- Sotilgan dona: ${t.itemsSold}
- Katalogdagi mahsulotlar: ${insights.productsTotal ?? "noma'lum"}

ENG KO'P SOTILGANLAR:
${top}

ENG KAM SOTILGANLAR:
${slow}

QOLDIQ TUGAGAN:
${out}

QOLDIQ KAM (5 donadan kam):
${low}

${insights.warnings.length ? `DIQQAT (ma'lumotdagi kamchiliklar):\n${insights.warnings.map((w) => `- ${w}`).join('\n')}` : ''}

Javobni AYNAN quyidagi JSON formatida ber (boshqa hech narsa yozma):
{
  "summary": "2-3 gapda umumiy holat: savdo qanday ketyapti, o'sish bormi",
  "bestSellers": "nima ko'p ketayotgani va nega shunday bo'lishi mumkinligi, 2-3 gap",
  "problems": ["aniqlangan muammo 1", "muammo 2", "muammo 3"],
  "recommendations": [
    {"title": "qisqa sarlavha", "detail": "nima qilish kerakligi aniq qadamlar bilan", "priority": "high"}
  ]
}
5 tagacha tavsiya ber, eng muhimi birinchi bo'lsin.`;
}

function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

export async function generateSalesAdvice(insights: MarketplaceInsights): Promise<SalesAdvice> {
  const userPrompt = buildUserPrompt(insights);
  let content: string;

  try {
    const result = await callOpenAI(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { jsonMode: true, temperature: 0.5, maxTokens: 2000 },
    );
    content = result.content;
  } catch (openaiErr) {
    console.warn('OpenAI xato, Gemini ga o\'tildi:', (openaiErr as Error).message);
    try {
      const result = await callGemini(userPrompt, {
        systemInstruction: SYSTEM_PROMPT,
        jsonMode: true,
        temperature: 0.5,
      });
      content = result.content;
    } catch (geminiErr) {
      throw new Error(
        `AI tavsiya olinmadi. OpenAI: ${(openaiErr as Error).message}. Gemini: ${(geminiErr as Error).message}`,
      );
    }
  }

  const parsed = parseJson(content);
  const rawRecs: any[] = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

  return {
    summary: String(parsed?.summary || ''),
    bestSellers: String(parsed?.bestSellers || ''),
    problems: Array.isArray(parsed?.problems) ? parsed.problems.map(String) : [],
    recommendations: rawRecs.slice(0, 5).map((r) => ({
      title: String(r?.title || ''),
      detail: String(r?.detail || ''),
      priority: r?.priority === 'high' || r?.priority === 'low' ? r.priority : 'medium',
    })),
  };
}
