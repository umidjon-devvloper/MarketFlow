'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Store,
  Sparkles,
  AlertTriangle,
  Loader2,
  Plug,
  Wallet,
  Boxes,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatPrice } from '@/lib/utils';

const COLORS: Record<string, string> = {
  UZUM: '#9333ea',
  OZON: '#2563eb',
  WB: '#ec4899',
  YANDEX: '#eab308',
};

const MP_LABELS: Record<string, string> = {
  UZUM: 'Uzum Market',
  OZON: 'Ozon',
  WB: 'Wildberries',
  YANDEX: 'Yandex Market',
};

interface TopProduct {
  sku: string;
  name?: string;
  qty: number;
  revenue: number;
  share: number;
}

interface Insights {
  marketplace: string;
  currency: string;
  periodDays: number;
  totals: {
    orders: number;
    revenue: number;
    avgOrder: number;
    cancelled: number;
    itemsSold: number;
  };
  trend: { ordersPct: number | null; revenuePct: number | null };
  daily: { date: string; orders: number; revenue: number }[];
  topProducts: TopProduct[];
  slowMovers: TopProduct[];
  outOfStock: { sku: string; name?: string; amount: number }[];
  lowStock: { sku: string; name?: string; amount: number }[];
  productsTotal: number | null;
  warnings: string[];
}

interface Advice {
  summary: string;
  bestSellers: string;
  problems: string[];
  recommendations: { title: string; detail: string; priority: 'high' | 'medium' | 'low' }[];
}

export default function AnalyticsPage() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ulangan marketplace'lar — sahifaning butun mazmuni shularga bog'liq
  const credsQuery = useQuery({
    queryKey: ['marketplaces', currentOrgId],
    queryFn: async () => (await api.get('/marketplaces')).data.items as any[],
    enabled: !!currentOrgId,
  });

  const connected = (credsQuery.data || []).filter((c) => c.isActive);

  // Birinchi ulangan marketplace avtomatik tanlanadi
  useEffect(() => {
    if (!selectedId && connected.length) setSelectedId(connected[0].id);
  }, [connected, selectedId]);

  const selected = connected.find((c) => c.id === selectedId);

  const insightsQuery = useQuery<Insights>({
    queryKey: ['mp-insights', currentOrgId, selectedId, days],
    queryFn: async () => (await api.get(`/marketplaces/${selectedId}/insights?days=${days}`)).data,
    enabled: !!currentOrgId && !!selectedId,
    staleTime: 5 * 60 * 1000,
  });

  const adviceMutation = useMutation<Advice>({
    mutationFn: async () =>
      (await api.post(`/marketplaces/${selectedId}/advice?days=${days}`)).data.advice,
  });

  // Marketplace yoki davr almashsa — eski tavsiya o'chadi
  useEffect(() => {
    adviceMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, days]);

  if (credsQuery.isLoading) return <div className="text-slate-500">Yuklanmoqda...</div>;

  // ── Hech qanday marketplace ulanmagan: orqa fon blur + katta chaqiruv
  if (!connected.length) {
    return <NotConnected />;
  }

  const data = insightsQuery.data;
  const currency = data?.currency || '';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Analitika</h1>
          <p className="text-slate-600 mt-1">
            {selected ? MP_LABELS[selected.marketplace] || selected.marketplace : ''} bo'yicha real
            savdo ma'lumotlari
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value={7}>7 kun</option>
          <option value={30}>30 kun</option>
          <option value={90}>90 kun</option>
        </select>
      </div>

      {/* Marketplace tanlagich */}
      <div className="flex flex-wrap gap-2 mb-6">
        {connected.map((c) => {
          const active = c.id === selectedId;
          const color = COLORS[c.marketplace] || '#64748b';
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                active ? 'text-white' : 'bg-white text-slate-700 hover:border-slate-400'
              }`}
              style={active ? { background: color, borderColor: color } : undefined}
            >
              {MP_LABELS[c.marketplace] || c.marketplace}
              {c.shopName ? <span className="opacity-70"> · {c.shopName}</span> : null}
            </button>
          );
        })}
      </div>

      {insightsQuery.isLoading && (
        <div className="bg-white border rounded-xl p-12 text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          Marketplace'dan ma'lumot yig'ilyapti...
        </div>
      )}

      {insightsQuery.isError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {(insightsQuery.error as any)?.response?.data?.error || "Ma'lumot olib bo'lmadi"}
        </div>
      )}

      {data && (
        <>
          {/* Statistika kartalari */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Wallet}
              label={`Daromad (${days} kun)`}
              value={formatPrice(data.totals.revenue, currency)}
              trend={data.trend.revenuePct}
              color="green"
            />
            <StatCard
              icon={ShoppingCart}
              label="Buyurtmalar"
              value={String(data.totals.orders)}
              trend={data.trend.ordersPct}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="O'rtacha chek"
              value={formatPrice(data.totals.avgOrder, currency)}
              color="purple"
            />
            <StatCard
              icon={Package}
              label="Sotilgan dona"
              value={String(data.totals.itemsSold)}
              sub={data.totals.cancelled ? `${data.totals.cancelled} ta bekor qilingan` : undefined}
              color="orange"
            />
          </div>

          {data.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="w-4 h-4" />
                Ma'lumotdagi kamchiliklar
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI tavsiya */}
          <AdviceBlock
            advice={adviceMutation.data}
            isPending={adviceMutation.isPending}
            error={(adviceMutation.error as any)?.response?.data?.error}
            onRun={() => adviceMutation.mutate()}
            marketplace={selected ? MP_LABELS[selected.marketplace] : ''}
          />

          {/* Kunlik daromad */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h2 className="font-semibold mb-4">Kunlik daromad</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis stroke="#94a3b8" fontSize={11} width={70} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  formatter={((v: any) => formatPrice(v, currency)) as any}
                />
                <Bar
                  dataKey="revenue"
                  name="Daromad"
                  fill={COLORS[data.marketplace] || '#8b5cf6'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Eng ko'p sotilganlar */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold mb-1">Eng ko'p ketayotgan mahsulotlar</h2>
              <p className="text-xs text-slate-500 mb-4">Sotilgan dona bo'yicha</p>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Bu davrda sotuv qayd etilmagan
                </p>
              ) : (
                <div className="divide-y">
                  {data.topProducts.map((p, i) => (
                    <div key={p.sku || i} className="py-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{p.name || p.sku}</p>
                        <p className="text-xs text-slate-500">
                          {p.qty} dona
                          {p.share ? ` · daromadning ${p.share}%` : ''}
                        </p>
                      </div>
                      {p.revenue > 0 && (
                        <p className="text-sm font-semibold shrink-0">
                          {formatPrice(p.revenue, currency)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Qoldiq ogohlantirishlari */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Boxes className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold">Qoldiq bilan bog'liq xavflar</h2>
              </div>
              {data.outOfStock.length === 0 && data.lowStock.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Qoldiqlar joyida — muammo yo'q
                </p>
              ) : (
                <div className="space-y-4">
                  {data.outOfStock.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-2">
                        Tugagan ({data.outOfStock.length})
                      </p>
                      <ul className="text-sm space-y-1">
                        {data.outOfStock.slice(0, 6).map((s, i) => (
                          <li key={i} className="truncate text-slate-700">
                            {s.name || s.sku}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.lowStock.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-600 mb-2">
                        Kam qolgan ({data.lowStock.length})
                      </p>
                      <ul className="text-sm space-y-1">
                        {data.lowStock.slice(0, 6).map((s, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate text-slate-700">{s.name || s.sku}</span>
                            <span className="text-slate-500 shrink-0">{s.amount} dona</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sekin ketayotganlar */}
          {data.slowMovers.length > 0 && (
            <div className="bg-white rounded-xl border p-6 mt-6">
              <h2 className="font-semibold mb-1">Sekin ketayotgan mahsulotlar</h2>
              <p className="text-xs text-slate-500 mb-4">
                Bularga reklama, narx yoki kartochka ustida ishlash kerak
              </p>
              <div className="flex flex-wrap gap-2">
                {data.slowMovers.map((p, i) => (
                  <span
                    key={p.sku || i}
                    className="text-sm bg-slate-50 border rounded-lg px-3 py-1.5 text-slate-700"
                  >
                    {p.name || p.sku} · {p.qty} dona
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==================== AI TAVSIYA ====================

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Muhim',
  medium: "O'rtacha",
  low: 'Keyinroq',
};

function AdviceBlock({
  advice,
  isPending,
  error,
  onRun,
  marketplace,
}: {
  advice?: Advice;
  isPending: boolean;
  error?: string;
  onRun: () => void;
  marketplace: string;
}) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <div>
            <h2 className="font-semibold">AI savdo maslahatchisi</h2>
            <p className="text-xs text-slate-600">
              {marketplace} statistikasi asosida savdoni oshirish tavsiyalari
            </p>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={isPending}
          className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Tahlil qilinmoqda...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {advice ? 'Qayta tahlil qilish' : 'Tavsiya olish'}
            </>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!advice && !isPending && !error && (
        <p className="text-sm text-slate-600">
          Tugmani bosing — AI sizning raqamlaringizni tahlil qilib, nima yaxshi ketayotganini va
          savdoni oshirish uchun aniq nima qilish kerakligini aytadi.
        </p>
      )}

      {advice && (
        <div className="space-y-4">
          {advice.summary && (
            <div className="bg-white/70 rounded-lg p-4">
              <p className="text-sm text-slate-800">{advice.summary}</p>
            </div>
          )}

          {advice.bestSellers && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                Nima ko'p ketyapti
              </p>
              <p className="text-sm text-slate-800">{advice.bestSellers}</p>
            </div>
          )}

          {advice.problems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Muammolar</p>
              <ul className="text-sm text-slate-800 list-disc pl-5 space-y-1">
                {advice.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {advice.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Tavsiyalar</p>
              <div className="space-y-2">
                {advice.recommendations.map((r, i) => (
                  <div key={i} className="bg-white rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${
                          PRIORITY_STYLES[r.priority]
                        }`}
                      >
                        {PRIORITY_LABELS[r.priority]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== ULANMAGAN HOLAT ====================

/** Orqa fonda "namuna" analitika ko'rinadi, ustidan blur va chaqiruv oynasi */
function NotConnected() {
  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-60" aria-hidden>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Analitika</h1>
          <p className="text-slate-600 mt-1">Marketplace bo'yicha real savdo ma'lumotlari</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Daromad', value: '48 500 000 UZS' },
            { label: 'Buyurtmalar', value: '312' },
            { label: "O'rtacha chek", value: '155 000 UZS' },
            { label: 'Sotilgan dona', value: '408' },
          ].map((s) => (
            <div key={s.label} className="bg-white p-5 rounded-xl border">
              <p className="text-sm text-slate-600 mb-2">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-6 h-64" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white border shadow-xl rounded-2xl p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Plug className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold mb-2">Avval marketplace'laringizni ulang</h2>
          <p className="text-slate-600 text-sm mb-6">
            Analitika real savdo ma'lumotlari asosida ishlaydi. Uzum, Wildberries, Ozon yoki Yandex
            Market kalitini ulang — shundan keyin daromad, buyurtmalar va AI tavsiyalari shu yerda
            paydo bo'ladi.
          </p>
          <Link
            href="/dashboard/marketplaces"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700"
          >
            <Store className="w-4 h-4" />
            Marketplace ulash
          </Link>
        </div>
      </div>
    </div>
  );
}

// ==================== STAT CARD ====================
// Tailwind dinamik klasslarni (`bg-${color}-50`) generatsiya qilmaydi —
// to'liq klasslar statik yozilgan.
const STAT_STYLES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-purple-50 text-purple-600',
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  color: string;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-600">{label}</p>
        <div className={`p-2 rounded-lg ${STAT_STYLES[color] || STAT_STYLES.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold truncate">{value}</p>
      {typeof trend === 'number' && (
        <p
          className={`text-xs mt-1 flex items-center gap-1 ${
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend > 0 ? '+' : ''}
          {trend}% oldingi davrga nisbatan
        </p>
      )}
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
