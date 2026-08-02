'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package, Trash2, Edit, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { formatPrice, formatDate } from '@/lib/utils';

interface Product {
  id: string;
  title: string;
  category: string;
  brand?: string;
  basePrice: string;
  currency: string;
  stock: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  listings: Array<{ marketplace: string; status: string }>;
  updatedAt: string;
}

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

const statusLabels = {
  DRAFT: 'Qoralama',
  ACTIVE: 'Faol',
  ARCHIVED: 'Arxiv',
};

export default function ProductsPage() {
  const { hasRole } = useAuthStore();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const canDelete = hasRole('OWNER', 'ADMIN');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Qidiruvni 300ms kechiktiramiz — har harfda so'rov ketmasin
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', currentOrgId, page, debouncedSearch],
    queryFn: async () =>
      (
        await api.get('/products', {
          params: { page, limit: 20, search: debouncedSearch || undefined },
        })
      ).data,
    enabled: !!currentOrgId,
    placeholderData: (prev) => prev, // sahifa/qidiruv almashganda eski ro'yxat ko'rinib turadi
  });

  const products: Product[] = data?.items || [];
  const totalPages: number = data?.pagination?.totalPages || 1;
  const loading = isLoading;

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" mahsulotini o'chirmoqchimisiz?`)) return;
    try {
      await api.delete(`/products/${id}`);
      queryClient.invalidateQueries({ queryKey: ['products', currentOrgId] });
      toast('success', `"${title}" o'chirildi`);
    } catch (err: any) {
      toast('error', err.response?.data?.error || "O'chirishda xato");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mahsulotlar</h1>
          <p className="text-slate-600 mt-1">Barcha kartochkalaringiz bir joyda</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/products/import"
            className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 font-medium"
          >
            <Upload className="w-4 h-4" />
            Ommaviy import
          </Link>
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Yangi mahsulot
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Nomi, SKU yoki brend bo'yicha qidiring..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Yuklanmoqda...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 mb-4">
              {search ? 'Hech narsa topilmadi' : 'Hozircha mahsulot yo\'q'}
            </p>
            {!search && (
              <div className="flex gap-2 justify-center">
                <Link
                  href="/dashboard/products/new"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Yangi mahsulot
                </Link>
                <Link
                  href="/dashboard/products/import"
                  className="inline-flex items-center gap-2 border px-4 py-2 rounded-lg font-medium hover:bg-slate-50"
                >
                  <Upload className="w-4 h-4" />
                  Excel'dan import
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product) => {
              const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];
              return (
                <div key={product.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {primaryImage ? (
                      <img src={primaryImage.url} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="font-medium hover:text-blue-600 block truncate"
                    >
                      {product.title}
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                      <span>{product.category}</span>
                      {product.brand && <span>• {product.brand}</span>}
                      <span>• Zaxira: {product.stock}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(product.basePrice, product.currency)}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(product.updatedAt)}</p>
                  </div>

                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[product.status]}`}>
                    {statusLabels[product.status]}
                  </span>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="p-2 hover:bg-slate-100 rounded"
                      title="Tahrirlash"
                    >
                      <Edit className="w-4 h-4 text-slate-600" />
                    </Link>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(product.id, product.title)}
                        className="p-2 hover:bg-red-50 rounded"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Sahifa {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Oldingi
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
