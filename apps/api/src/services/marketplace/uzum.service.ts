/**
 * Uzum Market uchun kartochka eksport servisi
 *
 * MUHIM: Uzum Business API to'g'ridan-to'g'ri publish qilishga ruxsat bermaydi
 * (faqat autentifikatsiya qilingan seller cabinet orqali).
 * Shuning uchun bu servis kartochka ma'lumotlarini formatlashtiradi
 * va foydalanuvchi ularni QO'LDA Uzum seller kabinetiga yuklaydi.
 *
 * Chiqadigan format:
 * 1. JSON — barcha ma'lumot
 * 2. Rasm URL'lar ro'yxati (yuklab olish uchun)
 * 3. Formatlangan matn (title, description, keywords) — copy-paste uchun
 */

export interface UzumExportInput {
  productId: string;
  title: string;
  description: string;
  seoKeywords: string;
  price: number | string;
  discountPrice?: number | string;
  currency: string;
  category: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  stock: number;
  attributes?: Record<string, any>;
  images: Array<{ url: string; order: number; isPrimary: boolean }>;
}

export interface UzumExportOutput {
  format: 'uzum-manual-import';
  timestamp: string;
  product: {
    name: string;
    description: string;
    seoKeywords: string[];
    category: string;
    brand: string;
    sku: string;
    barcode: string;
    price: number;
    salePrice: number | null;
    currency: string;
    stock: number;
    attributes: Record<string, any>;
  };
  images: Array<{
    url: string;
    order: number;
    isMain: boolean;
    filename: string;
  }>;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

/**
 * Kartochkani Uzum formatiga o'tkazish
 */
export function exportToUzumFormat(input: UzumExportInput): UzumExportOutput {
  const price =
    typeof input.price === 'string' ? parseFloat(input.price) : input.price;
  const discountPrice = input.discountPrice
    ? typeof input.discountPrice === 'string'
      ? parseFloat(input.discountPrice)
      : input.discountPrice
    : null;

  const keywords = input.seoKeywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    format: 'uzum-manual-import',
    timestamp: new Date().toISOString(),
    product: {
      name: input.title,
      description: input.description,
      seoKeywords: keywords,
      category: input.category,
      brand: input.brand || '',
      sku: input.sku || '',
      barcode: input.barcode || '',
      price,
      salePrice: discountPrice,
      currency: input.currency,
      stock: input.stock,
      attributes: input.attributes || {},
    },
    images: input.images
      .sort((a, b) => a.order - b.order)
      .map((img, idx) => ({
        url: img.url,
        order: idx,
        isMain: img.isPrimary,
        filename: `image-${idx + 1}${idx === 0 ? '-main' : ''}.jpg`,
      })),
    instructions: {
      step1: 'Rasmlarni yuklab oling (image URL\'lari orqali)',
      step2: 'Uzum Seller Cabinet\'ga kiring: https://business.uzum.uz',
      step3: 'Yangi mahsulot yaratish → ma\'lumotlarni yuqoridagi JSON dan nusxa ko\'chiring',
      step4: 'Rasmlarni tartib bo\'yicha yuklang (birinchisi — asosiy)',
    },
  };
}

/**
 * Uzum'dan mahsulot ma'lumotlarini "SCRAPE" qilish (raqobatchi tahlil uchun)
 *
 * MUHIM: Bu funksiya Uzum'ning public sahifasidan HTML ma'lumot oladi.
 * Bu skreping — Uzum'ning ToS'ini buzmaslik uchun ehtiyot bo'ling.
 * Faqat o'z mahsulotlaringizni yoki narx tahlili uchun ishlating.
 */
export interface UzumScrapedProduct {
  title: string;
  price?: number;
  images: string[];
  description?: string;
  rating?: number;
  reviewsCount?: number;
  seller?: string;
}

export async function scrapeUzumProduct(productUrl: string): Promise<UzumScrapedProduct> {
  // Uzum sahifasidan HTML olish
  const res = await fetch(productUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept-Language': 'uz,ru;q=0.9,en;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Uzum sahifasidan ma'lumot olib bo'lmadi: ${res.status}`);
  }

  const html = await res.text();

  // Meta tags va JSON-LD dan ma'lumot ajratib olish
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const priceMatch = html.match(/"price":\s*"?(\d+(?:\.\d+)?)"?/);
  const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);

  // Rasmlarni topish
  const imageMatches = html.matchAll(/<meta property="og:image" content="([^"]+)"/g);
  const images = Array.from(imageMatches).map((m) => m[1]);

  // JSON-LD dan qo'shimcha ma'lumot
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let jsonLdData: any = {};
  if (jsonLdMatch) {
    try {
      jsonLdData = JSON.parse(jsonLdMatch[1]);
    } catch {}
  }

  return {
    title: titleMatch?.[1] || jsonLdData.name || 'Nomaʼlum',
    price: priceMatch ? parseFloat(priceMatch[1]) : jsonLdData.offers?.price,
    images: images.length > 0 ? images : jsonLdData.image ? [jsonLdData.image] : [],
    description: descMatch?.[1] || jsonLdData.description,
    rating: jsonLdData.aggregateRating?.ratingValue,
    reviewsCount: jsonLdData.aggregateRating?.reviewCount,
    seller: jsonLdData.brand?.name,
  };
}
