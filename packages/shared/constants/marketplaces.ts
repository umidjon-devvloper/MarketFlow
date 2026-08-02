// Marketplace uchun umumiy konstantalar

export const MARKETPLACES = {
  UZUM: {
    id: 'UZUM',
    name: 'Uzum Market',
    country: 'UZ',
    currency: 'UZS',
    imageRequirements: {
      minWidth: 900,
      minHeight: 1200,
      maxSizeMB: 5,
      formats: ['jpg', 'jpeg', 'png'],
      background: 'white',
    },
    titleMaxLength: 200,
    descriptionMaxLength: 5000,
    commission: { min: 5, max: 25 }, // %
    apiSupported: true,
  },
  OZON: {
    id: 'OZON',
    name: 'Ozon',
    country: 'RU',
    currency: 'RUB',
    imageRequirements: {
      minWidth: 900,
      minHeight: 1200,
      maxSizeMB: 10,
      formats: ['jpg', 'jpeg', 'png'],
      background: 'white',
    },
    titleMaxLength: 200,
    descriptionMaxLength: 6000,
    commission: { min: 4, max: 22 },
    apiSupported: false, // hozircha CSV/qo'lda
  },
  WB: {
    id: 'WB',
    name: 'Wildberries',
    country: 'RU',
    currency: 'RUB',
    imageRequirements: {
      minWidth: 900,
      minHeight: 1200,
      maxSizeMB: 10,
      formats: ['jpg', 'jpeg'],
      background: 'white',
    },
    titleMaxLength: 60,
    descriptionMaxLength: 5000,
    commission: { min: 3, max: 25 },
    apiSupported: false,
  },
  YANDEX: {
    id: 'YANDEX',
    name: 'Yandex Market',
    country: 'RU',
    currency: 'RUB',
    imageRequirements: {
      minWidth: 700,
      minHeight: 700,
      maxSizeMB: 8,
      formats: ['jpg', 'jpeg', 'png'],
      background: 'white',
    },
    titleMaxLength: 150,
    descriptionMaxLength: 3000,
    commission: { min: 5, max: 20 },
    apiSupported: false,
  },
} as const;

export type MarketplaceId = keyof typeof MARKETPLACES;

export const CURRENCIES = {
  UZS: { symbol: 'so\'m', code: 'UZS' },
  RUB: { symbol: '₽', code: 'RUB' },
  USD: { symbol: '$', code: 'USD' },
} as const;

export const AI_JOB_TYPES = {
  BACKGROUND_REMOVE: 'BACKGROUND_REMOVE',
  UPSCALE: 'UPSCALE',
  OUTPAINT: 'OUTPAINT',
  ENHANCE: 'ENHANCE',
  GENERATE_WHITE_BG: 'GENERATE_WHITE_BG',
} as const;

export const LISTING_STATUS_LABELS = {
  DRAFT: 'Qoralama',
  PENDING: 'Tekshiruvda',
  PUBLISHED: 'Faol',
  REJECTED: 'Rad etilgan',
  PAUSED: 'To\'xtatilgan',
  ARCHIVED: 'Arxivlangan',
} as const;
