'use client';

import Link from 'next/link';
import { Package, TrendingUp, ShoppingCart, DollarSign, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatPrice } from '@/lib/utils';

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

// Tailwind dinamik klass nomlarini (`bg-${color}-50`) generatsiya qilmaydi —
// shuning uchun to'liq klasslar statik yozilgan.
const ICON_STYLES = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
} as const;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview', currentOrgId],
    queryFn: async () => (await api.get<Overview>('/analytics/overview')).data,
    enabled: !!currentOrgId,
  });

  const totalSales =
    data?.marketplaceStats.reduce((sum, s) => sum + s.sales, 0) ?? 0;
  const totalRevenue =
    data?.marketplaceStats.reduce((sum, s) => sum + Number(s.revenue), 0) ?? 0;

  const cards = [
    {
      label: 'Jami mahsulotlar',
      value: data?.totals.products ?? 0,
      icon: Package,
      color: 'blue' as const,
    },
    {
      label: 'Faol kartochkalar',
      value: data?.totals.activeListings ?? 0,
      icon: TrendingUp,
      color: 'green' as const,
    },
    {
      label: 'Jami sotuvlar',
      value: totalSales,
      icon: ShoppingCart,
      color: 'purple' as const,
    },
    {
      label: 'Daromad',
      value: formatPrice(totalRevenue),
      icon: DollarSign,
      color: 'orange' as const,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Salom, {user?.fullName}!</h1>
          <p className="text-slate-600 mt-1">MarketFlow boshqaruv paneliga xush kelibsiz</p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Yangi mahsulot
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-6 rounded-xl border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-600">{card.label}</p>
                <div className={`p-2 rounded-lg ${ICON_STYLES[card.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold">
                {isLoading ? (
                  <span className="inline-block w-16 h-8 bg-slate-100 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-xl border">
        <h2 className="text-lg font-semibold mb-4">Tez amallar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/products/new"
            className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <Package className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-medium">Mahsulot qo'shish</p>
            <p className="text-sm text-slate-600 mt-1">Yangi kartochka yarating</p>
          </Link>
          <Link
            href="/dashboard/marketplaces"
            className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <TrendingUp className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-medium">Marketplace ulash</p>
            <p className="text-sm text-slate-600 mt-1">API kalitlarni sozlang</p>
          </Link>
          <Link
            href="/dashboard/products"
            className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <ShoppingCart className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-medium">Mahsulotlarim</p>
            <p className="text-sm text-slate-600 mt-1">Barcha kartochkalarni ko'ring</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
