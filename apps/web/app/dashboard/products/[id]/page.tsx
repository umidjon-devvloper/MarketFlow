'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Wand2,
  Loader2,
  Sparkles,
  Package,
  Trash2,
  Star,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { SkeletonPage } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';

const MARKETPLACE_INFO = {
  UZUM: { name: 'Uzum', logo: '/logos/uzum.jpg' },
  OZON: { name: 'Ozon', logo: '/logos/ozon.jpg' },
  WB: { name: 'WB', logo: '/logos/wildberries.jpg' },
  YANDEX: { name: 'Yandex', logo: '/logos/yandex.jpg' },
};

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const toast = useToast();
  const confirm = useConfirm();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingImage, setProcessingImage] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [productId]);

  async function load() {
    try {
      const { data } = await api.get(`/products/${productId}`);
      setProduct(data.product);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveBackground(imageId: string) {
    setProcessingImage(imageId);
    try {
      await api.post('/ai/remove-background', { imageId });
      toast('info', "Ishlov berish boshlandi — bir necha soniyada tayyor bo'ladi");
      // Job status ni polling qilish
      setTimeout(load, 5000);
    } catch (err: any) {
      toast('error', err.response?.data?.error || err.message);
    } finally {
      setProcessingImage(null);
    }
  }

  async function handleUpscale(imageId: string) {
    setProcessingImage(imageId);
    try {
      await api.post('/ai/upscale', { imageId, scale: 2 });
      toast('info', "Sifatni oshirish boshlandi — bir necha soniyada tayyor bo'ladi");
      setTimeout(load, 5000);
    } catch (err: any) {
      toast('error', err.response?.data?.error || err.message);
    } finally {
      setProcessingImage(null);
    }
  }

  async function handleDeleteImage(imageId: string) {
    const ok = await confirm({
      title: "Rasm o'chirilsinmi?",
      description: "Moslashtirilgan nusxalari ham yo'qoladi.",
      confirmLabel: "Ha, o'chirilsin",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/products/${productId}/images/${imageId}`);
      load();
    } catch (err) {
      toast('error', "Rasmni o'chirib bo'lmadi");
    }
  }

  if (loading) return <SkeletonPage label="Mahsulot yuklanmoqda" />;
  if (!product) return <div>Mahsulot topilmadi</div>;

  return (
    <div>
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Ro'yxatga qaytish
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
          <p className="text-ink-soft">
            {product.category}
            {product.brand && ` • ${product.brand}`}
          </p>
        </div>
        <Link
          href={`/dashboard/products/${productId}/listings`}
          className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
        >
          <Sparkles className="w-4 h-4" />
          Marketplace kartochkalari
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chap: ma'lumotlar */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold mb-4">Ma'lumotlar</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-ink-soft">Narx</span>
                <span className="font-medium">
                  {formatPrice(product.basePrice, product.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-ink-soft">Zaxira</span>
                <span className="font-medium">{product.stock}</span>
              </div>
              {product.sku && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-ink-soft">SKU</span>
                  <span className="font-medium">{product.sku}</span>
                </div>
              )}
              <div className="pt-3">
                <p className="text-ink-soft mb-2">Ta'rif</p>
                <p className="whitespace-pre-wrap">{product.description}</p>
              </div>
            </div>
          </div>

          {/* Rasmlar */}
          <div className="card p-6">
            <h2 className="font-semibold mb-4">
              Rasmlar ({product.images.length})
            </h2>
            {product.images.length === 0 ? (
              <p className="text-muted text-sm">Rasm yo'q</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {product.images.map((img: any) => (
                  <div key={img.id} className="relative group">
                    <RemoteImage
                      src={img.url}
                      alt=""
                      sizes="(max-width: 768px) 33vw, 200px"
                      className="w-full aspect-square rounded-lg border"
                    />
                    {img.isPrimary && (
                      <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" />
                        Asosiy
                      </div>
                    )}
                    {img.isAiProcessed && (
                      <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI
                      </div>
                    )}
                    {img.variant !== 'ORIGINAL' && (
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {img.variant}
                      </div>
                    )}

                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                      <button
                        onClick={() => handleRemoveBackground(img.id)}
                        disabled={processingImage === img.id}
                        className="w-full text-xs bg-paper text-ink py-1.5 rounded font-medium hover:bg-panel disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {processingImage === img.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        Fon o'chirish
                      </button>
                      <button
                        onClick={() => handleUpscale(img.id)}
                        disabled={processingImage === img.id}
                        className="w-full text-xs bg-paper text-ink py-1.5 rounded font-medium hover:bg-panel disabled:opacity-50"
                      >
                        HD sifat (2x)
                      </button>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="w-full text-xs bg-red-600 text-white py-1.5 rounded font-medium hover:bg-red-700 flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        O'chirish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* O'ng: marketplace ro'yxati */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Marketplace kartochkalari</h2>

          <div className="space-y-2">
            {['UZUM', 'OZON', 'WB', 'YANDEX'].map((mp) => {
              const listing = product.listings?.find((l: any) => l.marketplace === mp);
              const info = MARKETPLACE_INFO[mp as keyof typeof MARKETPLACE_INFO];
              return (
                <div
                  key={mp}
                  className="p-3 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <RemoteImage
                      src={info.logo}
                      alt={info.name}
                      fit="contain"
                      sizes="16px"
                      className="w-4 h-4 rounded flex-shrink-0"
                    />
                    <span className="font-medium text-sm">{info.name}</span>
                  </div>
                  {listing ? (
                    <span className="text-xs bg-green-100 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                      {listing.status}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Yaratilmagan</span>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href={`/dashboard/products/${productId}/listings`}
            className="mt-4 block text-center bg-accent text-white py-2 rounded-lg font-medium hover:opacity-90 text-sm"
          >
            Kartochkalarni boshqarish
          </Link>
        </div>
      </div>
    </div>
  );
}
