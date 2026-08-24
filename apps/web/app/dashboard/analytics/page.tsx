'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  BarChart3,
  RefreshCw,
  Loader2,
  Trophy,
  Minus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { QueryError } from '@/components/QueryError';
import { RemoteImage } from '@/components/RemoteImage';
import { MARKETPLACE_INFO, MarketplaceId, MARKETPLACE_IDS } from '@/components/listings/constants';
import { formatPrice } from '@/lib/utils';
import { pivotByDate, marketplaceTotals, TrendRow } from '@/lib/trend';

interface Delta {
  current: number;
  previous: number;
  changePct: number | null;
}
interface Growth {
  days: number;
  orders: Delta;
  revenue: Record<string, Delta>;
}
interface TopProduct {
  key: string;
  sku?: string;
  name: string;
  marketplace: MarketplaceId;
  currency: string;
  qty: number;
  revenue: number;
  orderCount: number;
}

/** Brend ranglari — grafik chiziqlari uchun. Absolyut, ikkala temada ham ishlaydi. */
const MP_COLOR: Record<MarketplaceId, string> = {
  UZUM: '#7000FF',
  OZON: '#005BFF',
  WB: '#CB11AB',
  YANDEX: '#FC3F1D',
};

/**
 * Grafik "chrome" ranglari (o'q, to'r) — ataylab bitta neytral qiymat:
 * recharts CSS o'zgaruvchilarini oson qabul qilmaydi, bu kulrang esa
 * yorug' va qorong'i fonda ham o'qiladi.
 */
const AXIS = '#8b90a3';
const GRID = 'rgba(140,145,165,0.15)';

const DAYS = [
  { value: 7, label: '7 kun' },
  { value: 30, label: '30 kun' },
  { value: 90, label: '90 kun' },
];

export default function AnalyticsPage() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [days, setDays] = useState(30);
  const [revenueMp, setRevenueMp] = useState<MarketplaceId>('UZUM');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['trend', currentOrgId, days],
    queryFn: async () =>
      (await api.get('/sync/trend', { params: { days } })).data as {
        days: number;
        items: TrendRow[];
      },
    enabled: !!currentOrgId,
  });

  const rows = useMemo(() => data?.items ?? [], [data]);

  const { data: growth } = useQuery({
    queryKey: ['growth', currentOrgId, days],
    queryFn: async () => (await api.get<Growth>('/analytics/growth', { params: { days } })).data,
    enabled: !!currentOrgId,
  });

  const { data: topSelling } = useQuery({
    queryKey: ['top-selling', currentOrgId, days],
    queryFn: async () =>
      (await api.get('/analytics/top-selling', { params: { days, limit: 10 } })).data
        .products as TopProduct[],
    enabled: !!currentOrgId,
  });

  const totals = useMemo(() => marketplaceTotals(rows, MARKETPLACE_IDS), [rows]);
  const ordersData = useMemo(() => pivotByDate(rows, 'orders', MARKETPLACE_IDS), [rows]);
  const stockData = useMemo(() => pivotByDate(rows, 'totalStock', MARKETPLACE_IDS), [rows]);
  // Daromad faqat bitta bozor uchun — valyuta aralashmasligi kerak
  const revenueData = useMemo(() => pivotByDate(rows, 'revenue', [revenueMp]), [rows, revenueMp]);
  const revenueCurrency = totals.find((t) => t.marketplace === revenueMp)?.currency ?? 'UZS';

  const hasData = rows.length > 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Tahlil</h1>
          <p className="text-muted mt-1">
            Kunlik kesimlar asosida — buyurtma, daromad va qoldiq dinamikasi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-panel">
            {DAYS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDays(d.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  days === d.value ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Yangilash"
            className="w-9 h-9 rounded-full border border-line bg-paper flex items-center justify-center text-ink-soft transition hover:text-accent hover:border-accent/40 disabled:opacity-50"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isError && <QueryError error={error} onRetry={() => refetch()} className="mb-4" />}

      {/* O'sish — joriy oyna oldingi teng oynaga nisbatan */}
      {growth && (
        <div className="glass rounded-[22px] px-5 py-4 mb-6 grid grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-4">
          <KpiCell
            label={`Buyurtma (${days} kun)`}
            value={String(growth.orders.current)}
            delta={growth.orders.changePct}
          />
          {Object.entries(growth.revenue).map(([cur, d]) => (
            <KpiCell
              key={cur}
              label={`Daromad (${cur})`}
              value={formatPrice(d.current, cur)}
              delta={d.changePct}
            />
          ))}
        </div>
      )}

      {/* Marketplace kesimi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {totals.map((t) => (
          <div key={t.marketplace} className="card p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <RemoteImage
                src={MARKETPLACE_INFO[t.marketplace].logo}
                alt=""
                fit="contain"
                sizes="28px"
                className="w-7 h-7 rounded-lg bg-white/95 flex-shrink-0"
              />
              <span className="text-sm font-semibold truncate">
                {MARKETPLACE_INFO[t.marketplace].short}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <Metric icon={ShoppingCart} label="Buyurtma" value={String(t.orders)} />
              <Metric icon={Package} label="Qoldiq" value={String(t.latestStock)} />
              <div className="col-span-2 pt-2 border-t border-line">
                <p className="text-[11px] text-muted">Daromad ({t.currency})</p>
                <p className="font-semibold">{formatPrice(t.revenue, t.currency)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-[340px] animate-pulse" />
          <div className="card h-[340px] animate-pulse" />
        </div>
      ) : !hasData ? (
        <EmptyState onRefresh={() => refetch()} refreshing={isFetching} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard icon={ShoppingCart} title="Buyurtmalar" subtitle="Kuniga, marketplace bo‘yicha">
              <TrendChart data={ordersData} marketplaces={MARKETPLACE_IDS} />
            </ChartCard>

            <ChartCard icon={Package} title="Qoldiq" subtitle="Kesim kunidagi umumiy zaxira">
              <TrendChart data={stockData} marketplaces={MARKETPLACE_IDS} />
            </ChartCard>
          </div>

          {/* Daromad — bitta valyuta, aks holda taqqoslab bo'lmaydi */}
          <ChartCard
            icon={TrendingUp}
            title="Daromad"
            subtitle={`${MARKETPLACE_INFO[revenueMp].short} · ${revenueCurrency} (valyuta har xil bo‘lgani uchun bitta bozor)`}
            action={
              <div className="flex items-center gap-1">
                {MARKETPLACE_IDS.map((mp) => (
                  <button
                    key={mp}
                    onClick={() => setRevenueMp(mp)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      revenueMp === mp
                        ? 'text-white'
                        : 'text-muted hover:text-ink border border-line'
                    }`}
                    style={revenueMp === mp ? { background: MP_COLOR[mp] } : undefined}
                  >
                    {MARKETPLACE_INFO[mp].short}
                  </button>
                ))}
              </div>
            }
          >
            <TrendChart
              data={revenueData}
              marketplaces={[revenueMp]}
              formatValue={(v) => formatPrice(v, revenueCurrency)}
            />
          </ChartCard>

          {topSelling && topSelling.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-[18px] h-[18px]" />
                </span>
                <div>
                  <h2 className="font-semibold leading-tight">Eng ko&apos;p sotilganlar</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Buyurtma pozitsiyalari bo&apos;yicha (bekor qilinganlar hisobga olinmagan)
                  </p>
                </div>
              </div>

              <div className="divide-y">
                {topSelling.map((t, i) => (
                  <div key={t.key} className="py-2.5 flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-muted tabular-nums flex-shrink-0">
                      {i + 1}
                    </span>
                    <RemoteImage
                      src={MARKETPLACE_INFO[t.marketplace]?.logo}
                      alt=""
                      fit="contain"
                      sizes="24px"
                      className="w-6 h-6 rounded-md bg-white/95 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      {t.sku && <p className="text-[11px] text-muted font-mono truncate">{t.sku}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{t.qty} dona</p>
                      <p className="text-[11px] text-muted tabular-nums">
                        {formatPrice(t.revenue, t.currency)}
                      </p>
                    </div>
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

/** O'sish ko'rsatkichi — qiymat + oldingi davrga nisbatan foiz */
function KpiCell({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.8rem] text-muted truncate">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xl font-extrabold text-gradient leading-none">{value}</span>
        <DeltaBadge delta={delta} />
      </div>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  // Oldingi davr yo'q (null) — solishtirib bo'lmaydi, "yangi" deymiz
  if (delta === null) {
    return <span className="text-[11px] text-muted whitespace-nowrap">yangi</span>;
  }
  if (delta === 0) {
    return (
      <span className="text-[11px] text-muted inline-flex items-center gap-0.5">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`text-[11px] font-medium inline-flex items-center gap-0.5 whitespace-nowrap ${
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}
      {delta}%
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: typeof ShoppingCart;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
            <Icon className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-muted mt-0.5">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </div>
  );
}

function TrendChart({
  data,
  marketplaces,
  formatValue,
}: {
  data: Array<Record<string, number | string>>;
  marketplaces: MarketplaceId[];
  formatValue?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickFormatter={(d) => String(d).slice(5)}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          contentStyle={{
            background: 'rgb(var(--c-paper))',
            border: '1px solid rgb(var(--c-line))',
            borderRadius: 12,
            fontSize: 12,
            color: 'rgb(var(--c-ink))',
          }}
          formatter={((value: number, name: string) => [
            formatValue ? formatValue(Number(value)) : value,
            MARKETPLACE_INFO[name as MarketplaceId]?.short ?? name,
          ]) as never}
          labelFormatter={(d) => `Sana: ${d}`}
        />
        {marketplaces.length > 1 && (
          <Legend
            formatter={(name) => MARKETPLACE_INFO[name as MarketplaceId]?.short ?? name}
            wrapperStyle={{ fontSize: 12 }}
          />
        )}
        {marketplaces.map((mp) => (
          <Line
            key={mp}
            type="monotone"
            dataKey={mp}
            stroke={MP_COLOR[mp]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyState({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="card p-12 text-center">
      <BarChart3 className="w-12 h-12 mx-auto text-muted/40 mb-3" />
      <p className="text-ink-soft mb-1">Hali ma&apos;lumot yig&apos;ilmagan</p>
      <p className="text-sm text-muted max-w-md mx-auto mb-4">
        Kunlik kesimlar marketplace&apos;lardan har 3 soatda o&apos;qib olinadi va vaqt
        o&apos;tishi bilan trend to&apos;planadi. Hozir birinchi kesimni yig&apos;ish uchun
        yangilang.
      </p>
      <button onClick={onRefresh} disabled={refreshing} className="btn-ghost btn-sm">
        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Hozir yangilash
      </button>
    </div>
  );
}
