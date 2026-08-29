/**
 * Kartochkani marketplace'ga to'g'ridan-to'g'ri joylash
 *
 * Qaysi marketplace nimani qo'llab-quvvatlaydi:
 *   OZON    — POST /v3/product/import                         ✅
 *   WB      — POST /content/v2/cards/upload                    ✅ (+ alohida media qadami)
 *   YANDEX  — POST /v2/businesses/{id}/offer-mappings/update   ✅
 *   UZUM    — Seller API'da kartochka yaratish yo'q            ❌ (faqat Excel)
 *
 * Uchala marketplace ham RAQAMLI kategoriya identifikatorini talab qiladi —
 * u `values.categoryId` da turadi va kategoriya tanlagichdan keladi
 * (categories.service.ts). Erkin matnli kategoriya nomi bilan hech biri
 * kartochka yaratmaydi.
 *
 * Ikkinchi tuzoq — o'lchov birliklari. Har bir marketplace boshqacha kutadi,
 * spec'imiz esa marketplace shabloniga qarab to'ldiriladi. Farq bo'lsa
 * `toApiUnits` uni o'giradi; o'girmasa 1000 barobar xato ketadi.
 */

import { MarketplaceSpec, findField } from './specs';
import * as ozon from './ozon-api.service';
import * as wb from './wb-api.service';
import * as yandex from './yandex-api.service';
import { charcKey, isCoveredCharc, getWbTnved } from './categories.service';
import { toWbValue, WbDirectory } from './wb-dictionary.service';

export interface PublishInput {
  values: Record<string, any>;
  imageUrls: string[];
}

export interface PublishCreds {
  apiKey: string;
  apiSecret?: string | null;
  shopId?: string | null;
}

export interface PublishResult {
  success: boolean;
  /** Marketplace tomonidagi vazifa/tovar identifikatori */
  taskId?: string;
  message: string;
  /**
   * Natija hali ma'lum emas — marketplace asinxron qayta ishlayapti.
   * Bunda `checkPublishStatus` bilan keyinroq tekshiriladi.
   */
  pending?: boolean;
  /** Ketdi, lekin e'tibor talab qiladi (masalan, barkod generatsiya qilindi) */
  warnings?: string[];
  /** Xom javob — nosozlikni tekshirish uchun */
  raw?: unknown;
}

export class PublishNotSupportedError extends Error {
  constructor(marketplace: string) {
    super(
      `${marketplace} API orqali kartochka yaratishni qo'llab-quvvatlamaydi. ` +
        'Excel yuklab olib, seller kabinetiga qo\'lda yuklang.',
    );
    this.name = 'PublishNotSupportedError';
  }
}

// ============================================
// Yordamchilar
// ============================================

function num(values: Record<string, any>, key: string, fallback = 0): number {
  const raw = values[key];
  const parsed = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(values: Record<string, any>, key: string, fallback = ''): string {
  const raw = values[key];
  return raw === undefined || raw === null ? fallback : String(raw).trim();
}

/**
 * Spec birligidan API kutgan birlikka o'girish.
 *
 * Masalan WB spec'ida og'irlik grammda (shablon shunday so'raydi), API esa
 * kilogramm kutadi. Bu farq jimgina o'tib ketadi va faqat logistika
 * hisob-kitobida ko'rinadi — shuning uchun bitta joyda, aniq yoziladi.
 */
const UNIT_FACTORS: Record<string, number> = {
  'g->kg': 0.001,
  'kg->g': 1000,
  'mm->sm': 0.1,
  'sm->mm': 10,
  'mm->m': 0.001,
};

function toApiUnits(
  spec: MarketplaceSpec,
  values: Record<string, any>,
  key: string,
  apiUnit: string,
): number {
  const value = num(values, key);
  const specUnit = findField(spec, key)?.unit;
  if (!specUnit || specUnit === apiUnit) return value;

  const factor = UNIT_FACTORS[`${specUnit}->${apiUnit}`];
  if (factor === undefined) {
    throw new Error(
      `"${key}" uchun ${specUnit} → ${apiUnit} o'girish qoidasi yo'q — publish.service.ts dagi UNIT_FACTORS ga qo'shing`,
    );
  }
  // Suzuvchi nuqta xatosini yig'masligi uchun yaxlitlaymiz (0.1*3 = 0.30000000000000004)
  return Math.round(value * factor * 1e6) / 1e6;
}

/**
 * WB uzunlik/en/balandlikni BUTUN santimetrda kutadi. Kasr qiymat
 * (masalan 155mm → 15.5sm) butun so'rovni "Invalid request format" (400)
 * bilan rad ettiradi — WB qaysi maydon ekanini ham aytmaydi. Shuning uchun
 * butunga yaxlitlaymiz, minimal 1 (0 ni ham WB qabul qilmaydi).
 */
function wbCm(value: number): number {
  return Math.max(1, Math.round(value));
}

/** Nomlarni taqqoslash uchun — registr, "ё" va ortiqcha bo'shliqlarsiz */
function normalizeName(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Kategoriya ID majburiy — yo'q bo'lsa sababini tushunarli aytamiz */
function requireCategoryId(values: Record<string, any>, spec: MarketplaceSpec): string {
  const id = str(values, 'categoryId');
  if (!id) {
    throw new Error(
      `${spec.name} kartochkasi uchun kategoriya katalogdan tanlanishi kerak. ` +
        'Kartochkani tahrirlashga o\'ting va "Kategoriya" maydonida ro\'yxatdan tanlang.',
    );
  }
  return id;
}

// ============================================
// OZON
// ============================================

/**
 * Bizdagi maydon → Ozon atributi nomi.
 *
 * Atribut ID'lari kategoriyaga qarab o'zgaradi, shuning uchun ularni qattiq
 * yozib bo'lmaydi: har safar kategoriya atributlari so'raladi va nomi bo'yicha
 * mos keladigani topiladi.
 */
const OZON_ATTRIBUTE_NAMES: Record<string, string[]> = {
  brand: ['бренд'],
  color: ['цвет товара', 'цвет'],
  material: ['материал'],
  country: ['страна изготовитель', 'страна производства'],
  description: ['аннотация', 'описание'],
  gender: ['пол'],
  size: ['размер'],
  season: ['сезон'],
  warranty: ['гарантийный срок'],
  tnved: ['тн вэд', 'тнвэд'],
};

/** Ozon "Тип товара" atributi — barcha kategoriyalarda bir xil va majburiy */
const OZON_TYPE_ATTRIBUTE_ID = 8229;

async function buildOzonAttributes(
  creds: { apiKey: string; clientId: string },
  categoryId: number,
  typeId: number,
  values: Record<string, any>,
  warnings: string[],
): Promise<any[]> {
  const attributes: any[] = [
    // Tovar turi — alohida maydon emas, aynan shu atribut orqali beriladi
    { id: OZON_TYPE_ATTRIBUTE_ID, complex_id: 0, values: [{ dictionary_value_id: typeId }] },
  ];

  let catalog: any[];
  try {
    catalog = await ozon.getCategoryAttributes(creds, categoryId, typeId);
  } catch (err: any) {
    warnings.push(
      `Ozon atributlar ro'yxatini o'qib bo'lmadi (${err?.message}) — faqat asosiy maydonlar yuborildi`,
    );
    return attributes;
  }

  const byName = new Map<string, any>();
  for (const attr of catalog) byName.set(normalizeName(attr?.name), attr);

  for (const [key, candidates] of Object.entries(OZON_ATTRIBUTE_NAMES)) {
    const text = str(values, key);
    if (!text) continue;

    const attr = candidates.map((c) => byName.get(normalizeName(c))).find(Boolean);
    if (!attr) continue;

    // Lug'atli atribut: matn emas, qiymat identifikatori kutiladi
    if (attr.dictionary_id > 0) {
      const match = await findOzonDictionaryValue(creds, categoryId, typeId, attr.id, text);
      if (match) {
        attributes.push({ id: attr.id, complex_id: 0, values: [{ dictionary_value_id: match }] });
      } else {
        warnings.push(
          `"${text}" — Ozon'ning "${attr.name}" ro'yxatida topilmadi, bu maydon yuborilmadi`,
        );
      }
      continue;
    }

    attributes.push({ id: attr.id, complex_id: 0, values: [{ value: text }] });
  }

  // Majburiy, lekin to'ldirilmagan atributlarni sotuvchiga aytamiz —
  // Ozon aks holda tushunarsiz xato bilan rad etadi
  const sent = new Set(attributes.map((a) => a.id));
  const missing = catalog
    .filter((a: any) => a?.is_required && !sent.has(a.id))
    .map((a: any) => a.name);
  if (missing.length) {
    warnings.push(`Ozon majburiy deb belgilagan atributlar bo'sh: ${missing.slice(0, 6).join(', ')}`);
  }

  return attributes;
}

/** Lug'atdan matnga mos qiymat ID sini topish */
async function findOzonDictionaryValue(
  creds: { apiKey: string; clientId: string },
  categoryId: number,
  typeId: number,
  attributeId: number,
  text: string,
): Promise<number | null> {
  const target = normalizeName(text);
  let lastValueId = 0;

  // Lug'atlar uzun bo'lishi mumkin — bir necha sahifani ko'ramiz, lekin cheksiz emas
  for (let page = 0; page < 5; page++) {
    let rows: any[];
    try {
      rows = await ozon.getAttributeValues(creds, categoryId, typeId, attributeId, {
        limit: 100,
        lastValueId,
      });
    } catch {
      return null;
    }
    if (!rows.length) return null;

    const hit = rows.find((r: any) => normalizeName(r?.value) === target);
    if (hit) return Number(hit.id);

    lastValueId = Number(rows[rows.length - 1]?.id ?? 0);
    if (!lastValueId) return null;
  }
  return null;
}

/** "12%" → "0.12" ko'rinishidagi Ozon formati */
function vatToOzon(values: Record<string, any>): string {
  const digits = str(values, 'vat').replace('%', '');
  const map: Record<string, string> = { '0': '0', '10': '0.1', '20': '0.2' };
  return map[digits] ?? '0';
}

async function publishOzon(
  spec: MarketplaceSpec,
  creds: PublishCreds,
  input: PublishInput,
): Promise<PublishResult> {
  if (!creds.apiSecret) {
    throw new Error("Ozon uchun Client-Id kerak (Marketplace sozlamalarida 'Client-Id' maydoni)");
  }

  const v = input.values;
  const warnings: string[] = [];
  const ozonCreds = { apiKey: creds.apiKey, clientId: creds.apiSecret };

  const categoryId = Number(requireCategoryId(v, spec));
  const typeId = Number(str(v, 'typeId'));
  if (!Number.isFinite(categoryId) || !Number.isFinite(typeId) || !typeId) {
    throw new Error(
      "Ozon kategoriyasi to'liq tanlanmagan — kategoriya va tovar turi juftligi kerak. Kategoriyani qaytadan tanlang.",
    );
  }

  const attributes = await buildOzonAttributes(ozonCreds, categoryId, typeId, v, warnings);

  const body = {
    items: [
      {
        offer_id: str(v, 'sku'),
        name: str(v, 'title'),
        description_category_id: categoryId,
        type_id: typeId,
        barcode: str(v, 'barcode') || undefined,
        price: String(num(v, 'price')),
        old_price: v.oldPrice ? String(num(v, 'oldPrice')) : undefined,
        currency_code: spec.currency === 'RUB' ? 'RUB' : spec.currency,
        vat: vatToOzon(v),
        // Ozon o'lchamni mm, og'irlikni g da kutadi
        depth: toApiUnits(spec, v, 'packLength', 'mm'),
        width: toApiUnits(spec, v, 'packWidth', 'mm'),
        height: toApiUnits(spec, v, 'packHeight', 'mm'),
        dimension_unit: 'mm',
        weight: toApiUnits(spec, v, 'weight', 'g'),
        weight_unit: 'g',
        primary_image: input.imageUrls[0],
        images: input.imageUrls.slice(1, 15),
        attributes,
      },
    ],
  };

  let raw: any;
  try {
    raw = await ozon.importProducts(ozonCreds, body);
  } catch (err: any) {
    return { success: false, message: `Ozon rad etdi: ${err?.message || err}`, warnings, raw: err };
  }

  const taskId = raw?.result?.task_id;
  return {
    success: true,
    pending: true,
    taskId: taskId ? String(taskId) : undefined,
    message: taskId
      ? `Ozon'ga yuborildi (vazifa ${taskId}). Natijani bir necha daqiqadan so'ng tekshiramiz.`
      : "Ozon'ga yuborildi",
    warnings,
    raw,
  };
}

// ============================================
// WILDBERRIES
// ============================================

/** Bizdagi maydon → WB xarakteristikasi nomi (ID'lar predmetga qarab o'zgaradi) */
/**
 * Bu maydonlarning qiymati WB lug'atidan bo'lishi shart. Formadagi ro'yxat
 * o'zbekcha, WB esa ruscha nomni kutadi — o'girmasak kabinetda qizil xato.
 */
const WB_DICTIONARY_FIELDS: Record<string, WbDirectory> = {
  gender: 'kinds',
  season: 'seasons',
  country: 'countries',
};

const WB_CHARC_NAMES: Record<string, string[]> = {
  color: ['цвет'],
  composition: ['состав'],
  country: ['страна производства'],
  gender: ['пол'],
  season: ['сезон'],
  contents: ['комплектация'],
  material: ['материал'],
  tnved: ['тнвэд', 'тн вэд'],
};

interface WbCharcResult {
  characteristics: any[];
  /**
   * Xarakteristika sifatida kelgan, lekin yuborilmagan paket og'irligi
   * (grammda). Sotuvchi "Qadoq" bo'limini emas, shu maydonni to'ldirgan
   * bo'lishi mumkin — qiymatni yo'qotmaymiz, dimensions ga o'tkazamiz.
   */
  weightFromCharcG?: number;
}

async function buildWbCharacteristics(
  apiKey: string,
  subjectId: number,
  values: Record<string, any>,
  warnings: string[],
): Promise<WbCharcResult> {
  let catalog: any[];
  try {
    catalog = await wb.getSubjectCharcs(apiKey, subjectId);
  } catch (err: any) {
    warnings.push(
      `WB xarakteristikalarini o'qib bo'lmadi (${err?.message}) — faqat asosiy maydonlar yuborildi`,
    );
    return { characteristics: [] };
  }

  const byName = new Map<string, any>();
  for (const charc of catalog) byName.set(normalizeName(charc?.name), charc);

  const out: any[] = [];
  for (const [key, candidates] of Object.entries(WB_CHARC_NAMES)) {
    let text = str(values, key);
    if (!text) continue;

    const charc = candidates.map((c) => byName.get(normalizeName(c))).find(Boolean);
    if (!charc) continue;

    // Lug'atli maydon bo'lsa — WB ning o'z qiymatiga o'giramiz
    const directory = WB_DICTIONARY_FIELDS[key];
    if (directory) {
      const mapped = await toWbValue(apiKey, directory, text);
      text = mapped.value;
      if (mapped.note) warnings.push(mapped.note);
    }

    // WB son tipidagi xarakteristikani massiv emas, son sifatida kutadi
    const isNumber = charc.charcType === 4;
    out.push({ id: charc.charcID, value: isNumber ? Number(text) || 0 : [text] });
  }

  // Dinamik xarakteristikalar — formaда kategoriyaga qarab to'ldirilgan
  // (charcID → qiymat). Fixed maydon yuborganini takrorlamaymiz.
  const sent = new Set(out.map((c) => c.id));
  const skippedCovered: string[] = [];
  let weightFromCharcG: number | undefined;
  const dynamic = values.wbCharacteristics;
  if (dynamic && typeof dynamic === 'object') {
    const byId = new Map<number, any>(catalog.map((c: any) => [c.charcID, c]));
    for (const [idStr, raw] of Object.entries(dynamic as Record<string, unknown>)) {
      const id = Number(idStr);
      if (!Number.isFinite(id) || sent.has(id)) continue;
      const charc = byId.get(id);
      if (!charc) continue;

      // WB paket og'irligi va gabaritlarini endi xarakteristika sifatida
      // QABUL QILMAYDI — ular faqat dimensions blokida ketadi, aks holda
      // butun kartochka 400 bilan rad etiladi ("weightBrutto in kilograms").
      // Eski qoralamalarda bu qiymatlar saqlanib qolgan bo'lishi mumkin,
      // shuning uchun forma filtri bilan bir qatorda bu yerda ham to'samiz.
      if (isCoveredCharc(String(charc.name || ''))) {
        skippedCovered.push(String(charc.name));
        if (charcKey(String(charc.name || '')) === 'вес товара с упаковкой') {
          const grams = Number(String(raw).replace(',', '.'));
          if (Number.isFinite(grams) && grams > 0) weightFromCharcG = grams;
        }
        continue;
      }

      if (charc.charcType === 4) {
        const n = Number(String(raw).replace(',', '.'));
        if (Number.isFinite(n) && n > 0) {
          out.push({ id, value: n });
          sent.add(id);
        }
      } else {
        const arr = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
        const clean = arr
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, Number(charc.maxCount) || 1);
        if (clean.length) {
          out.push({ id, value: clean });
          sent.add(id);
        }
      }
    }
  }

  if (skippedCovered.length) {
    warnings.push(
      `Bu xarakteristikalar yuborilmadi — WB ularni endi alohida bloklarda kutadi: ${skippedCovered.join(', ')}. ` +
        `Qiymatlar "Qadoq" bo'limidagi og'irlik/o'lcham maydonlaridan olinadi.`,
    );
  }

  // Qoplangan maydonlar (og'irlik, gabaritlar) WB katalogida "majburiy" deb
  // turadi, lekin ular xarakteristika sifatida ketmaydi — ro'yxatda ularni
  // "bo'sh" deb ko'rsatish sotuvchini yo'q muammoni qidirishga majbur qilardi.
  const missing = catalog
    .filter((c: any) => c?.required && !sent.has(c.charcID) && !isCoveredCharc(String(c?.name || '')))
    .map((c: any) => c.name);
  if (missing.length) {
    warnings.push(`WB majburiy deb belgilagan xarakteristikalar bo'sh: ${missing.slice(0, 6).join(', ')}`);
  }

  return { characteristics: out, weightFromCharcG };
}

/**
 * WB asinxron: cards/upload 200 = "qabul qilindi", "yaratildi" EMAS. Tez rad
 * etishlarni (format/validatsiya) darrov ushlaymiz — sotuvchi "yuborildi" deb
 * qolib, keyin kartochka yo'qligini ko'rib chalkashmasin. Sekin rad etishlar
 * keyin checkPublishStatus (finalizeWbCard) da chiqadi.
 *
 * Bir necha marta qisqa kutib, KESHSIZ xato ro'yxatini tekshiramiz.
 * Rad etilgan bo'lsa sababni, aks holda null (hali qayta ishlanmoqda) qaytaradi.
 */
async function verifyWbUpload(apiKey: string, vendorCode: string): Promise<string | null> {
  const attempts = Number(process.env.WB_VERIFY_ATTEMPTS) || 2;
  const gapMs = Number(process.env.WB_VERIFY_GAP_MS) || 5000;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, gapMs));
    // Yaratilgan bo'lsa — rad etilmagan, tekshiruvni to'xtatamiz
    const card = await wb.findCardByVendorCode(apiKey, vendorCode).catch(() => null);
    if (card?.nmID) return null;
    // Keshsiz xato ro'yxati: shu vendorCode bormi
    const errors = await wb.getCardErrors(apiKey, 'ru', { fresh: true }).catch(() => [] as any[]);
    const mine = errors.find((e: any) => e?.vendorCode === vendorCode || e?.object === vendorCode);
    if (mine) {
      return Array.isArray(mine.errors)
        ? mine.errors.join('; ')
        : String(mine.errors ?? "sabab ko'rsatilmagan");
    }
  }
  return null;
}

async function publishWb(
  spec: MarketplaceSpec,
  creds: PublishCreds,
  input: PublishInput,
): Promise<PublishResult> {
  const v = input.values;
  const warnings: string[] = [];

  const subjectId = Number(requireCategoryId(v, spec));
  if (!Number.isFinite(subjectId)) {
    throw new Error("WB predmeti (subjectID) noto'g'ri — kategoriyani qaytadan tanlang");
  }

  const vendorCode = str(v, 'sku');
  if (!vendorCode) throw new Error('WB uchun sotuvchi artikuli (SKU) majburiy');

  const { characteristics, weightFromCharcG } = await buildWbCharacteristics(
    creds.apiKey,
    subjectId,
    v,
    warnings,
  );

  // WB paket og'irligini FAQAT dimensions.weightBrutto da, kilogrammda kutadi.
  // Nol yoki bo'sh bo'lsa so'rov "should be specified in weightBrutto" xatosi
  // bilan qaytadi — sababi tushunarsiz. Shuning uchun o'zimiz tekshiramiz va
  // sotuvchi xarakteristikalarga yozgan og'irlikni ham qutqaramiz.
  let weightKg = toApiUnits(spec, v, 'weight', 'kg');
  if (weightKg <= 0 && weightFromCharcG) {
    weightKg = Math.round((weightFromCharcG / 1000) * 1e6) / 1e6;
    warnings.push(
      `Paket og'irligi xarakteristikalardan olindi (${weightFromCharcG} g) — "Qadoq" bo'limidagi og'irlik maydoni bo'sh edi`,
    );
  }
  if (weightKg <= 0) {
    return {
      success: false,
      message:
        "Paket og'irligi kiritilmagan. WB uni kilogrammda talab qiladi — " +
        '"Qadoq" bo\'limidagi "Og\'irlik" maydonini to\'ldiring.',
      warnings,
    };
  }

  // TN VED predmetga bog'liq: polo uchun to'g'ri kod sarafan predmetida
  // qabul qilinmaydi. WB buni "Invalid HS code" deb kabinetda ko'rsatadi,
  // API esa kartochkani qabul qilgandek javob beradi — shuning uchun
  // yuborishdan oldin o'zimiz tekshiramiz.
  const tnved = str(v, 'tnved');
  if (tnved) {
    const allowed = await getWbTnved(creds.apiKey, subjectId).catch(() => []);
    if (allowed.length && !allowed.some((item) => item.tnved === tnved)) {
      return {
        success: false,
        message:
          `TN VED "${tnved}" bu kategoriyaga mos emas. WB shu predmet uchun ` +
          `boshqa kodlarni kutadi (masalan ${allowed.slice(0, 3).map((i) => i.tnved).join(', ')}). ` +
          `Kategoriya to'g'ri tanlanganini ham tekshiring.`,
        warnings,
      };
    }
  }

  // Shu vendorCode bilan kartochka allaqachon bormi. Bor bo'lsa — YANGILAYMIZ:
  // upload ikkinchi marta yuborilsa WB "bunday artikul bor" deb rad etadi, ya'ni
  // kabinetdagi xatoni (jins, TN VED, brend) tuzatib qayta yuborib bo'lmasdi.
  const existing = await wb.findCardByVendorCode(creds.apiKey, vendorCode).catch(() => null);
  const existingSkus: string[] = Array.isArray(existing?.sizes)
    ? existing.sizes.flatMap((size: any) => (Array.isArray(size?.skus) ? size.skus : []))
    : [];

  // WB barkodsiz kartochkani qabul qilmaydi. Sotuvchida ko'pincha barkod
  // bo'lmaydi — shunda WB'ning o'zidan so'raymiz va buni aytib qo'yamiz.
  // Mavjud kartochkada barkod bor bo'lsa yangisi so'ralmaydi: keraksiz
  // barkod yaratish ham chaqiruvni, ham WB dagi ro'yxatni ifloslantiradi.
  let barcode = str(v, 'barcode') || existingSkus[0] || '';
  if (!barcode) {
    try {
      const [generated] = await wb.generateBarcodes(creds.apiKey, 1);
      if (generated) {
        barcode = generated;
        warnings.push(`Barkod yo'q edi — WB generatsiya qildi: ${generated}`);
      }
    } catch (err: any) {
      warnings.push(`Barkod generatsiya qilinmadi (${err?.message})`);
    }
  }
  if (!barcode) {
    return {
      success: false,
      message:
        'WB kartochkasi barkodsiz qabul qilinmaydi. Barkod maydonini to\'ldiring yoki ' +
        'token\'da "Kontent" ruxsati borligini tekshiring.',
      warnings,
    };
  }

  if (existing?.nmID) {
    const sizes = Array.isArray(existing.sizes) && existing.sizes.length
      ? existing.sizes.map((size: any) => ({
          chrtID: size.chrtID,
          techSize: size.techSize ?? str(v, 'size') ?? '0',
          wbSize: size.wbSize ?? '',
          // Mavjud barkodlarni saqlaymiz: yangisini qo'ysak eski qoldiq uziladi
          skus: Array.isArray(size.skus) && size.skus.length ? size.skus : [barcode],
        }))
      : [{ techSize: str(v, 'size') || '0', wbSize: str(v, 'size') || '', skus: [barcode] }];

    try {
      await wb.updateCards(creds.apiKey, [
        {
          nmID: existing.nmID,
          vendorCode,
          // Brend bo'sh bo'lsa maydonni yubormaymiz — mavjud kartochkada
          // brend bo'lsa u saqlanadi, bo'lmasa brendsiz qoladi
          ...(str(v, 'brand') ? { brand: str(v, 'brand') } : {}),
          title: str(v, 'title'),
          description: str(v, 'description'),
          dimensions: {
            length: wbCm(toApiUnits(spec, v, 'packLength', 'sm')),
            width: wbCm(toApiUnits(spec, v, 'packWidth', 'sm')),
            height: wbCm(toApiUnits(spec, v, 'packHeight', 'sm')),
            weightBrutto: weightKg,
          },
          characteristics,
          sizes,
        },
      ]);
    } catch (err: any) {
      return {
        success: false,
        message: `Wildberries kartochkani yangilamadi: ${err?.message || err}`,
        warnings,
        raw: err,
      };
    }

    return {
      success: true,
      message: `Kartochka yangilandi (nmID ${existing.nmID}). WB o'zgarishni bir necha daqiqada qabul qiladi.`,
      warnings,
      raw: { nmID: existing.nmID },
    };
  }

  const body = [
    {
      subjectID: subjectId,
      variants: [
        {
          vendorCode,
          title: str(v, 'title'),
          description: str(v, 'description'),
          // Brend ixtiyoriy: bo'sh satr yubormaymiz, maydonni umuman
          // qo'shmaymiz — WB brendsiz kartochkani muammosiz qabul qiladi
          ...(str(v, 'brand') ? { brand: str(v, 'brand') } : {}),
          // WB o'lchamni sm (BUTUN son), og'irlikni KILOGRAMM da kutadi.
          // Spec grammda so'raydi (shablon shunday) — o'girmasak 1000 barobar xato.
          // Uzunlik/en/balandlik butunga yaxlitlanadi (kasr → 400), og'irlik kasr bo'la oladi.
          dimensions: {
            length: wbCm(toApiUnits(spec, v, 'packLength', 'sm')),
            width: wbCm(toApiUnits(spec, v, 'packWidth', 'sm')),
            height: wbCm(toApiUnits(spec, v, 'packHeight', 'sm')),
            weightBrutto: weightKg,
          },
          characteristics,
          sizes: [
            {
              techSize: str(v, 'size') || '0',
              wbSize: str(v, 'size') || '',
              price: num(v, 'price'),
              skus: [barcode],
            },
          ],
        },
      ],
    },
  ];

  let raw: any;
  try {
    raw = await wb.uploadCards(creds.apiKey, body);
  } catch (err: any) {
    return {
      success: false,
      message: `Wildberries rad etdi: ${err?.message || err}`,
      warnings,
      raw: err,
    };
  }

  if (raw?.error) {
    return {
      success: false,
      message: `Wildberries rad etdi: ${raw?.errorText || JSON.stringify(raw)}`,
      warnings,
      raw,
    };
  }

  // 200 "qabul qilindi" — endi WB haqiqatan yaratdimi yoki jimgina rad etdimi
  // tekshiramiz (aks holda "yuborildi" deb qolib, kartochka yo'q bo'lardi).
  const rejection = await verifyWbUpload(creds.apiKey, vendorCode);
  if (rejection) {
    return {
      success: false,
      message: `Wildberries kartochkani rad etdi: ${rejection}`,
      warnings,
      raw,
    };
  }

  return {
    success: true,
    pending: true,
    // Rasmlar keyingi qadamda: WB media'ni faqat nmID bo'yicha qabul qiladi,
    // nmID esa kartochka sinxronlangandan keyin (30 daqiqagacha) paydo bo'ladi.
    taskId: vendorCode,
    message:
      "Wildberries qabul qildi. Kartochka sinxronlanishi 30 daqiqagacha davom etadi. " +
      "Holatni \"Tekshirish\" tugmasi bilan ko'rishingiz mumkin — rad etilsa sababi chiqadi.",
    warnings,
    raw,
  };
}

/**
 * WB kartochkasini yakunlash: nmID ni topib, rasmlarni biriktirish.
 *
 * Alohida qadam, chunki `cards/upload` faqat "qabul qilindi" deydi —
 * kartochka WB tomonida hali yo'q va media'ni biriktirib bo'lmaydi.
 */
export async function finalizeWbCard(
  apiKey: string,
  vendorCode: string,
  imageUrls: string[],
): Promise<PublishResult> {
  const card = await wb.findCardByVendorCode(apiKey, vendorCode);

  if (!card?.nmID) {
    // Xato ro'yxatida bo'lsa — sababi shu yerda (keshsiz, eng yangi holat)
    const errors = await wb.getCardErrors(apiKey, 'ru', { fresh: true }).catch(() => [] as any[]);
    const mine = errors.find((e: any) => e?.vendorCode === vendorCode || e?.object === vendorCode);
    if (mine) {
      const text = Array.isArray(mine.errors) ? mine.errors.join('; ') : String(mine.errors ?? '');
      return { success: false, message: `Wildberries kartochkani rad etdi: ${text}`, raw: mine };
    }
    return {
      success: true,
      pending: true,
      taskId: vendorCode,
      message: 'Kartochka hali sinxronlanmoqda — keyinroq qayta tekshiramiz',
    };
  }

  if (!imageUrls.length) {
    return { success: true, message: `Kartochka tayyor (nmID ${card.nmID})`, raw: card };
  }

  try {
    await wb.saveMedia(apiKey, card.nmID, imageUrls);
  } catch (err: any) {
    return {
      success: false,
      message:
        `Kartochka yaratildi (nmID ${card.nmID}), lekin rasmlar biriktirilmadi: ${err?.message}. ` +
        'Rasm manzillari internetdan ochiladigan bo\'lishi kerak.',
      raw: card,
    };
  }

  return {
    success: true,
    message: `Kartochka tayyor: nmID ${card.nmID}, ${imageUrls.length} ta rasm biriktirildi`,
    raw: card,
  };
}

// ============================================
// YANDEX MARKET
// ============================================

async function publishYandex(
  spec: MarketplaceSpec,
  creds: PublishCreds,
  input: PublishInput,
): Promise<PublishResult> {
  const campaignId = creds.shopId;
  if (!campaignId) {
    throw new Error(
      "Yandex ulanishi to'liq emas — Marketplace'lar bo'limida \"Test qilish\" ni bosing",
    );
  }

  // shopId da campaignId saqlanadi, offer-mappings esa businessId (kabinet ID)
  // talab qiladi. Ular boshqa-boshqa raqamlar — almashtirilsa 403 keladi.
  let businessId: string | undefined;
  try {
    businessId = await yandex.resolveBusinessId(creds.apiKey, campaignId);
  } catch (err: any) {
    throw new Error(`Yandex kabinet ID sini aniqlab bo'lmadi: ${err?.message}`);
  }
  if (!businessId) {
    throw new Error(
      `Yandex kabinet ID (businessId) topilmadi. Kampaniya ${campaignId} shu kalitga tegishli ekanini tekshiring.`,
    );
  }

  const v = input.values;
  const warnings: string[] = [];
  const marketCategoryId = Number(requireCategoryId(v, spec));
  if (!Number.isFinite(marketCategoryId)) {
    throw new Error("Yandex kategoriyasi noto'g'ri — katalogdan qaytadan tanlang");
  }

  const barcode = str(v, 'barcode');
  if (!barcode) {
    warnings.push('Yandex shtrix-kodni majburiy qiladi — barkodsiz tovar moderatsiyadan o\'tmasligi mumkin');
  }

  const body = {
    offerMappings: [
      {
        offer: {
          offerId: str(v, 'sku'),
          name: str(v, 'title'),
          marketCategoryId,
          description: str(v, 'description'),
          vendor: str(v, 'brand'),
          vendorCode: str(v, 'vendorCode') || undefined,
          barcodes: barcode ? [barcode] : undefined,
          pictures: input.imageUrls,
          manufacturerCountries: v.country ? [str(v, 'country')] : undefined,
          // Yandex santimetr va kilogramm kutadi
          weightDimensions: {
            length: toApiUnits(spec, v, 'packLength', 'sm'),
            width: toApiUnits(spec, v, 'packWidth', 'sm'),
            height: toApiUnits(spec, v, 'packHeight', 'sm'),
            weight: toApiUnits(spec, v, 'weight', 'kg'),
          },
          basicPrice: { value: num(v, 'price'), currencyId: 'RUR' },
        },
      },
    ],
  };

  let raw: any;
  try {
    raw = await yandex.updateOfferMappings(creds.apiKey, businessId, body);
  } catch (err: any) {
    return { success: false, message: `Yandex rad etdi: ${err?.message || err}`, warnings, raw: err };
  }

  return {
    success: true,
    taskId: str(v, 'sku'),
    message:
      "Yandex katalogiga qo'shildi. Sotuvga chiqishi uchun kampaniyada narx va qoldiq " +
      'ham ko\'rsatilishi kerak — "Qoldiqlarni yuborish" ni bajaring.',
    warnings,
    raw,
  };
}

// ============================================
// Umumiy kirish nuqtasi
// ============================================

/** Marketplace API orqali kartochka yaratishni qo'llab-quvvatlaydimi */
export function supportsPublish(marketplace: string): boolean {
  return ['OZON', 'WB', 'YANDEX'].includes(marketplace);
}

export async function publishToMarketplace(
  spec: MarketplaceSpec,
  creds: PublishCreds,
  input: PublishInput,
): Promise<PublishResult> {
  switch (spec.id) {
    case 'OZON':
      return publishOzon(spec, creds, input);
    case 'WB':
      return publishWb(spec, creds, input);
    case 'YANDEX':
      return publishYandex(spec, creds, input);
    case 'UZUM':
    default:
      throw new PublishNotSupportedError(spec.name);
  }
}

/**
 * Yuborilgan kartochkaning haqiqiy natijasini so'rash.
 *
 * Ozon ham, WB ham darhol "qabul qilindi" deydi va tovarni keyin tekshiradi.
 * Shu funksiyasiz sotuvchi kartochkasi rad etilganini faqat seller kabinetiga
 * kirib bilib olardi.
 */
export async function checkPublishStatus(
  spec: MarketplaceSpec,
  creds: PublishCreds,
  taskId: string,
  imageUrls: string[] = [],
): Promise<PublishResult> {
  switch (spec.id) {
    case 'OZON': {
      if (!creds.apiSecret) throw new Error('Ozon uchun Client-Id kerak');
      const raw: any = await ozon.getImportInfo(
        { apiKey: creds.apiKey, clientId: creds.apiSecret },
        taskId,
      );
      const items: any[] = raw?.result?.items || [];
      const failed = items.filter((i) => i?.status === 'failed' || i?.errors?.length);

      if (failed.length) {
        const reasons = failed
          .flatMap((i) => (i.errors || []).map((e: any) => e?.message || e?.code))
          .filter(Boolean);
        return {
          success: false,
          message: `Ozon rad etdi: ${reasons.slice(0, 4).join('; ') || 'sabab ko\'rsatilmagan'}`,
          raw,
        };
      }

      const done = items.length > 0 && items.every((i) => i?.status === 'imported');
      return done
        ? { success: true, message: `Ozon kartochkani qabul qildi (${items.length} ta tovar)`, raw }
        : { success: true, pending: true, message: 'Ozon hali qayta ishlayapti', raw };
    }

    case 'WB':
      return finalizeWbCard(creds.apiKey, taskId, imageUrls);

    default:
      return { success: true, message: 'Bu marketplace uchun holat tekshiruvi kerak emas' };
  }
}

// Birlik o'girish va nom moslashtirish mantig'i testdan chaqiriladi —
// bular jimgina noto'g'ri ishlaydigan turdagi kod
export const __internal = { toApiUnits, normalizeName, vatToOzon, UNIT_FACTORS, wbCm };
