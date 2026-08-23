export type MarketplaceId = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';

export interface Listing {
  id: string;
  marketplace: MarketplaceId;
  status: string;
  title: string;
  description: string;
  seoKeywords?: string;
  price: string;
  discountPrice?: string;
}

export const MARKETPLACE_INFO: Record<MarketplaceId, { name: string; short: string; logo: string }> = {
  UZUM: { name: 'Uzum Market', short: 'Uzum', logo: '/logos/uzum.jpg' },
  OZON: { name: 'Ozon', short: 'Ozon', logo: '/logos/ozon.jpg' },
  WB: { name: 'Wildberries', short: 'WB', logo: '/logos/wildberries.jpg' },
  YANDEX: { name: 'Yandex Market', short: 'Yandex', logo: '/logos/yandex.jpg' },
};

export const MARKETPLACE_IDS: MarketplaceId[] = ['UZUM', 'OZON', 'WB', 'YANDEX'];

/** Server xatosidan foydalanuvchiga ko'rsatiladigan matn */
export function errorText(err: unknown): string {
  return (err as any)?.response?.data?.error || (err as Error)?.message || 'Xato yuz berdi';
}
