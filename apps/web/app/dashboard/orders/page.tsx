'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Loader2,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { QueryError } from '@/components/QueryError';
import { SkeletonRows } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';
import { MARKETPLACE_INFO, MarketplaceId } from '@/components/listings/constants';
import { OrderActions } from '@/components/orders/OrderActions';
import { formatPrice, formatDate, formatDateTime } from '@/lib/utils';

interface OrderItem {
  sku: string;
  name?: string;
  qty: number;
  price?: number;
}

interface Order {
  id: string;
  marketplace: MarketplaceId;
  externalId: string;
  orderedAt: string | null;
  status: string | null;
  itemsCount: number;
  total: string;
  currency: string;
  items: OrderItem[];
}

interface Summary {
  days: number;
  marketplaces: Array<{
    marketplace: MarketplaceId;
    orders: number;
    revenue: string;
    currency: string;
    lastSync: { status: string; startedAt: string; error: string | null } | null;
  }>;
  statuses: Array<{ marketplace: MarketplaceId; status: string; count: number }>;
}

const DAY_OPTIONS = [
  { value: 7, label: '7 kun' },
  { value: 30, label: '30 kun' },
  { value: 90, label: '90 kun' },
  { value: 180, label: 'Yarim yil' },
  // Keshda yarim yildan eski buyurtmalar ham qolishi mumkin (marketplace ularni
  // qaytaraverса). Bu variant bo'lmasa ular bazada bor, lekin ko'rinmas edi.
  { value: 0, label: 'Butun tarix' },
];

/**
 * Buyurtma holati marketplace atamasi bilan keladi ("NEW", "Собран",
 * "CANCELED"). Ularni tarjima qilmaymiz — sotuvchi seller kabinetida
 * aynan shu so'zlarni ko'radi va moslikni yo'qotmasligi kerak.
 * Faqat rangi bilan ma'nosini bildiramiz.
 */
function statusTone(status?: string | null): string {
  const text = (status || '').toLowerCase();
  if (/cancel|отмен|bekor/.test(text)) return 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (/deliver|достав|yetkaz|complete|выполн/.test(text)) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  if (/new|нов|yangi|created/.test(text)) return 'bg-accent-soft text-accent';
  return 'bg-panel text-ink-soft';
}

export default function OrdersPage() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [marketplace, setMarketplace] = useState<MarketplaceId | 'ALL'>('ALL');
  const [status, setStatus] = useState<string>('');
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filtr o'zgarsa birinchi sahifaga qaytamiz — aks holda bo'sh sahifada qolib ketiladi
  useEffect(() => setPage(1), [marketplace, status, days, debounced]);

  const summaryQuery = useQuery({
    queryKey: ['orders-summary', currentOrgId, days],
    queryFn: async () =>
      (await api.get<Summary>('/orders/summary', { params: { days: days || undefined } })).data,
    enabled: !!currentOrgId,
  });

  const ordersQuery = useQuery({
    queryKey: ['orders', currentOrgId, marketplace, status, days, debounced, page],
    queryFn: async () =>
      (
        await api.get('/orders', {
          params: {
            page,
            limit: 30,
            days: days || undefined,
            marketplace: marketplace === 'ALL' ? undefined : marketplace,
            status: status || undefined,
            search: debounced || undefined,
          },
        })
      ).data as { items: Order[]; syncedAt: string | null; pagination: { totalPages: number; total: number } },
    enabled: !!currentOrgId,
    placeholderData: (prev) => prev,
  });

  const refresh = useMutation({
    mutationFn: async () => (await api.post('/sync/run')).data,
    onSuccess: () => {
      toast('success', 'Yangilandi');
      queryClient.invalidateQueries({ queryKey: ['orders', currentOrgId] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary', currentOrgId] });
    },
    onError: (err: any) =>
      toast('error', err.response?.data?.error || "Yangilab bo'lmadi"),
  });

  const orders = ordersQuery.data?.items ?? [];
  const syncedAt = ordersQuery.data?.syncedAt;
  const totalPages = ordersQuery.data?.pagination.totalPages ?? 1;

  // Tanlangan marketplace uchun mavjud holatlar
  const statuses = (summaryQuery.data?.statuses ?? [])
    .filter((s) => marketplace === 'ALL' || s.marketplace === marketplace)
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + s.count;
      return acc;
    }, {});

  const failedSyncs = (summaryQuery.data?.marketplaces ?? []).filter(
    (m) => m.lastSync && m.lastSync.status !== 'OK',
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Buyurtmalar</h1>
          <p className="text-muted mt-1">
            To&apos;rttala marketplace bitta ro&apos;yxatda
            {syncedAt && (
              <>
                {' · '}
                <span className="text-ink-soft">{formatDateTime(syncedAt)} holatiga</span>
              </>
            )}
          </p>
        </div>

        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="btn-ghost btn-sm disabled:opacity-50"
        >
          {refresh.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Marketplace&apos;lardan yangilash
        </button>
      </div>

      {ordersQuery.isError && (
        <QueryError error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} className="mb-4" />
      )}

      {/* Sinxronizatsiya muammolari — ro'yxat to'liq emasligini aytamiz */}
      {failedSyncs.length > 0 && (
        <div className="card p-4 mb-6 border-amber-500/40 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Ro&apos;yxat to&apos;liq bo&apos;lmasligi mumkin</p>
            <ul className="text-xs text-muted mt-1 space-y-0.5">
              {failedSyncs.map((m) => (
                <li key={m.marketplace}>
                  <b>{MARKETPLACE_INFO[m.marketplace]?.short ?? m.marketplace}</b> —{' '}
                  {m.lastSync?.error?.slice(0, 120) ?? 'oxirgi yangilash muvaffaqiyatsiz'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Marketplace bo'yicha kesim */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {(['UZUM', 'OZON', 'WB', 'YANDEX'] as MarketplaceId[]).map((mp) => {
          const row = summaryQuery.data?.marketplaces.find((m) => m.marketplace === mp);
          const active = marketplace === mp;
          return (
            <button
              key={mp}
              onClick={() => setMarketplace(active ? 'ALL' : mp)}
              className={`card p-4 text-left transition hover:-translate-y-0.5 ${
                active ? 'border-accent/50 shadow-card-hover' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <RemoteImage
                  src={MARKETPLACE_INFO[mp].logo}
                  alt=""
                  fit="contain"
                  sizes="28px"
                  className="w-7 h-7 rounded-lg bg-white/95 flex-shrink-0"
                />
                <span className="text-sm font-semibold truncate">{MARKETPLACE_INFO[mp].short}</span>
              </div>
              <p className="text-2xl font-bold leading-none">{row?.orders ?? 0}</p>
              <p className="text-xs text-muted mt-1.5">
                {row ? formatPrice(row.revenue, row.currency) : '—'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filtrlar */}
      <div className="card p-3 mb-4 flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buyurtma raqami yoki tovar nomi..."
            aria-label="Buyurtmalarni qidirish"
            className="w-full h-10 pl-10 pr-3 rounded-full border border-line bg-paper/70 text-sm placeholder:text-muted focus:outline-none focus:border-accent/50 transition"
          />
        </div>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Davr"
          className="h-10 px-3 rounded-full border border-line bg-paper text-sm focus:outline-none focus:border-accent/50"
        >
          {DAY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Holat"
          className="h-10 px-3 rounded-full border border-line bg-paper text-sm focus:outline-none focus:border-accent/50"
        >
          <option value="">Barcha holatlar</option>
          {Object.entries(statuses).map(([value, count]) => (
            <option key={value} value={value}>
              {value} ({count})
            </option>
          ))}
        </select>

        {(marketplace !== 'ALL' || status || search) && (
          <button
            onClick={() => {
              setMarketplace('ALL');
              setStatus('');
              setSearch('');
            }}
            className="text-sm text-accent hover:opacity-80 px-2"
          >
            Tozalash
          </button>
        )}
      </div>

      {/* Ro'yxat */}
      <div className="card overflow-hidden">
        {ordersQuery.isLoading ? (
          <SkeletonRows rows={6} />
        ) : orders.length === 0 ? (
          <EmptyState
            filtered={marketplace !== 'ALL' || !!status || !!debounced}
            onRefresh={() => refresh.mutate()}
            refreshing={refresh.isPending}
          />
        ) : (
          <div className="divide-y">
            {orders.map((order) => {
              const info = MARKETPLACE_INFO[order.marketplace];
              const open = expanded === order.id;

              return (
                <div key={order.id}>
                  <button
                    onClick={() => setExpanded(open ? null : order.id)}
                    className="w-full p-4 flex items-center gap-4 text-left transition hover:bg-panel"
                  >
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                    )}

                    <RemoteImage
                      src={info?.logo}
                      alt={info?.short ?? order.marketplace}
                      fit="contain"
                      sizes="32px"
                      className="w-8 h-8 rounded-lg bg-white/95 flex-shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate font-mono">#{order.externalId}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {order.orderedAt ? formatDate(order.orderedAt, 'long') : 'sana koʼrsatilmagan'}
                        {order.itemsCount > 0 && ` · ${order.itemsCount} ta pozitsiya`}
                      </p>
                    </div>

                    {order.status && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${statusTone(order.status)}`}
                      >
                        {order.status}
                      </span>
                    )}

                    <p className="font-semibold text-sm whitespace-nowrap tabular-nums">
                      {formatPrice(order.total, order.currency)}
                    </p>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 pl-16 space-y-3">
                      {/* Amallar — imkoniyatlar serverdan, tugmalar shunga qarab */}
                      <OrderActions
                        orderId={order.id}
                        marketplaceName={info?.short ?? order.marketplace}
                        externalId={order.externalId}
                        status={order.status}
                        onChanged={() => {
                          queryClient.invalidateQueries({ queryKey: ['orders', currentOrgId] });
                          queryClient.invalidateQueries({ queryKey: ['orders-summary', currentOrgId] });
                        }}
                      />

                      {order.items.length > 0 && (
                      <div className="rounded-[16px] border border-line bg-panel overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted text-left">
                              <th className="font-medium p-2.5">Tovar</th>
                              <th className="font-medium p-2.5">Artikul</th>
                              <th className="font-medium p-2.5 text-right">Soni</th>
                              <th className="font-medium p-2.5 text-right">Narx</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, i) => (
                              <tr key={`${item.sku}-${i}`} className="border-t border-line/60">
                                <td className="p-2.5">{item.name || '—'}</td>
                                <td className="p-2.5 font-mono text-muted">{item.sku || '—'}</td>
                                <td className="p-2.5 text-right tabular-nums">{item.qty}</td>
                                <td className="p-2.5 text-right tabular-nums whitespace-nowrap">
                                  {item.price !== undefined
                                    ? formatPrice(item.price, order.currency)
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-line">
            <span className="text-sm text-muted">
              {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                Oldingi
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost btn-sm disabled:opacity-40"
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

function EmptyState({
  filtered,
  onRefresh,
  refreshing,
}: {
  filtered: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="p-12 text-center">
      <ShoppingCart className="w-12 h-12 mx-auto text-muted/40 mb-3" />
      <p className="text-ink-soft mb-1">
        {filtered ? 'Bu filtrga mos buyurtma yo‘q' : 'Buyurtma topilmadi'}
      </p>
      {!filtered && (
        <>
          <p className="text-sm text-muted max-w-md mx-auto mb-4">
            Buyurtmalar marketplace&apos;lardan har 3 soatda o&apos;qib olinadi. Agar
            do&apos;konlaringizda yangi buyurtma bo&apos;lsa, hozir yangilang.
          </p>
          <button onClick={onRefresh} disabled={refreshing} className="btn-ghost btn-sm">
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Hozir yangilash
          </button>
        </>
      )}
    </div>
  );
}
