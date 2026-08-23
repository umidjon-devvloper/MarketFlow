'use client';

import Link from 'next/link';
import {
  Package,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Plus,
  ArrowRight,
  Store,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { QueryError } from '@/components/QueryError';
import { formatPrice } from '@/lib/utils';
import { RemoteImage } from '@/components/RemoteImage';

interface Overview {
  totals: {
    products: number;
    activeListings: number;
    draftListings: number;
    images: number;
    aiJobs: number;
  };
  marketplaceStats: Array<{
    marketplace: string;
    listings: number;
    revenue: string;
    sales: number;
    views: number;
  }>;
}

interface SpecSummary {
  id: 'UZUM' | 'OZON' | 'WB' | 'YANDEX';
  name: string;
  logo: string;
  color: string;
  currency: string;
  requiredCount: number;
}

interface Credential {
  marketplace: SpecSummary['id'];
  isActive: boolean;
}

// Tailwind dinamik klass nomlarini generatsiya qilmaydi — to'liq klasslar statik
const ICON_STYLES = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-accent-soft text-accent',
  orange: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const;

const MP_DESCRIPTIONS: Record<SpecSummary['id'], string> = {
  UZUM: "O'zbekistondagi eng yirik marketplace",
  OZON: "Rossiyaning yetakchi marketplace'i",
  WB: 'Mashhur onlayn savdo platformasi',
  YANDEX: 'Yandex ekotizimidagi savdo platformasi',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics-overview', currentOrgId],
    queryFn: async () => (await api.get<Overview>('/analytics/overview')).data,
    enabled: !!currentOrgId,
  });

  const { data: specs = [] } = useQuery({
    queryKey: ['card-specs'],
    queryFn: async () => (await api.get('/cards/specs')).data.items as SpecSummary[],
    enabled: !!currentOrgId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: credentials = [] } = useQuery({
    queryKey: ['marketplaces', currentOrgId],
    queryFn: async () => (await api.get('/marketplaces')).data.items as Credential[],
    enabled: !!currentOrgId,
  });

  const totalSales = data?.marketplaceStats.reduce((sum, s) => sum + s.sales, 0) ?? 0;
  const totalRevenue =
    data?.marketplaceStats.reduce((sum, s) => sum + Number(s.revenue), 0) ?? 0;

  const cards = [
    { label: 'Jami mahsulotlar', value: data?.totals.products ?? 0, icon: Package, color: 'blue' as const },
    { label: 'Faol kartochkalar', value: data?.totals.activeListings ?? 0, icon: TrendingUp, color: 'green' as const },
    { label: 'Jami sotuvlar', value: totalSales, icon: ShoppingCart, color: 'purple' as const },
    { label: 'Daromad', value: formatPrice(totalRevenue), icon: DollarSign, color: 'orange' as const },
  ];

  const quickActions = [
    {
      href: '/dashboard/products',
      title: "Kartochka yaratish",
      subtitle: 'Marketplace tanlab boshlang',
      icon: Package,
      color: 'blue' as const,
    },
    {
      href: '/dashboard/marketplaces',
      title: 'Marketplace ulash',
      subtitle: 'API kalitlarni sozlang',
      icon: Store,
      color: 'green' as const,
    },
    {
      href: '/dashboard/products',
      title: 'Mahsulotlarim',
      subtitle: "Barcha kartochkalarni ko'ring",
      icon: LayoutGrid,
      color: 'purple' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {isError && <QueryError error={error} onRetry={() => refetch()} />}

      {/* Salomlashuv */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 backdrop-blur px-3.5 py-1.5 text-[0.74rem] font-medium text-ink-soft shadow-soft mb-4">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            AI yordamchisi yoqilgan
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          </span>
          <h1 className="text-[32px] font-bold tracking-tight leading-tight">
            Salom, <span className="text-gradient">{user?.fullName}</span>! 👋
          </h1>
          <p className="text-ink-soft mt-1.5">MarketFlow boshqaruv paneliga xush kelibsiz</p>
        </div>
        <Link href="/dashboard/products" className="btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          Yangi kartochka
        </Link>
      </div>

      {/* Statistika — landing sahifadagi metrics strip uslubida */}
      <div className="glass rounded-[26px] px-6 md:px-8 py-7 grid grid-cols-2 lg:grid-cols-4 gap-y-7 gap-x-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`flex items-center gap-4 ${index > 0 ? 'lg:border-l lg:border-line lg:pl-8' : ''}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${ICON_STYLES[card.color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[2rem] font-extrabold leading-none text-gradient">
                  {isLoading ? (
                    <span className="inline-block w-16 h-7 bg-panel rounded animate-pulse align-middle" />
                  ) : (
                    card.value
                  )}
                </div>
                <div className="text-[0.82rem] text-muted mt-1.5 truncate">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tez amallar */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Tez amallar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-center gap-3 p-4 rounded-[18px] border border-line bg-paper transition hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${ICON_STYLES[action.color]}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{action.title}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">{action.subtitle}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Marketplace'lar */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Marketplace'lar</h2>
          <Link
            href="/dashboard/marketplaces"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80"
          >
            Barchasini ko'rish
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {specs.map((spec) => {
            const connected = credentials.some((c) => c.marketplace === spec.id && c.isActive);
            const stat = data?.marketplaceStats.find((s) => s.marketplace === spec.id);

            return (
              <Link
                key={spec.id}
                href={`/dashboard/products/new/${spec.id.toLowerCase()}`}
                className="card p-5 group hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="flex items-center gap-3">
                  {/* Brend rangidagi kichik plitka — logo o'rtasida */}
                  <span
                    className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${spec.color} 0%, ${spec.color}cc 100%)` }}
                  >
                    <RemoteImage
                      src={spec.logo}
                      alt={spec.name}
                      fit="contain"
                      sizes="36px"
                      className="w-9 h-9 rounded-[10px] bg-white/95"
                    />
                  </span>

                  <div className="min-w-0">
                    <p className="font-semibold leading-tight truncate">{spec.name}</p>
                    {/* Ulanish holati alohida nishon emas, shu qatorda — nomga to'liq joy qolsin */}
                    <p className="text-[11px] mt-0.5 flex items-center gap-1.5">
                      <span className="text-muted">{spec.currency}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          connected ? 'bg-emerald-500' : 'bg-muted/40'
                        }`}
                      />
                      <span className={connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}>
                        {connected ? 'Ulangan' : 'Ulanmagan'}
                      </span>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted mt-3 line-clamp-2 min-h-[32px]">
                  {MP_DESCRIPTIONS[spec.id]}
                </p>

                <div className="flex items-end justify-between mt-4 pt-3 border-t border-line">
                  <div>
                    <p className="text-[11px] text-muted">Kartochkalar</p>
                    <p className="font-semibold">{stat?.listings ?? 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted">Maydonlar</p>
                    <p className="font-semibold text-accent">{spec.requiredCount}</p>
                  </div>
                </div>
              </Link>
            );
          })}

          {specs.length === 0 &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-[210px] animate-pulse" />
            ))}
        </div>

        <Link
          href="/dashboard/marketplaces"
          className="mt-4 flex items-center justify-center gap-2 py-3.5 rounded-full border border-dashed border-line text-sm font-medium text-muted transition hover:border-accent/50 hover:text-accent"
        >
          <Plus className="w-4 h-4" />
          Marketplace API kalitini qo'shish
        </Link>
      </div>
    </div>
  );
}
