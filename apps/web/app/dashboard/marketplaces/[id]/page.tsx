'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  Boxes,
  DollarSign,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatPrice } from '@/lib/utils';

const MP_LABELS: Record<string, string> = {
  UZUM: 'Uzum Market',
  OZON: 'Ozon',
  WB: 'Wildberries',
  YANDEX: 'Yandex Market',
};

const MP_CURRENCY: Record<string, string> = {
  UZUM: 'UZS',
  OZON: 'RUB',
  WB: 'RUB',
  YANDEX: 'RUB',
};

interface MpProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  stock?: number;
  status?: string;
  image?: string;
}

interface MpOrder {
  id: string;
  date?: string;
  status?: string;
  itemsCount?: number;
  total?: number;
}

interface MpStock {
  sku: string;
  name?: string;
  amount: number;
  warehouse?: string;
}

const TABS = [
  { key: 'products', label: 'Mahsulotlar', icon: Package },
  { key: 'orders', label: 'Buyurtmalar', icon: ShoppingCart },
  { key: 'stocks', label: 'Qoldiqlar', icon: Boxes },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const PAGE_SIZE = 20;

export default function MarketplaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [tab, setTab] = useState<TabKey>('products');
  const [page, setPage] = useState(0);

  // Ulanish ma'lumotlari (nom, do'kon) — marketplaces ro'yxatidan
  const { data: credentials } = useQuery({
    queryKey: ['marketplaces', currentOrgId],
    queryFn: async () => (await api.get('/marketplaces')).data.items as any[],
    enabled: !!currentOrgId,
  });
  const cred = credentials?.find((c) => c.id === id);
  const mpLabel = cred ? MP_LABELS[cred.marketplace] || cred.marketplace : '';
  const currency = cred ? MP_CURRENCY[cred.marketplace] || '' : '';

  // 30 kunlik xulosa
  const summaryQuery = useQuery({
    queryKey: ['mp-summary', currentOrgId, id],
    queryFn: async () => (await api.get(`/marketplaces/${id}/summary?days=30`)).data,
    enabled: !!currentOrgId && !!id,
    staleTime: 5 * 60 * 1000,
  });

  const dataQuery = useQuery({
    queryKey: ['mp-data', currentOrgId, id, tab, page],
    queryFn: async () =>
      (await api.get(`/marketplaces/${id}/${tab}?page=${page}&size=${PAGE_SIZE}`)).data,
    enabled: !!currentOrgId && !!id,
    placeholderData: (prev) => prev, // sahifa almashganda eski jadval ko'rinib turadi
  });

  const items: any[] = dataQuery.data?.items || [];
  const total: number | undefined = dataQuery.data?.total;
  const hasNext = total !== undefined ? (page + 1) * PAGE_SIZE < total : items.length === PAGE_SIZE;

  const switchTab = (t: TabKey) => {
    setTab(t);
    setPage(0);
  };

  return (
    <div>
      <Link
        href="/dashboard/marketplaces"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Marketplace'lar
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{mpLabel || 'Marketplace'}</h1>
        {cred?.shopName && (
          <p className="text-slate-600 mt-1">
            Do'kon: {cred.shopName}
            {cred.shopId ? ` (ID: ${cred.shopId})` : ''}
          </p>
        )}
      </div>

      {/* 30 kunlik xulosa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Buyurtmalar (30 kun)</p>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {summaryQuery.isLoading ? '...' : summaryQuery.data?.orders ?? '—'}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Daromad (30 kun)</p>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {summaryQuery.isLoading
              ? '...'
              : summaryQuery.data
                ? formatPrice(summaryQuery.data.revenue, summaryQuery.data.currency)
                : '—'}
          </p>
        </div>
      </div>
      {summaryQuery.isError && (
        <p className="text-sm text-amber-600 -mt-4 mb-6 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {(summaryQuery.error as any)?.response?.status === 429
            ? "Marketplace so'rovlar limitiga yetdi — bir daqiqadan so'ng sahifani yangilang"
            : `Xulosani olib bo'lmadi: ${(summaryQuery.error as any)?.response?.data?.error || 'xato'}`}
        </p>
      )}

      {/* Tablar */}
      <div className="bg-white rounded-xl border">
        <div className="flex border-b">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {dataQuery.isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Yuklanmoqda...
          </div>
        ) : dataQuery.isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <p className="text-slate-700 font-medium mb-1">Ma'lumot olib bo'lmadi</p>
            <p className="text-sm text-slate-500">
              {(dataQuery.error as any)?.response?.data?.error ||
                (dataQuery.error as Error)?.message}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">Hozircha ma'lumot yo'q</div>
        ) : (
          <div className="overflow-x-auto">
            {tab === 'products' && <ProductsTable items={items} currency={currency} />}
            {tab === 'orders' && <OrdersTable items={items} currency={currency} />}
            {tab === 'stocks' && <StocksTable items={items} />}
          </div>
        )}

        {/* Sahifalash */}
        {(page > 0 || hasNext) && !dataQuery.isError && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Sahifa {page + 1}
              {total !== undefined ? ` — jami ${total} ta` : ''}
              {dataQuery.isFetching && ' · yangilanmoqda...'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Oldingi
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Keyingi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductsTable({ items, currency }: { items: MpProduct[]; currency: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="px-4 py-3 font-medium">Mahsulot</th>
          <th className="px-4 py-3 font-medium">SKU</th>
          <th className="px-4 py-3 font-medium text-right">Narx</th>
          <th className="px-4 py-3 font-medium text-right">Qoldiq</th>
          <th className="px-4 py-3 font-medium">Holat</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.map((p, i) => (
          <tr key={`${p.id}-${i}`} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                {p.image ? (
                  <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <span className="font-medium max-w-md truncate block">{p.name}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-slate-600">{p.sku || p.barcode || '—'}</td>
            <td className="px-4 py-3 text-right font-medium">
              {p.price !== undefined ? formatPrice(p.price, currency) : '—'}
            </td>
            <td className="px-4 py-3 text-right">{p.stock ?? '—'}</td>
            <td className="px-4 py-3">
              {p.status ? (
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                  {p.status}
                </span>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrdersTable({ items, currency }: { items: MpOrder[]; currency: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="px-4 py-3 font-medium">Buyurtma</th>
          <th className="px-4 py-3 font-medium">Sana</th>
          <th className="px-4 py-3 font-medium">Holat</th>
          <th className="px-4 py-3 font-medium text-right">Mahsulotlar</th>
          <th className="px-4 py-3 font-medium text-right">Summa</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.map((o, i) => (
          <tr key={`${o.id}-${i}`} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">{o.id}</td>
            <td className="px-4 py-3 text-slate-600">
              {o.date
                ? new Date(o.date).toLocaleDateString('uz-UZ', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'}
            </td>
            <td className="px-4 py-3">
              {o.status ? (
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                  {o.status}
                </span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-4 py-3 text-right">{o.itemsCount ?? '—'}</td>
            <td className="px-4 py-3 text-right font-medium">
              {o.total !== undefined ? formatPrice(o.total, currency) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StocksTable({ items }: { items: MpStock[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="px-4 py-3 font-medium">SKU</th>
          <th className="px-4 py-3 font-medium">Nomi</th>
          <th className="px-4 py-3 font-medium">Ombor</th>
          <th className="px-4 py-3 font-medium text-right">Qoldiq</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.map((s, i) => (
          <tr key={`${s.sku}-${i}`} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">{s.sku}</td>
            <td className="px-4 py-3 text-slate-600">{s.name || '—'}</td>
            <td className="px-4 py-3 text-slate-600">{s.warehouse || '—'}</td>
            <td className="px-4 py-3 text-right font-medium">{s.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
