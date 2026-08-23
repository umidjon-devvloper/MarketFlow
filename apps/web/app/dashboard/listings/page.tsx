'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, Loader2, LayoutGrid, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ListingsWorkspace } from '@/components/listings/ListingsWorkspace';
import { MARKETPLACE_IDS, MARKETPLACE_INFO, MarketplaceId } from '@/components/listings/constants';
import { Skeleton, SkeletonPage } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';

interface ProductRow {
  id: string;
  title: string;
  sku?: string;
  images: Array<{ url: string }>;
  listings: Array<{ marketplace: MarketplaceId; status: string }>;
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<SkeletonPage label="Kartochkalar yuklanmoqda" />}>
      <ListingsPageInner />
    </Suspense>
  );
}

function ListingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);

  // Tanlangan mahsulot URL'da turadi — sahifani yangilaganda yo'qolmaydi
  const selectedId = searchParams.get('product');
  const [search, setSearch] = useState('');

  const productsQuery = useQuery({
    queryKey: ['listing-products', currentOrgId, search],
    queryFn: async () =>
      (await api.get('/products', { params: { limit: 50, search: search || undefined } })).data
        .items as ProductRow[],
    enabled: !!currentOrgId,
    placeholderData: (prev) => prev,
  });

  const products = productsQuery.data || [];
  const selected = products.find((p) => p.id === selectedId);

  const select = (id: string) => {
    router.replace(`/dashboard/listings?product=${id}`, { scroll: false });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Marketplace kartochkalari</h1>
        <p className="text-ink-soft mt-1">
          Mahsulotni tanlang — 4 ta marketplace uchun matnni bitta joyda tayyorlang
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Mahsulot tanlash */}
        <aside className="card overflow-hidden lg:sticky lg:top-4">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mahsulot qidirish..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-paper"
              />
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {productsQuery.isLoading ? (
              <div className="p-3 space-y-3" role="status" aria-label="Mahsulotlar yuklanmoqda">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-ink-soft mb-2">
                  {search ? 'Hech narsa topilmadi' : "Hozircha mahsulot yo'q"}
                </p>
                {!search && (
                  <Link
                    href="/dashboard/products"
                    className="text-sm text-accent hover:underline inline-flex items-center gap-1"
                  >
                    Mahsulot qo'shish <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              products.map((p) => (
                <ProductRowItem
                  key={p.id}
                  product={p}
                  active={p.id === selectedId}
                  onSelect={() => select(p.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Kartochkalar */}
        <div className="min-w-0">
          {selectedId ? (
            <>
              {selected && (
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-semibold truncate">{selected.title}</h2>
                  <Link
                    href={`/dashboard/products/${selected.id}`}
                    className="text-sm text-accent hover:underline flex-shrink-0"
                  >
                    Mahsulotni ochish
                  </Link>
                </div>
              )}
              <ListingsWorkspace key={selectedId} productId={selectedId} showTitle={false} />
            </>
          ) : (
            <div className="card p-12 text-center">
              <LayoutGrid className="w-12 h-12 mx-auto text-muted/50 mb-3" />
              <p className="text-ink-soft mb-1">Mahsulot tanlanmagan</p>
              <p className="text-sm text-muted">
                Chapdagi ro'yxatdan mahsulotni tanlang
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Ro'yxatdagi bitta mahsulot — qaysi marketplace'lar tayyorligi ko'rinib turadi */
function ProductRowItem({
  product,
  active,
  onSelect,
}: {
  product: ProductRow;
  active: boolean;
  onSelect: () => void;
}) {
  const done = new Set(product.listings.map((l) => l.marketplace));
  const image = product.images[0]?.url;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 flex gap-3 transition ${
        active ? 'bg-accent-soft' : 'hover:bg-panel'
      }`}
    >
      {image ? (
        <RemoteImage src={image} alt="" sizes="40px" className="w-10 h-10 rounded-lg flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-panel flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-muted" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm truncate ${active ? 'font-semibold text-accent' : 'font-medium'}`}>
          {product.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {MARKETPLACE_IDS.map((mp) => (
            <span
              key={mp}
              title={`${MARKETPLACE_INFO[mp].name}: ${done.has(mp) ? 'tayyor' : "yo'q"}`}
              className={`w-4 h-4 rounded overflow-hidden flex-shrink-0 ${
                done.has(mp) ? '' : 'opacity-25 grayscale'
              }`}
            >
              <RemoteImage src={MARKETPLACE_INFO[mp].logo} alt="" fit="contain" sizes="16px" className="w-full h-full" />
            </span>
          ))}
          <span className="text-[11px] text-muted ml-0.5">
            {done.size}/{MARKETPLACE_IDS.length}
          </span>
        </div>
      </div>
    </button>
  );
}
