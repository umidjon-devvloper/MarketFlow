'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Upload, X, Loader2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { UploadDropzone } from '@/components/UploadDropzone';

const schema = z.object({
  title: z.string().min(3, 'Nom kamida 3 harf'),
  description: z.string().min(10, 'Ta\'rif kamida 10 harf'),
  category: z.string().min(1, 'Kategoriya tanlang'),
  brand: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  basePrice: z.coerce.number().positive('Narx musbat bo\'lishi kerak'),
  currency: z.enum(['UZS', 'RUB', 'USD']).default('UZS'),
  stock: z.coerce.number().int().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

interface UploadedImage {
  url: string;
  fileKey: string;
  isPrimary: boolean;
}

const CATEGORIES = [
  'Kiyim-kechak',
  'Poyabzal',
  'Elektronika',
  'Uy-ro\'zg\'or',
  'Kosmetika',
  'Bolalar tovarlari',
  'Sport',
  'Kitob',
  'Oziq-ovqat',
  'Boshqa',
];

export default function NewProductPage() {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'UZS', stock: 0 },
  });

  const handleImageUpload = (uploaded: { url: string; fileKey: string }) => {
    setImages((prev) => [
      ...prev,
      { ...uploaded, isPrimary: prev.length === 0 },
    ]);
  };

  const removeImage = (fileKey: string) => {
    setImages((prev) => {
      const filtered = prev.filter((i) => i.fileKey !== fileKey);
      if (filtered.length > 0 && !filtered.some((i) => i.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const setPrimary = (fileKey: string) => {
    setImages((prev) =>
      prev.map((i) => ({ ...i, isPrimary: i.fileKey === fileKey })),
    );
  };

  const onSubmit = async (data: FormData) => {
    if (images.length === 0) {
      alert('Kamida bitta rasm yuklang');
      return;
    }

    setSaving(true);
    try {
      // 1. Mahsulot yaratish
      const { data: productRes } = await api.post('/products', data);
      const productId = productRes.product.id;

      // 2. Rasmlarni bog'lash
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await api.post(`/products/${productId}/images`, {
          url: img.url,
          fileKey: img.fileKey,
          isPrimary: img.isPrimary,
          order: i,
        });
      }

      router.push(`/dashboard/products/${productId}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Mahsulotlarga qaytish
        </Link>
        <h1 className="text-3xl font-bold">Yangi mahsulot</h1>
        <p className="text-slate-600 mt-1">Universal kartochka yarating, keyin 4 marketplace'ga moslashtiring</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chap: forma */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="font-semibold mb-4">Asosiy ma'lumotlar</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nomi <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('title')}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masalan: Erkaklar ko'ylagi, katak, oq"
                />
                {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Ta'rif <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('description')}
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mahsulot haqida to'liq ma'lumot..."
                />
                {errors.description && <p className="text-red-600 text-xs mt-1">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Kategoriya <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('category')}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tanlang...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-600 text-xs mt-1">{errors.category.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Brend</label>
                  <input
                    {...register('brand')}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nike, Samsung..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SKU</label>
                  <input
                    {...register('sku')}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="SKU-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Barkod</label>
                  <input
                    {...register('barcode')}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1234567890"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rasmlar */}
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="font-semibold mb-1">Rasmlar</h2>
            <p className="text-sm text-slate-600 mb-4">Kamida 1 ta rasm. Birinchisi asosiy bo'ladi.</p>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {images.map((img) => (
                  <div key={img.fileKey} className="relative group">
                    <img
                      src={img.url}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                    {img.isPrimary && (
                      <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" />
                        Asosiy
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center gap-2">
                      {!img.isPrimary && (
                        <button
                          type="button"
                          onClick={() => setPrimary(img.fileKey)}
                          className="p-1.5 bg-white rounded hover:bg-slate-100"
                          title="Asosiy qilish"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(img.fileKey)}
                        className="p-1.5 bg-white rounded hover:bg-red-50"
                        title="O'chirish"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <UploadDropzone onUpload={handleImageUpload} />
          </div>
        </div>

        {/* O'ng: narx va zaxira */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="font-semibold mb-4">Narx va zaxira</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Narx <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    {...register('basePrice')}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <select
                    {...register('currency')}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UZS">UZS</option>
                    <option value="RUB">RUB</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {errors.basePrice && <p className="text-red-600 text-xs mt-1">{errors.basePrice.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Zaxira miqdori</label>
                <input
                  type="number"
                  {...register('stock')}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Saqlagandan so'ng, marketplace kartochkalarini yaratasiz
          </p>
        </div>
      </form>
    </div>
  );
}
