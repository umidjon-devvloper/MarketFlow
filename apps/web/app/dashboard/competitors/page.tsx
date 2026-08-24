'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  Link2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { QueryError } from '@/components/QueryError';
import { SkeletonRows } from '@/components/Skeleton';
import { MARKETPLACE_INFO, MarketplaceId, errorText } from '@/components/listings/constants';
import { formatPrice, formatDateTime } from '@/lib/utils';

type Verdict = 'cheaper' | 'pricier' | 'same' | 'incomparable';

interface Comparison {
  verdict: Verdict;
  diffPct: number | null;
  reason?: string;
}

interface Watch {
  id: string;
  url: string;
  label: string | null;
  marketplace: MarketplaceId;
  lastPrice: number | null;
  lastCurrency: string | null;
  lastTitle: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  history: Array<{ date: string; price: number }>;
  product: { id: string; title: string } | null;
  ownPrice: number | null;
  ownCurrency: string | null;
  comparison?: Comparison;
}

interface ProductLite {
  id: string;
  title: string;
}

/** POST /competitors/:id/check javobining shakli (ro'yxatdagi Watch'dan farqli) */
interface CheckResult {
  id: string;
  ok: boolean;
  price?: number;
  currency?: string;
  title?: string;
  error?: string;
  priceDropped?: boolean;
  dropPct?: number;
}

export default function CompetitorsPage() {
  const { currentOrgId } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [productId, setProductId] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['competitors', currentOrgId],
    queryFn: async () => (await api.get('/competitors')).data as { watches: Watch[] },
    enabled: !!currentOrgId,
  });

  // Mahsulotga bog'lash uchun ro'yxat (ixtiyoriy)
  const { data: productsData } = useQuery({
    queryKey: ['products-lite', currentOrgId],
    queryFn: async () => (await api.get('/products', { params: { limit: 100 } })).data,
    enabled: !!currentOrgId,
  });
  const products: ProductLite[] = productsData?.items || [];

  const watches = data?.watches || [];

  const addMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/competitors', {
          url: url.trim(),
          label: label.trim() || undefined,
          productId: productId || undefined,
        })
      ).data,
    onSuccess: (res) => {
      setUrl('');
      setLabel('');
      setProductId('');
      queryClient.invalidateQueries({ queryKey: ['competitors', currentOrgId] });
      if (res?.firstCheck?.ok) {
        toast('success', `Qo'shildi — narx o'qildi: ${formatPrice(res.firstCheck.price, res.firstCheck.currency)}`);
      } else if (res?.firstCheck?.error) {
        toast('success', `Qo'shildi, lekin narx o'qilmadi: ${res.firstCheck.error}`);
      } else {
        toast('success', "Kuzatuvga qo'shildi");
      }
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const checkAllMutation = useMutation({
    mutationFn: async () => (await api.post('/competitors/check')).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['competitors', currentOrgId] });
      const dropped = res?.dropped
        ? ` — ${res.dropped} ta arzonlashdi`
        : '';
      toast('success', `${res?.checked ?? 0} ta narx yangilandi${dropped}`);
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const checkOneMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/competitors/${id}/check`)).data,
    onMutate: (id) => setCheckingId(id),
    onSettled: () => setCheckingId(null),
    onSuccess: (res: CheckResult) => {
      queryClient.invalidateQueries({ queryKey: ['competitors', currentOrgId] });
      if (res.ok && res.price != null) {
        const drop = res.priceDropped ? ` ↓ ${res.dropPct}% arzonlashdi` : '';
        toast('success', `Narx: ${formatPrice(res.price, res.currency)}${drop}`);
      } else {
        toast('error', res.error || "Narx o'qilmadi");
      }
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/competitors/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors', currentOrgId] });
      toast('success', "Kuzatuvdan o'chirildi");
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const setPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) =>
      (await api.patch(`/competitors/${id}/price`, { price })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors', currentOrgId] });
      toast('success', 'Narx saqlandi');
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const canAdd = url.trim().length > 8 && !addMutation.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Raqobatchi narxlari</h1>
            <p className="text-sm text-gray-500">
              Raqobatchi mahsulot havolasini kuzatib, narx o'zgarishini kuzating
            </p>
          </div>
        </div>
        <button
          onClick={() => checkAllMutation.mutate()}
          disabled={checkAllMutation.isPending || watches.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          {checkAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Hammasini tekshirish
        </button>
      </div>

      {/* Qo'shish formasi */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canAdd) addMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Raqobatchi mahsulot havolasi
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://uzum.uz/uz/product/..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              Uzum, Wildberries, Ozon yoki Yandex Market havolasi
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nom (ixtiyoriy)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Masalan: Asosiy raqobatchi"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                O'z mahsulotim bilan solishtirish (ixtiyoriy)
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">— tanlanmagan —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Qo'shish
            </button>
          </div>
        </form>
      </div>

      {/* Ro'yxat */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
          <SkeletonRows rows={4} />
        </div>
      ) : error ? (
        <QueryError error={error} onRetry={refetch} />
      ) : watches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Tag className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Hali kuzatuv yo'q</p>
          <p className="text-sm text-gray-500">
            Yuqoridagi maydonga raqobatchi mahsulot havolasini qo'shing
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {watches.map((w) => (
            <WatchCard
              key={w.id}
              watch={w}
              checking={checkingId === w.id}
              onCheck={() => checkOneMutation.mutate(w.id)}
              onSetPrice={(price) => setPriceMutation.mutate({ id: w.id, price })}
              savingPrice={setPriceMutation.isPending}
              onDelete={() => {
                if (confirm("Bu kuzatuvni o'chirasizmi?")) deleteMutation.mutate(w.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WatchCard({
  watch,
  checking,
  onCheck,
  onSetPrice,
  savingPrice,
  onDelete,
}: {
  watch: Watch;
  checking: boolean;
  onCheck: () => void;
  onSetPrice: (price: number) => void;
  savingPrice: boolean;
  onDelete: () => void;
}) {
  const mp = MARKETPLACE_INFO[watch.marketplace];
  const title = watch.label || watch.lastTitle || 'Raqobatchi mahsuloti';
  const currency = watch.marketplace === 'UZUM' ? 'UZS' : 'RUB';

  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const saveManual = () => {
    const num = Number(input.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return;
    onSetPrice(num);
    setEditing(false);
    setInput('');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {mp.short}
            </span>
            {watch.product && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                <Link2 className="h-3 w-3" />
                {watch.product.title}
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-gray-900">{title}</h3>
          <a
            href={watch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-gray-400 hover:text-indigo-600"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{watch.url}</span>
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onCheck}
            disabled={checking}
            title="Hozir tekshirish"
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            title="O'chirish"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-6">
          {/* Raqobatchi narxi */}
          <div>
            <p className="text-xs text-gray-400">Raqobatchi narxi</p>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveManual();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  placeholder={`narx, ${currency}`}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
                />
                <button
                  onClick={saveManual}
                  disabled={savingPrice}
                  className="rounded-md bg-indigo-600 p-1.5 text-white hover:bg-indigo-700 disabled:opacity-50"
                  title="Saqlash"
                >
                  {savingPrice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
                  title="Bekor qilish"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {watch.lastPrice != null ? (
                  <p className="text-lg font-semibold text-gray-900">
                    {formatPrice(watch.lastPrice, watch.lastCurrency || undefined)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">— o'qilmadi —</p>
                )}
                <button
                  onClick={() => {
                    setInput(watch.lastPrice != null ? String(watch.lastPrice) : '');
                    setEditing(true);
                  }}
                  className="rounded p-1 text-gray-300 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Narxni qo'lda kiritish"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* O'z narxi */}
          {watch.ownPrice != null && (
            <div>
              <p className="text-xs text-gray-400">Mening narxim</p>
              <p className="text-lg font-medium text-gray-600">
                {formatPrice(watch.ownPrice, watch.ownCurrency || undefined)}
              </p>
            </div>
          )}
        </div>

        {/* Taqqoslash */}
        {watch.comparison && <VerdictBadge comparison={watch.comparison} />}
      </div>

      {/* Narx tarixi */}
      {watch.history?.length > 1 && (
        <div className="mt-3">
          <Sparkline points={watch.history.map((h) => h.price)} />
        </div>
      )}

      {/* Xato / oxirgi tekshiruv */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
        <span>
          {watch.lastCheckedAt
            ? `Oxirgi tekshiruv: ${formatDateTime(watch.lastCheckedAt)}`
            : 'Hali tekshirilmagan'}
        </span>
        {watch.lastError && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {watch.lastError}
          </span>
        )}
      </div>
    </div>
  );
}

function VerdictBadge({ comparison }: { comparison: Comparison }) {
  const { verdict, diffPct, reason } = comparison;

  if (verdict === 'incomparable') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        Taqqoslab bo'lmaydi{reason ? ` (${reason})` : ''}
      </span>
    );
  }
  if (verdict === 'same') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        <Minus className="h-3 w-3" /> Narx teng
      </span>
    );
  }
  if (verdict === 'cheaper') {
    // Raqobatchi arzon — biz uchun yomon (qizil)
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
        <TrendingDown className="h-3 w-3" />
        Raqobatchi {Math.abs(diffPct ?? 0)}% arzon
      </span>
    );
  }
  // pricier — raqobatchi qimmat, biz uchun yaxshi (yashil)
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
      <TrendingUp className="h-3 w-3" />
      Raqobatchi {diffPct ?? 0}% qimmat
    </span>
  );
}

/** Kichik narx tarixi grafigi (recharts'siz — yengil inline SVG) */
function Sparkline({ points }: { points: number[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const w = 240;
    const h = 36;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const step = w / (points.length - 1);
    const d = points
      .map((p, i) => {
        const x = i * step;
        const y = h - ((p - min) / span) * (h - 4) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    // Oxirgi narx birinchisidan past bo'lsa qizil (tushish), aks holda ko'k
    const down = points[points.length - 1] < points[0];
    return { d, down, w, h };
  }, [points]);

  if (!path) return null;

  return (
    <svg width={path.w} height={path.h} className="max-w-full" viewBox={`0 0 ${path.w} ${path.h}`}>
      <path
        d={path.d}
        fill="none"
        stroke={path.down ? '#dc2626' : '#4f46e5'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
