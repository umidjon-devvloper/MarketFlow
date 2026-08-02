// Har bir marketplace uchun rasm o'lchamlari
export const IMAGE_DIMENSIONS = {
  UZUM: { width: 900, height: 1200, format: 'jpg' },
  OZON: { width: 900, height: 1200, format: 'jpg' },
  WB: { width: 900, height: 1200, format: 'jpg' },
  YANDEX: { width: 700, height: 700, format: 'jpg' },
} as const;

export const MARKETPLACE_NAMES = {
  UZUM: 'Uzum Market',
  OZON: 'Ozon',
  WB: 'Wildberries',
  YANDEX: 'Yandex Market',
} as const;

export const CURRENCIES = ['UZS', 'RUB', 'USD'] as const;
