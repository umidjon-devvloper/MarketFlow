'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Package,
  Trash2,
  Edit,
  Upload,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  Plus,
  Send,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  downloadBlob,
  fileNameFromResponse,
  summarizeWarnings,
  warningsFromResponse,
} from '@/lib/export';
import { formatPrice, formatDate } from '@/lib/utils';
import { SkeletonRows, SkeletonCards } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';
import { PublishQueuePanel } from '@/components/publish/PublishQueuePanel';
import { QualityPill, QualityScore } from '@/components/quality/QualityBadge';
import { NotReadyPanel, SkippedProduct } from '@/components/publish/NotReadyPanel';
import { BulkCategoryDialog } from '@/components/publish/BulkCategoryDialog';
import { PriceStockDialog } from '@/components/publish/PriceStockDialog';

type MarketplaceId = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';

interface SpecSummary {
  id: MarketplaceId;
  name: string;
  logo: string;
  color: string;
  currency: string;
  fieldCount: number;
  requiredCount: number;
  /** API orqali kartochka yaratish mumkinmi (Uzum'da yo'q — faqat Excel) */
  canPublishViaApi: boolean;
  image: { targetWidth: number; targetHeight: number; aspectRatio: string };
}

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
  listings: Array<{ marketplace: MarketplaceId; status: string }>;
  updatedAt: string;
  quality?: (QualityScore & { marketplace: MarketplaceId }) | null;
}

const statusColors = {
  DRAFT: 'bg-panel text-ink-soft',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  ARCHIVED: 'bg-red-500/10 text-red-600 dark:text-red-400',
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
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<string | null>(null);
  // Ommaviy joylash uchun tanlangan mahsulotlar
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  /**
   * Tanlangan mahsulotlar bilan nima qilinadi.
   *
   * Ikki amal bir xil tugmalar orqali ishlaydi (marketplace tanlash), lekin
   * mos keladigan marketplace ro'yxati boshqa: Uzum kartochka yaratishni
   * qo'llab-quvvatlamaydi, narx va qoldiqni esa qabul qiladi.
   */
  const [action, setAction] = useState<'publish' | 'priceStock'>('publish');
  const [priceStock, setPriceStock] = useState<{
    marketplace: string;
    name: string;
    currency: string;
  } | null>(null);
  // Tayyor bo'lmagan kartochkalar — toast emas, panel bilan ko'rsatamiz:
  // har biriga "nima qilish kerak" tugmasi kerak
  const [notReady, setNotReady] = useState<{
    items: SkippedProduct[];
    marketplace: string;
    name: string;
  } | null>(null);
  // Ommaviy kategoriya oynasi — qaysi mahsulotlarga qo'yilyapti
  const [bulkCategory, setBulkCategory] = useState<{
    productIds: string[];
    marketplace: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: specs = [] } = useQuery({
    queryKey: ['card-specs'],
    queryFn: async () => (await api.get('/cards/specs')).data.items as SpecSummary[],
    enabled: !!currentOrgId,
    staleTime: 60 * 60 * 1000, // spetsifikatsiya statik — soatiga bir marta yetarli
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', currentOrgId, page, debouncedSearch],
    queryFn: async () =>
      (
        await api.get('/products', {
          params: { page, limit: 20, search: debouncedSearch || undefined },
        })
      ).data,
    enabled: !!currentOrgId,
    placeholderData: (prev) => prev,
  });

  const products: Product[] = data?.items || [];
  const totalPages: number = data?.pagination?.totalPages || 1;

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));

  /**
   * Tanlangan mahsulotlarni joylash navbatiga qo'yish.
   *
   * Darhol yubormaymiz: marketplace limitlari sotuvchi bo'yicha hisoblanadi,
   * shuning uchun server ularni ketma-ket olib boradi. Sahifani yopib ketsa
   * ham ish davom etadi.
   */
  const handleBatchPublish = async (marketplace: MarketplaceId) => {
    const spec = specs.find((s) => s.id === marketplace);
    const ok = await confirm({
      title: `${selected.size} ta kartochka ${spec?.name ?? marketplace} ga joylansinmi?`,
      description:
        "Kartochkalar navbatga qo'shiladi va ketma-ket yuboriladi. Holatni shu sahifada " +
        "kuzatasiz — sahifani yopsangiz ham jarayon davom etadi.",
      confirmLabel: 'Ha, joylansin',
    });
    if (!ok) return;

    setPublishing(true);
    setNotReady(null);
    try {
      const { data } = await api.post('/cards/publish-batch', {
        marketplace,
        productIds: [...selected],
      });

      if (data.queued > 0) {
        toast('success', data.message);
        setSelected(new Set());
        queryClient.invalidateQueries({ queryKey: ['publish-jobs', currentOrgId] });
      }
      if (data.skipped?.length) {
        setNotReady({ items: data.skipped, marketplace, name: spec?.name ?? marketplace });
      }
    } catch (err: any) {
      // 400 — hech biri tayyor emas. Javobda to'liq ro'yxat bor,
      // uni panelda ko'rsatamiz: har bir mahsulotga yechim tugmasi bilan
      const body = err.response?.data;
      if (body?.skipped?.length) {
        setNotReady({ items: body.skipped, marketplace, name: spec?.name ?? marketplace });
        toast('info', body.message);
      } else {
        toast('error', body?.error || "Navbatga qo'shib bo'lmadi");
      }
    } finally {
      setPublishing(false);
    }
  };

  /**
   * Narx va qoldiqni yuborish.
   *
   * To'g'ridan-to'g'ri yubormaymiz: narx marketplace'dagi joriy qiymat ustiga
   * yoziladi va eskisi saqlanmaydi. Oyna avval `dryRun` bilan nima ketishini
   * ko'rsatadi — valyutasi mos kelmagan narxlar ham shu yerda ko'rinadi.
   */
  const handlePriceStock = (marketplace: MarketplaceId) => {
    const spec = specs.find((s) => s.id === marketplace);
    setPriceStock({
      marketplace,
      name: spec?.name ?? marketplace,
      currency: spec?.currency ?? '',
    });
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: `"${title}" kartochkasi o'chirilsinmi?`,
      description:
        "Mahsulot, uning rasmlari va barcha marketplace kartochkalari o'chadi. Buni qaytarib bo'lmaydi.",
      confirmLabel: "Ha, o'chirilsin",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/products/${id}`);
      queryClient.invalidateQueries({ queryKey: ['products', currentOrgId] });
      toast('success', `"${title}" o'chirildi`);
    } catch (err: any) {
      toast('error', err.response?.data?.error || "O'chirishda xato");
    }
  };

  // Saqlangan kartochkani o'sha marketplace formatidagi Excel'ga chiqarish
  const handleExport = async (product: Product) => {
    const marketplace = product.listings[0]?.marketplace;
    if (!marketplace) {
      toast('error', 'Bu kartochkada marketplace belgilanmagan');
      return;
    }

    setExporting(product.id);
    try {
      const res = await api.post(
        '/cards/export',
        { marketplace, productIds: [product.id] },
        { responseType: 'blob' },
      );
      downloadBlob(
        res.data,
        fileNameFromResponse(res, `${marketplace.toLowerCase()}-${product.id.slice(-6)}.xlsx`),
      );
      const issues = summarizeWarnings(warningsFromResponse(res));
      toast(issues ? 'info' : 'success', issues ? `Yuklandi, lekin: ${issues}` : 'Excel yuklab olindi');
    } catch {
      toast('error', 'Excel tayyorlashda xato');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Mahsulotlar</h1>
          <p className="text-muted mt-1">
            Marketplace tanlang — kartochkani o'sha talab bo'yicha tayyorlaymiz
          </p>
        </div>
        <Link
          href="/dashboard/products/import"
          className="btn-ghost btn-sm"
        >
          <Upload className="w-4 h-4" />
          Ommaviy import
        </Link>
      </div>

      {/* Tayyor bo'lmagan kartochkalar — sababi va yechimi bilan */}
      {notReady && (
        <NotReadyPanel
          items={notReady.items}
          marketplace={notReady.marketplace}
          marketplaceName={notReady.name}
          onClose={() => setNotReady(null)}
          onBulkCategory={(productIds) =>
            setBulkCategory({
              productIds,
              marketplace: notReady.marketplace,
              name: notReady.name,
            })
          }
        />
      )}

      {/* Joylash navbati — faol vazifa bo'lsagina ko'rinadi */}
      <PublishQueuePanel />

      {/* Marketplace tanlash — asosiy harakat */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {specs.map((spec) => (
          <Link
            key={spec.id}
            href={`/dashboard/products/new/${spec.id.toLowerCase()}`}
            className="card p-5 group hover:-translate-y-1 hover:shadow-card-hover"
          >
            <div className="flex items-center gap-3.5">
              <span
                className="w-14 h-14 rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${spec.color} 0%, ${spec.color}cc 100%)` }}
              >
                <RemoteImage
                  src={spec.logo}
                  alt={spec.name}
                  fit="contain"
                  sizes="44px"
                  className="w-11 h-11 rounded-xl bg-white/95"
                />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[15px] truncate">{spec.name}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {spec.image.targetWidth}×{spec.image.targetHeight} · {spec.currency}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted mt-4">
              {spec.requiredCount} ta majburiy maydon to'ldiriladi
            </p>

            <span
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: spec.color }}
            >
              Kartochka yaratish
              <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}

        {specs.length === 0 && <SkeletonCards count={4} />}
      </div>

      {/* Tayyorlangan kartochkalar */}
      <div className="card">
        <div className="p-4 border-b border-line flex items-center gap-4">
          {products.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Barcha kartochkalarni tanlash"
              className="w-4 h-4 rounded accent-accent flex-shrink-0 cursor-pointer"
            />
          )}
          <h2 className="font-semibold whitespace-nowrap">Tayyorlangan kartochkalar</h2>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Nomi, SKU yoki brend bo'yicha qidiring..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 pl-11 pr-3 rounded-full border border-line bg-paper/70 text-sm placeholder:text-muted focus:outline-none focus:border-accent/50 transition"
            />
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted/40 mb-3" />
            <p className="text-muted">
              {search ? 'Hech narsa topilmadi' : "Hozircha kartochka yo'q — yuqoridan marketplace tanlang"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product) => {
              const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];
              // Bitta mahsulot bir nechta marketplace'ga tayyorlangan bo'lishi mumkin
              const productSpecs = product.listings
                .map((l) => specs.find((s) => s.id === l.marketplace))
                .filter(Boolean) as SpecSummary[];

              return (
                <div
                  key={product.id}
                  className={`p-4 flex items-center gap-4 transition ${
                    selected.has(product.id) ? 'bg-accent-soft/50' : 'hover:bg-panel'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    aria-label={`"${product.title}" ni tanlash`}
                    className="w-4 h-4 rounded accent-accent flex-shrink-0 cursor-pointer"
                  />
                  <div className="w-16 h-16 bg-panel rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {primaryImage ? (
                      <RemoteImage
                        src={primaryImage.url}
                        alt={product.title}
                        sizes="64px"
                        className="w-full h-full"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="font-medium hover:text-accent transition block truncate"
                    >
                      {product.title}
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-muted mt-1">
                      <span>{product.category}</span>
                      {product.brand && <span>• {product.brand}</span>}
                      <span>• Zaxira: {product.stock}</span>
                    </div>
                  </div>

                  {productSpecs.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {productSpecs.map((mp) => (
                        <span
                          key={mp.id}
                          title={mp.name}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${mp.color} 0%, ${mp.color}cc 100%)` }}
                        >
                          <RemoteImage
                            src={mp.logo}
                            alt={mp.name}
                            fit="contain"
                            sizes="24px"
                            className="w-6 h-6 rounded-md bg-white/95"
                          />
                        </span>
                      ))}
                      {/* Qolgan bozorlarga tayyorlash */}
                      {productSpecs.length < specs.length && (
                        <Link
                          href={`/dashboard/products/new/${specs
                            .find((s) => !productSpecs.some((p) => p.id === s.id))!
                            .id.toLowerCase()}?from=${product.id}`}
                          title="Boshqa marketplace uchun tayyorlash"
                          className="w-8 h-8 rounded-lg border border-dashed border-line flex items-center justify-center text-muted transition hover:border-accent/50 hover:text-accent"
                        >
                          <Plus className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(product.basePrice, product.currency)}</p>
                    <p className="text-xs text-muted mt-1">{formatDate(product.updatedAt)}</p>
                  </div>

                  {product.quality && (
                    <div className="hidden md:block flex-shrink-0">
                      <QualityPill quality={product.quality} />
                    </div>
                  )}

                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[product.status]}`}>
                    {statusLabels[product.status]}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleExport(product)}
                      disabled={exporting === product.id}
                      className="p-2 hover:bg-emerald-500/10 rounded-lg transition disabled:opacity-50"
                      title="Excel yuklab olish"
                      aria-label={`"${product.title}" uchun Excel yuklab olish`}
                    >
                      {exporting === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-300" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                      )}
                    </button>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="p-2 hover:bg-panel rounded-lg transition"
                      title="Tahrirlash"
                      aria-label={`"${product.title}" ni tahrirlash`}
                    >
                      <Edit className="w-4 h-4 text-ink-soft" />
                    </Link>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(product.id, product.title)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition"
                        title="O'chirish"
                        aria-label={`"${product.title}" ni o'chirish`}
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
          <div className="p-4 border-t border-line flex items-center justify-between">
            <p className="text-sm text-muted">
              Sahifa {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 border border-line rounded-full text-sm transition disabled:opacity-40 hover:border-accent/40 hover:text-accent"
              >
                Oldingi
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-1.5 border border-line rounded-full text-sm transition disabled:opacity-40 hover:border-accent/40 hover:text-accent"
              >
                Keyingi
              </button>
            </div>
          </div>
        )}
      </div>

      {priceStock && (
        <PriceStockDialog
          marketplace={priceStock.marketplace}
          marketplaceName={priceStock.name}
          currency={priceStock.currency}
          productIds={[...selected]}
          onClose={() => setPriceStock(null)}
          onSent={() => setSelected(new Set())}
        />
      )}

      {bulkCategory && (
        <BulkCategoryDialog
          marketplace={bulkCategory.marketplace}
          marketplaceName={bulkCategory.name}
          productIds={bulkCategory.productIds}
          onClose={() => setBulkCategory(null)}
          onApplied={() => {
            // Kategoriya qo'yildi — "tayyor emas" ro'yxati eskirdi
            setNotReady(null);
            queryClient.invalidateQueries({ queryKey: ['products', currentOrgId] });
          }}
        />
      )}

      {/* Tanlanganda chiqadigan amal paneli.
          Pastda suzib turadi — sotuvchi ro'yxatni aylantirib, tanlashni
          davom ettira oladi va tugma ko'zdan yo'qolmaydi. */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(760px,calc(100%-2rem))] animate-fade-up">
          <div className="glass rounded-[26px] px-4 py-3 shadow-card-hover">
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selected.size} ta tanlandi
              </span>

              {/* Nima qilinadi — marketplace ro'yxati shunga qarab o'zgaradi */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-panel">
                {(
                  [
                    { id: 'publish', label: 'Kartochka joylash', icon: Send },
                    { id: 'priceStock', label: 'Narx va qoldiq', icon: RefreshCw },
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setAction(mode.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        action === mode.id
                          ? 'bg-paper text-ink shadow-soft'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {publishing && <Loader2 className="w-4 h-4 animate-spin text-accent flex-shrink-0" />}

              <button
                onClick={() => setSelected(new Set())}
                aria-label="Tanlovni bekor qilish"
                className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-muted transition hover:bg-paper hover:text-ink flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-muted whitespace-nowrap hidden sm:block">
                {action === 'publish' ? 'qayerga joylansin?' : 'qayerga yuborilsin?'}
              </span>

              {specs
                // Uzum API orqali kartochka yaratishni qo'llab-quvvatlamaydi,
                // lekin narx va qoldiqni qabul qiladi
                .filter((spec) => action === 'priceStock' || spec.canPublishViaApi)
                .map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() =>
                      action === 'publish' ? handleBatchPublish(spec.id) : handlePriceStock(spec.id)
                    }
                    disabled={publishing}
                    className="flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full border border-line bg-paper text-sm font-medium whitespace-nowrap transition hover:border-accent/40 hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    <RemoteImage
                      src={spec.logo}
                      alt=""
                      fit="contain"
                      sizes="24px"
                      className="w-6 h-6 rounded-md bg-white/95"
                    />
                    {spec.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/** Blob'ni brauzerda yuklab olish */
