/**
 * Marketplace kartochka spetsifikatsiyalari
 *
 * Har bir marketplace o'z kartochkasiga boshqacha maydonlar so'raydi.
 * Bu fayl — yagona manba (single source of truth):
 *   - frontend forma shu yerdan quriladi (GET /api/cards/specs/:marketplace)
 *   - AI rasmdan to'ldirishda qaysi maydon so'ralishi shu yerdan olinadi
 *   - Excel eksport ustun sarlavhalari ham shu yerdan
 *
 * excelHeader — marketplace o'z shablonida ishlatadigan ustun nomi.
 * mapsTo    — bizning Product modelimizdagi maydon (bo'lsa, o'sha yerga yoziladi).
 */

export type MarketplaceId = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'boolean'
  | 'tags'
  /** Marketplace katalogidan qidirib tanlanadi (GET /api/cards/categories/:mp) */
  | 'category';

export type ProductField =
  | 'title'
  | 'description'
  | 'category'
  | 'brand'
  | 'sku'
  | 'barcode'
  | 'basePrice'
  | 'currency'
  | 'stock';

export interface SpecField {
  key: string;
  label: string;
  excelHeader: string;
  type: FieldType;
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  unit?: string;
  options?: string[];
  placeholder?: string;
  hint?: string;
  /**
   * Qiymat shakli (regex manbasi). Marketplace formatni qat'iy tekshiradigan
   * maydonlar uchun: noto'g'ri qiymat kartochkani rad ettiradi yoki WB
   * kabinetida qizil xato bo'lib qoladi.
   */
  pattern?: string;
  /** Xato chiqqanda ko'rsatiladigan tushuntirish */
  patternHint?: string;
  /**
   * Variantlar statik emas, marketplace'dan kategoriyaga qarab olinadi.
   * 'wb-tnved' — GET /api/cards/categories/WB/tnved?subjectId=
   */
  optionsFrom?: 'wb-tnved';
  /** AI rasmga qarab to'ldira oladimi */
  aiFillable?: boolean;
  /**
   * Formada ko'rsatilmaydi — qiymatni boshqa maydon (kategoriya tanlagich) to'ldiradi.
   */
  hidden?: boolean;
  /**
   * API orqali joylashda majburiy, lekin saqlash/Excel uchun emas.
   *
   * Kategoriya ID'sini olish uchun marketplace ulangan bo'lishi kerak. Agar buni
   * oddiy `required` qilsak, kalit ulamagan sotuvchi Excel ham chiqara olmay qolardi —
   * holbuki Excel oqimi kalitsiz ham to'liq ishlashi kerak.
   */
  publishRequired?: boolean;
  /** Product modelidagi ustun (bo'lsa) */
  mapsTo?: ProductField;
}

export interface SpecGroup {
  key: string;
  label: string;
  description?: string;
  fields: SpecField[];
}

export interface ImageSpec {
  minWidth: number;
  minHeight: number;
  /** AI moslashtirishda chiqadigan o'lcham */
  targetWidth: number;
  targetHeight: number;
  aspectRatio: string;
  background: string;
  formats: string[];
  maxSizeMB: number;
  minCount: number;
  maxCount: number;
  notes: string[];
}

export interface MarketplaceSpec {
  id: MarketplaceId;
  name: string;
  logo: string;
  color: string;
  currency: 'UZS' | 'RUB';
  country: string;
  docsUrl: string;
  /** Excel yuklash haqida qisqacha yo'riqnoma */
  uploadHint: string;
  /** API orqali kartochka yaratish mumkinmi (Uzum'da yo'q) */
  canPublishViaApi: boolean;
  sheetName: string;
  image: ImageSpec;
  groups: SpecGroup[];
}

// ============================================
// Umumiy variantlar
// ============================================

const COUNTRIES = [
  "O'zbekiston",
  'Xitoy',
  'Turkiya',
  'Rossiya',
  'Qozog\'iston',
  'Janubiy Koreya',
  'Yaponiya',
  'Germaniya',
  'Italiya',
  'AQSH',
  'Hindiston',
  'Vetnam',
  'Bangladesh',
  'Polsha',
  'Boshqa',
];

const GENDERS = ['Erkaklar', 'Ayollar', 'Unisex', 'Bolalar', "O'g'il bolalar", 'Qiz bolalar'];

/**
 * WB jinsi ro'yxati — "Unisex" YO'Q.
 *
 * WB ning o'z ma'lumotnomasida (directory/kinds) atigi 5 qiymat bor:
 * Мужской, Женский, Детский, Девочки, Мальчики. "Унисекс" u yerda yo'q va
 * yuborilsa kartochka kabinetda "Invalid value in the Gender field" bilan
 * qizil bo'lib qoladi — tovar sotuvga chiqmaydi.
 */
const WB_GENDERS = GENDERS.filter((g) => g !== 'Unisex');

const SEASONS = ['Yoz', 'Qish', 'Demi-mavsum', 'Barcha mavsum'];

// ============================================
// UZUM MARKET
// ============================================

const UZUM: MarketplaceSpec = {
  id: 'UZUM',
  name: 'Uzum Market',
  logo: '/logos/uzum.jpg',
  color: '#7000FF',
  currency: 'UZS',
  country: 'UZ',
  docsUrl: 'https://business.uzum.uz',
  uploadHint:
    "Excel'ni Uzum Seller kabinetida: Mahsulotlar → Ommaviy yuklash → Excel fayl yuklash bo'limiga tashlang.",
  canPublishViaApi: false,
  sheetName: 'Uzum',
  image: {
    // Uzum shabloni (Ko'rsatmalar_UZ, 7-band): 1080×1440, 3:4, 5 MB gacha
    minWidth: 1080,
    minHeight: 1440,
    targetWidth: 1080,
    targetHeight: 1440,
    aspectRatio: '3:4',
    background: 'Oq (#FFFFFF)',
    formats: ['jpg', 'jpeg', 'png'],
    maxSizeMB: 5,
    minCount: 1,
    maxCount: 8,
    notes: [
      'Vertikal 3:4 nisbat, 1080×1440 px',
      'Fon toza oq bo\'lishi kerak — soya va gradient bo\'lmasin',
      'Birinchi rasm asosiy: mahsulot to\'liq ko\'rinsin, matn/vodyanoy znak bo\'lmasin',
      'Logotip, telefon raqami, narx yozuvlari taqiqlangan',
    ],
  },
  groups: [
    {
      key: 'main',
      label: 'Asosiy maʼlumotlar',
      description: 'Uzum kartochkasining ko\'rinadigan qismi',
      fields: [
        {
          key: 'category',
          label: 'Kategoriya',
          excelHeader: 'Kategoriya',
          type: 'text',
          required: true,
          mapsTo: 'category',
          aiFillable: true,
          placeholder: 'Kiyim-kechak / Erkaklar ko\'ylagi',
          hint: 'Uzum katalogidagi to\'liq yo\'l bo\'lsa yaxshi',
        },
        {
          key: 'title',
          label: 'Mahsulot nomi',
          excelHeader: 'Mahsulot nomi',
          type: 'text',
          required: true,
          maxLength: 100,
          mapsTo: 'title',
          aiFillable: true,
          placeholder: "Erkaklar ko'ylagi, katak, oq, paxta",
          hint: 'Tur + brend + asosiy xususiyat. 100 belgidan oshmasin',
        },
        {
          key: 'titleUz',
          label: "Mahsulot nomi (o'zbekcha)",
          excelHeader: 'Название товара UZ',
          type: 'text',
          required: true,
          maxLength: 100,
          aiFillable: true,
          placeholder: "Erkaklar ko'ylagi, katak, oq, paxta",
          hint: "Uzum shabloni RU va UZ nomni alohida talab qiladi. Bo'sh qolsa asosiy nom ishlatiladi",
        },
        {
          key: 'skuGroup',
          label: 'SKU guruhi',
          excelHeader: 'Группировка SKU',
          type: 'text',
          required: true,
          maxLength: 100,
          placeholder: 'KOYLAK-OQ',
          hint: "Bir xil qiymatli qatorlar bitta kartochkaga birlashadi (rang/o'lcham variantlari). Bo'sh qolsa artikul ishlatiladi",
        },
        {
          key: 'brand',
          label: 'Brend',
          excelHeader: 'Brend',
          type: 'text',
          required: true,
          mapsTo: 'brand',
          aiFillable: true,
          hint: 'Brend yo\'q bo\'lsa "No name" yozing',
        },
        {
          key: 'description',
          label: 'Tavsif',
          excelHeader: 'Tavsif',
          type: 'textarea',
          required: true,
          maxLength: 5000,
          mapsTo: 'description',
          aiFillable: true,
          hint: 'Afzalliklar, material, kim uchun mosligi. HTML teg ishlatilmaydi',
        },
        {
          key: 'descriptionUz',
          label: "Tavsif (o'zbekcha)",
          excelHeader: 'Описание товара UZ',
          type: 'textarea',
          required: true,
          maxLength: 5000,
          aiFillable: true,
          hint: "Bo'sh qolsa asosiy tavsif ishlatiladi",
        },
        {
          key: 'shortRu',
          label: 'Qisqa tavsif (ruscha)',
          excelHeader: 'Краткое описание RU',
          type: 'textarea',
          required: true,
          maxLength: 390,
          aiFillable: true,
          hint: "390 belgigacha. Bo'sh qolsa tavsifning boshi olinadi",
        },
        {
          key: 'shortUz',
          label: "Qisqa tavsif (o'zbekcha)",
          excelHeader: 'Краткое описание UZ',
          type: 'textarea',
          required: true,
          maxLength: 390,
          aiFillable: true,
          hint: '390 belgigacha',
        },
        {
          key: 'mxik',
          label: 'MXIK (IKPU) kodi',
          excelHeader: 'MXIK',
          type: 'text',
          required: true,
          placeholder: '0100100100100000',
          hint: "16 belgili ИКПУ kodi — tasnif.soliq.uz saytidan olinadi. AI buni topa olmaydi",
        },
        {
          key: 'sku',
          label: 'Artikul (SKU)',
          excelHeader: 'Artikul',
          type: 'text',
          required: true,
          mapsTo: 'sku',
          placeholder: 'SHIRT-001',
          hint: "Sizning ichki kodingiz — takrorlanmasligi kerak",
        },
        {
          key: 'barcode',
          label: 'Barkod (EAN-13)',
          excelHeader: 'Barkod',
          type: 'text',
          required: false,
          mapsTo: 'barcode',
          placeholder: '4780000000001',
          hint: "Bo'sh qoldirsangiz Uzum o'zi generatsiya qiladi",
        },
      ],
    },
    {
      key: 'price',
      label: 'Narx va zaxira',
      fields: [
        {
          key: 'price',
          label: 'Sotuv narxi',
          excelHeader: 'Narx',
          type: 'number',
          required: true,
          min: 1,
          unit: 'UZS',
          mapsTo: 'basePrice',
        },
        {
          key: 'oldPrice',
          label: 'Chegirmagacha narx',
          excelHeader: 'Chegirmagacha narx',
          type: 'number',
          required: false,
          min: 0,
          unit: 'UZS',
          hint: 'Sotuv narxidan katta bo\'lsa, kartochkada chegirma ko\'rinadi',
        },
        {
          key: 'stock',
          label: 'Zaxira (dona)',
          excelHeader: 'Zaxira',
          type: 'number',
          required: true,
          min: 0,
          mapsTo: 'stock',
        },
        {
          key: 'vat',
          label: 'QQS stavkasi',
          excelHeader: 'QQS',
          type: 'select',
          required: true,
          options: ['0%', '12%'],
          hint: "QQS to'lovchisi bo'lmasangiz 0%",
        },
      ],
    },
    {
      key: 'attrs',
      label: 'Xususiyatlar',
      description: 'Uzum filtrlarida shu maydonlar ishlatiladi',
      fields: [
        { key: 'color', label: 'Rang', excelHeader: 'Rang', type: 'text', required: true, aiFillable: true },
        {
          key: 'size',
          label: "O'lchamlar",
          excelHeader: "O'lcham",
          type: 'text',
          required: false,
          aiFillable: true,
          placeholder: 'S, M, L, XL',
          hint: "Bir nechta bo'lsa vergul bilan",
        },
        {
          key: 'material',
          label: 'Material / tarkib',
          excelHeader: 'Material',
          type: 'text',
          required: true,
          aiFillable: true,
          placeholder: '100% paxta',
        },
        {
          key: 'country',
          label: 'Ishlab chiqarilgan davlat',
          excelHeader: 'Ishlab chiqaruvchi davlat',
          type: 'select',
          required: true,
          options: COUNTRIES,
          aiFillable: true,
        },
        { key: 'gender', label: 'Jinsi', excelHeader: 'Jinsi', type: 'select', required: false, options: GENDERS, aiFillable: true },
        { key: 'season', label: 'Mavsum', excelHeader: 'Mavsum', type: 'select', required: false, options: SEASONS, aiFillable: true },
        {
          key: 'warranty',
          label: 'Kafolat muddati',
          excelHeader: 'Kafolat (oy)',
          type: 'number',
          required: false,
          min: 0,
          unit: 'oy',
        },
      ],
    },
    {
      key: 'package',
      label: 'Qadoq',
      description: "Yetkazib berish narxi shu o'lchamlarga qarab hisoblanadi",
      fields: [
        { key: 'weight', label: "Og'irligi (qadoq bilan)", excelHeader: "Og'irlik, g", type: 'number', required: true, min: 1, unit: 'g' },
        { key: 'packLength', label: 'Uzunlik', excelHeader: 'Uzunlik, mm', type: 'number', required: true, min: 1, unit: 'mm' },
        { key: 'packWidth', label: 'Kenglik', excelHeader: 'Kenglik, mm', type: 'number', required: true, min: 1, unit: 'mm' },
        { key: 'packHeight', label: 'Balandlik', excelHeader: 'Balandlik, mm', type: 'number', required: true, min: 1, unit: 'mm' },
      ],
    },
  ],
};

// ============================================
// OZON
// ============================================

const OZON: MarketplaceSpec = {
  id: 'OZON',
  name: 'Ozon',
  logo: '/logos/ozon.jpg',
  color: '#005BFF',
  currency: 'RUB',
  country: 'RU',
  docsUrl: 'https://seller.ozon.ru',
  uploadHint:
    "Excel'ni Ozon Seller: Товары и цены → Добавить товары → Загрузить XLS bo'limiga yuklang.",
  canPublishViaApi: true,
  sheetName: 'Ozon',
  image: {
    minWidth: 900,
    minHeight: 1200,
    targetWidth: 900,
    targetHeight: 1200,
    aspectRatio: '3:4',
    background: 'Oq (#FFFFFF)',
    formats: ['jpg', 'jpeg', 'png'],
    maxSizeMB: 10,
    minCount: 1,
    maxCount: 15,
    notes: [
      'Kamida 200×200, tavsiya 900×1200 px',
      'Fon oq yoki mahsulot muhiti (lifestyle) bo\'lishi mumkin, lekin 1-rasm oq fonda',
      'Bir mahsulotga 15 tagacha rasm',
      'Reklama matni va raqobatchi logotiplari taqiqlangan',
    ],
  },
  groups: [
    {
      key: 'main',
      label: 'Основные / Asosiy',
      fields: [
        {
          key: 'category',
          label: 'Tovar turi (Тип товара)',
          excelHeader: 'Тип товара',
          type: 'category',
          required: true,
          mapsTo: 'category',
          aiFillable: true,
          hint: "Ozon katalogidan tanlanadi — u description_category_id va type_id ni beradi",
        },
        // Tanlagich to'ldiradi. Ozon ikkalasini ham majburiy qiladi:
        // type_id — bu 8229 atributining qiymati, alohida maydon emas.
        { key: 'categoryId', label: 'Kategoriya ID', excelHeader: '', type: 'text', required: false, publishRequired: true, hidden: true },
        { key: 'typeId', label: 'Tovar turi ID', excelHeader: '', type: 'text', required: false, publishRequired: true, hidden: true },
        { key: 'title', label: 'Nomi (Название)', excelHeader: 'Название товара', type: 'text', required: true, maxLength: 200, mapsTo: 'title', aiFillable: true, hint: 'Tur + brend + model + rang/oʻlcham' },
        { key: 'sku', label: 'Artikul (Артикул)', excelHeader: 'Артикул', type: 'text', required: true, mapsTo: 'sku' },
        { key: 'brand', label: 'Brend (Бренд)', excelHeader: 'Бренд', type: 'text', required: true, mapsTo: 'brand', aiFillable: true, hint: 'Brend yo\'q bo\'lsa "Нет бренда"' },
        { key: 'description', label: 'Tavsif (Описание)', excelHeader: 'Описание', type: 'textarea', required: true, maxLength: 6000, mapsTo: 'description', aiFillable: true },
        { key: 'barcode', label: 'Shtrix kod (Штрихкод)', excelHeader: 'Штрихкод', type: 'text', required: false, mapsTo: 'barcode' },
      ],
    },
    {
      key: 'price',
      label: 'Narx va zaxira',
      fields: [
        { key: 'price', label: 'Narx (Цена)', excelHeader: 'Цена, руб.', type: 'number', required: true, min: 1, unit: 'RUB', mapsTo: 'basePrice' },
        { key: 'oldPrice', label: 'Chegirmagacha (Цена до скидки)', excelHeader: 'Цена до скидки, руб.', type: 'number', required: false, min: 0, unit: 'RUB' },
        { key: 'stock', label: 'Zaxira (Остаток)', excelHeader: 'Остаток', type: 'number', required: true, min: 0, mapsTo: 'stock' },
        { key: 'vat', label: 'QQS (НДС)', excelHeader: 'НДС, %', type: 'select', required: true, options: ['0%', '10%', '20%'] },
      ],
    },
    {
      key: 'attrs',
      label: 'Xususiyatlar (Характеристики)',
      fields: [
        { key: 'color', label: 'Rang (Цвет)', excelHeader: 'Цвет товара', type: 'text', required: true, aiFillable: true },
        { key: 'size', label: "O'lcham (Размер)", excelHeader: 'Размер', type: 'text', required: false, aiFillable: true },
        { key: 'material', label: 'Material (Материал)', excelHeader: 'Материал', type: 'text', required: false, aiFillable: true },
        { key: 'country', label: 'Ishlab chiqaruvchi davlat', excelHeader: 'Страна-изготовитель', type: 'select', required: true, options: COUNTRIES, aiFillable: true },
        { key: 'gender', label: 'Jinsi (Пол)', excelHeader: 'Пол', type: 'select', required: false, options: GENDERS, aiFillable: true },
        { key: 'tnved', label: 'TN VED kodi', excelHeader: 'ТН ВЭД', type: 'text', required: false, hint: '10 xonali bojxona kodi — AI topa olmaydi' },
        { key: 'warranty', label: 'Kafolat (Гарантия)', excelHeader: 'Гарантийный срок, мес.', type: 'number', required: false, min: 0, unit: 'oy' },
      ],
    },
    {
      key: 'package',
      label: 'Qadoq (Упаковка)',
      fields: [
        { key: 'weight', label: "Og'irlik (qadoq bilan)", excelHeader: 'Вес с упаковкой, г', type: 'number', required: true, min: 1, unit: 'g' },
        { key: 'packLength', label: 'Uzunlik', excelHeader: 'Длина упаковки, мм', type: 'number', required: true, min: 1, unit: 'mm' },
        { key: 'packWidth', label: 'Kenglik', excelHeader: 'Ширина упаковки, мм', type: 'number', required: true, min: 1, unit: 'mm' },
        { key: 'packHeight', label: 'Balandlik', excelHeader: 'Высота упаковки, мм', type: 'number', required: true, min: 1, unit: 'mm' },
      ],
    },
  ],
};

// ============================================
// WILDBERRIES
// ============================================

const WB: MarketplaceSpec = {
  id: 'WB',
  name: 'Wildberries',
  logo: '/logos/wildberries.jpg',
  color: '#CB11AB',
  currency: 'RUB',
  country: 'RU',
  docsUrl: 'https://seller.wildberries.ru',
  uploadHint:
    "Excel'ni WB Seller: Товары → Карточки товара → Загрузить из файла bo'limiga yuklang.",
  canPublishViaApi: true,
  sheetName: 'Wildberries',
  image: {
    minWidth: 900,
    minHeight: 1200,
    targetWidth: 900,
    targetHeight: 1200,
    aspectRatio: '3:4',
    background: 'Oq yoki neytral',
    formats: ['jpg', 'jpeg', 'png'],
    maxSizeMB: 32,
    minCount: 1,
    maxCount: 30,
    notes: [
      'Vertikal 3:4, tavsiya 900×1200 px (WB 1200×1600 ni ham qabul qiladi)',
      'Kiyim uchun modelda ko\'rsatish konversiyani oshiradi',
      '30 tagacha rasm + video qo\'shish mumkin',
      'Ramkalar, matnli stikerlar rad etilishi mumkin',
    ],
  },
  groups: [
    {
      key: 'main',
      label: 'Asosiy',
      fields: [
        {
          key: 'category',
          label: 'Predmet / kategoriya',
          excelHeader: 'Категория',
          type: 'category',
          required: true,
          mapsTo: 'category',
          aiFillable: true,
          hint: 'WB buni "Предмет" deb ataydi. Xarakteristikalar ro\'yxati shu tanlovga bog\'liq',
        },
        { key: 'categoryId', label: 'subjectID', excelHeader: '', type: 'text', required: false, publishRequired: true, hidden: true },
        { key: 'sku', label: 'Sotuvchi artikuli', excelHeader: 'Артикул продавца', type: 'text', required: true, mapsTo: 'sku' },
        { key: 'title', label: 'Nomi (Наименование)', excelHeader: 'Наименование', type: 'text', required: true, maxLength: 60, mapsTo: 'title', aiFillable: true, hint: 'WB da atigi 60 belgi!' },
        { key: 'description', label: 'Tavsif', excelHeader: 'Описание', type: 'textarea', required: true, maxLength: 5000, mapsTo: 'description', aiFillable: true, hint: 'WB qidiruvi tavsifdagi kalit soʻzlarga sezgir' },
        { key: 'barcode', label: 'Barkod', excelHeader: 'Баркод', type: 'text', required: false, mapsTo: 'barcode', hint: "Bo'sh bo'lsa WB generatsiya qiladi" },
      ],
    },
    {
      key: 'price',
      label: 'Narx va zaxira',
      // QQS bu yerda yo'q: WB kartochka API'sida bunday maydon umuman yo'q,
      // stavkani WB kabinet sozlamasidan oladi. Formada turgani sotuvchini
      // chalg'itardi — kabinetdagi "VAT rate" xatosini shu yerdan tuzatmoqchi
      // bo'lardi. Brend ham olib tashlandi: majburiy emas va rasmdan
      // taxmin qilingan har bir qiymat ("hh", "Polo", "PULL&BEAR") WB
      // tomonidan rad etilgan.
      fields: [
        { key: 'price', label: 'Narx', excelHeader: 'Цена, руб.', type: 'number', required: true, min: 1, unit: 'RUB', mapsTo: 'basePrice' },
        { key: 'stock', label: 'Zaxira', excelHeader: 'Остаток', type: 'number', required: true, min: 0, mapsTo: 'stock' },
      ],
    },
    {
      key: 'attrs',
      label: 'Xususiyatlar',
      fields: [
        { key: 'color', label: 'Rang', excelHeader: 'Цвет', type: 'text', required: true, aiFillable: true },
        { key: 'composition', label: 'Tarkib (Состав)', excelHeader: 'Состав', type: 'text', required: true, aiFillable: true, placeholder: 'хлопок 95%, эластан 5%' },
        {
          key: 'size',
          label: "O'lchamlar",
          excelHeader: 'Размер',
          type: 'text',
          required: false,
          aiFillable: true,
          placeholder: 'M, L, XL',
          // Har o'lcham WB da alohida nomenklatura bo'ladi va o'z barkodini
          // oladi — qoldiq ham har biriga alohida yuritiladi
          hint: "Vergul bilan yozing — har biri alohida o'lcham bo'ladi va o'z barkodini oladi",
        },
        { key: 'country', label: 'Ishlab chiqarilgan davlat', excelHeader: 'Страна производства', type: 'select', required: true, options: COUNTRIES, aiFillable: true },
        { key: 'gender', label: 'Jinsi', excelHeader: 'Пол', type: 'select', required: false, options: WB_GENDERS, aiFillable: true },
        { key: 'season', label: 'Mavsum', excelHeader: 'Сезон', type: 'select', required: false, options: SEASONS, aiFillable: true },
        { key: 'contents', label: 'Komplektatsiya', excelHeader: 'Комплектация', type: 'text', required: false, aiFillable: true, placeholder: 'ko\'ylak 1 dona' },
        {
          key: 'tnved',
          label: 'TN VED kodi',
          excelHeader: 'ТНВЭД',
          type: 'text',
          required: false,
          hint: "Kategoriya tanlangach ro'yxat WB dan keladi va AI mos kodni o'zi tanlaydi",
          optionsFrom: 'wb-tnved',
          // Ro'yxat yopiq (WB predmet ma'lumotnomasi) — AI erkin yozmaydi,
          // faqat ruxsat etilgan kodlardan birini tanlaydi
          aiFillable: true,
          // WB kodni qat'iy tekshiradi: harf yoki noto'g'ri uzunlik bo'lsa
          // kartochka kabinetda qizil xato bilan qoladi va sotuvga chiqmaydi
          pattern: '^\\d{10}$',
          patternHint: "TN VED — 10 ta raqam (masalan 6109100000). Harf va belgi bo'lmaydi",
        },
      ],
    },
    {
      key: 'package',
      label: 'Qadoq',
      fields: [
        { key: 'weight', label: "Og'irlik", excelHeader: 'Вес с упаковкой, г', type: 'number', required: true, min: 1, unit: 'g' },
        { key: 'packLength', label: 'Uzunlik', excelHeader: 'Длина упаковки, см', type: 'number', required: true, min: 1, unit: 'sm' },
        { key: 'packWidth', label: 'Kenglik', excelHeader: 'Ширина упаковки, см', type: 'number', required: true, min: 1, unit: 'sm' },
        { key: 'packHeight', label: 'Balandlik', excelHeader: 'Высота упаковки, см', type: 'number', required: true, min: 1, unit: 'sm' },
      ],
    },
  ],
};

// ============================================
// YANDEX MARKET
// ============================================

const YANDEX: MarketplaceSpec = {
  id: 'YANDEX',
  name: 'Yandex Market',
  logo: '/logos/yandex.jpg',
  color: '#FC3F1D',
  currency: 'RUB',
  country: 'RU',
  docsUrl: 'https://partner.market.yandex.ru',
  uploadHint:
    "Excel'ni Yandex Market: Товары → Каталог → Загрузить файл bo'limiga yuklang.",
  canPublishViaApi: true,
  sheetName: 'Yandex',
  image: {
    minWidth: 600,
    minHeight: 600,
    targetWidth: 1000,
    targetHeight: 1000,
    aspectRatio: '1:1',
    background: 'Oq (#FFFFFF)',
    formats: ['jpg', 'jpeg', 'png'],
    maxSizeMB: 8,
    minCount: 1,
    maxCount: 10,
    notes: [
      'Kvadrat 1:1, kamida 600×600, tavsiya 1000×1000 px',
      'Faqat oq fon, mahsulot markazda',
      'Kolaj va matn qo\'shish taqiqlangan',
      '10 tagacha rasm',
    ],
  },
  groups: [
    {
      key: 'main',
      label: 'Asosiy',
      fields: [
        {
          key: 'category',
          label: 'Kategoriya',
          excelHeader: 'Категория',
          type: 'category',
          required: true,
          mapsTo: 'category',
          aiFillable: true,
          hint: 'Yandex katalogidan tanlanadi — marketCategoryId yangi tovar uchun majburiy',
        },
        { key: 'categoryId', label: 'marketCategoryId', excelHeader: '', type: 'text', required: false, publishRequired: true, hidden: true },
        { key: 'sku', label: 'Sizning SKU', excelHeader: 'Ваш SKU', type: 'text', required: true, mapsTo: 'sku' },
        { key: 'title', label: 'Nomi', excelHeader: 'Название товара', type: 'text', required: true, maxLength: 150, mapsTo: 'title', aiFillable: true },
        { key: 'brand', label: 'Ishlab chiqaruvchi / brend', excelHeader: 'Бренд', type: 'text', required: true, mapsTo: 'brand', aiFillable: true },
        { key: 'vendorCode', label: 'Ishlab chiqaruvchi artikuli', excelHeader: 'Артикул производителя', type: 'text', required: false },
        { key: 'description', label: 'Tavsif', excelHeader: 'Описание', type: 'textarea', required: true, maxLength: 3000, mapsTo: 'description', aiFillable: true },
        { key: 'barcode', label: 'Shtrix kod', excelHeader: 'Штрихкод', type: 'text', required: true, mapsTo: 'barcode', hint: 'Yandex EAN-13 yoki UPC talab qiladi' },
      ],
    },
    {
      key: 'price',
      label: 'Narx va zaxira',
      fields: [
        { key: 'price', label: 'Narx', excelHeader: 'Цена, руб.', type: 'number', required: true, min: 1, unit: 'RUB', mapsTo: 'basePrice' },
        { key: 'oldPrice', label: 'Chegirmagacha narx', excelHeader: 'Цена до скидки, руб.', type: 'number', required: false, min: 0, unit: 'RUB' },
        { key: 'stock', label: 'Zaxira', excelHeader: 'Остаток', type: 'number', required: true, min: 0, mapsTo: 'stock' },
        { key: 'vat', label: 'QQS', excelHeader: 'НДС', type: 'select', required: true, options: ['0%', '10%', '20%'] },
      ],
    },
    {
      key: 'attrs',
      label: 'Xususiyatlar',
      fields: [
        { key: 'color', label: 'Rang', excelHeader: 'Цвет', type: 'text', required: true, aiFillable: true },
        { key: 'size', label: "O'lcham", excelHeader: 'Размер', type: 'text', required: false, aiFillable: true },
        { key: 'material', label: 'Material', excelHeader: 'Материал', type: 'text', required: false, aiFillable: true },
        { key: 'country', label: 'Ishlab chiqarilgan davlat', excelHeader: 'Страна производства', type: 'select', required: true, options: COUNTRIES, aiFillable: true },
        { key: 'warranty', label: 'Kafolat muddati', excelHeader: 'Гарантийный срок, мес.', type: 'number', required: false, min: 0, unit: 'oy' },
        { key: 'tnved', label: 'TN VED kodi', excelHeader: 'ТН ВЭД', type: 'text', required: false, hint: 'AI topa olmaydi' },
        {
          key: 'mxik',
          label: 'MXIK (IKPU) kodi',
          excelHeader: 'ИКПУ',
          type: 'text',
          required: false,
          // O'zbekiston kabinetida bu majburiy: usiz kartochka "Укажите код
          // товара как в едином национальном каталоге" xatosi bilan qoladi.
          // Rossiya kabinetida esa kerak emas, shuning uchun majburiy emas.
          hint: "O'zbekiston kabineti uchun majburiy — soliq.uz milliy katalogidagi kod",
        },
      ],
    },
    {
      key: 'package',
      label: 'Qadoq',
      fields: [
        { key: 'weight', label: "Brutto og'irlik", excelHeader: 'Вес брутто, кг', type: 'number', required: true, min: 0, unit: 'kg' },
        { key: 'packLength', label: 'Uzunlik', excelHeader: 'Длина, см', type: 'number', required: true, min: 1, unit: 'sm' },
        { key: 'packWidth', label: 'Kenglik', excelHeader: 'Ширина, см', type: 'number', required: true, min: 1, unit: 'sm' },
        { key: 'packHeight', label: 'Balandlik', excelHeader: 'Высота, см', type: 'number', required: true, min: 1, unit: 'sm' },
      ],
    },
  ],
};

// ============================================
// Reyestr va yordamchilar
// ============================================

export const MARKETPLACE_SPECS: Record<MarketplaceId, MarketplaceSpec> = {
  UZUM,
  OZON,
  WB,
  YANDEX,
};

export const MARKETPLACE_IDS: MarketplaceId[] = ['UZUM', 'OZON', 'WB', 'YANDEX'];

export function isMarketplaceId(value: string): value is MarketplaceId {
  return (MARKETPLACE_IDS as string[]).includes(value);
}

export function getSpec(id: string): MarketplaceSpec | null {
  return isMarketplaceId(id) ? MARKETPLACE_SPECS[id] : null;
}

export function allFields(spec: MarketplaceSpec): SpecField[] {
  return spec.groups.flatMap((g) => g.fields);
}

export function findField(spec: MarketplaceSpec, key: string): SpecField | undefined {
  return allFields(spec).find((f) => f.key === key);
}

/** Logo/rang kabi yengil ma'lumot — ro'yxat sahifasi uchun */
export function listSpecSummaries() {
  return MARKETPLACE_IDS.map((id) => {
    const spec = MARKETPLACE_SPECS[id];
    const fields = allFields(spec);
    return {
      id: spec.id,
      name: spec.name,
      logo: spec.logo,
      color: spec.color,
      currency: spec.currency,
      country: spec.country,
      docsUrl: spec.docsUrl,
      canPublishViaApi: spec.canPublishViaApi,
      fieldCount: fields.length,
      requiredCount: fields.filter((f) => f.required).length,
      image: spec.image,
    };
  });
}

export interface ValidationIssue {
  key: string;
  label: string;
  message: string;
}

/**
 * Forma qiymatlarini spec bo'yicha tekshirish.
 *
 * `forPublish` — API orqali joylashdan oldingi qat'iyroq tekshiruv: unda
 * `publishRequired` maydonlar (kategoriya ID'lari) ham majburiy bo'ladi.
 * Oddiy saqlash va Excel eksportida ular so'ralmaydi.
 */
/**
 * "M, L, XL" ni alohida o'lchamlarga ajratadi.
 *
 * WB da har o'lcham — ALOHIDA nomenklatura, o'z barkodi bilan. Hammasini
 * bitta katakka yozsak (avval shunday edi), WB bitta variant yasaydi va
 * kabinetda "Seller size: M, L, XL" bo'lib turadi: xaridor o'lchamni tanlay
 * olmaydi, qoldiq ham o'lchamlar bo'yicha yuritilmaydi.
 */
export function splitSizes(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,;/]/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .filter((part, i, all) => all.indexOf(part) === i)
    .slice(0, 30); // WB bitta kartochkada 30 tagacha nomenklatura
}

export function validateValues(
  spec: MarketplaceSpec,
  values: Record<string, any>,
  { forPublish = false }: { forPublish?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of allFields(spec)) {
    const raw = values[field.key];
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    const mustFill = field.required || (forPublish && field.publishRequired);

    if (empty) {
      if (mustFill) {
        issues.push({
          key: field.key,
          label: field.label,
          message: field.hidden
            ? "Kategoriyani katalogdan tanlang — ID shundan olinadi"
            : "To'ldirilishi shart",
        });
      }
      continue;
    }

    if (field.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        issues.push({ key: field.key, label: field.label, message: 'Son kiritilishi kerak' });
        continue;
      }
      if (field.min !== undefined && num < field.min) {
        issues.push({ key: field.key, label: field.label, message: `Kamida ${field.min}` });
      }
      if (field.max !== undefined && num > field.max) {
        issues.push({ key: field.key, label: field.label, message: `Ko'pi bilan ${field.max}` });
      }
      continue;
    }

    const text = String(raw);
    if (field.maxLength && text.length > field.maxLength) {
      issues.push({
        key: field.key,
        label: field.label,
        message: `${field.maxLength} belgidan oshmasin (hozir ${text.length})`,
      });
    }
    if (field.options && field.options.length && !field.options.includes(text)) {
      issues.push({
        key: field.key,
        label: field.label,
        message: `Ruxsat etilgan qiymatlardan tanlang`,
      });
    }
    if (field.pattern && !new RegExp(field.pattern).test(text.trim())) {
      issues.push({
        key: field.key,
        label: field.label,
        message: field.patternHint || "Format noto'g'ri",
      });
    }
  }

  return issues;
}
