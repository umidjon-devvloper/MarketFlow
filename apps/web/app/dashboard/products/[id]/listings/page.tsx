'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Download,
  Copy,
  Check,
  Edit2,
  Save,
  Loader2,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Listing {
  id: string;
  marketplace: 'UZUM' | 'OZON' | 'WB' | 'YANDEX';
  status: string;
  title: string;
  description: string;
  seoKeywords?: string;
  price: string;
  discountPrice?: string;
}

const MARKETPLACE_INFO = {
  UZUM: { name: 'Uzum Market', color: 'purple', icon: '🛒' },
  OZON: { name: 'Ozon', color: 'blue', icon: '📦' },
  WB: { name: 'Wildberries', color: 'pink', icon: '🛍️' },
  YANDEX: { name: 'Yandex Market', color: 'yellow', icon: '🏪' },
};

export default function ProductListingsPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMps, setSelectedMps] = useState<string[]>([
    'UZUM',
    'OZON',
    'WB',
    'YANDEX',
  ]);

  useEffect(() => {
    load();
  }, [productId]);

  async function load() {
    try {
      const { data } = await api.get(`/listings/product/${productId}`);
      setProduct(data.product);
      setListings(data.listings);
      setImages(data.images);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (selectedMps.length === 0) {
      alert('Kamida bitta marketplace tanlang');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post('/ai/generate-listings', {
        productId,
        marketplaces: selectedMps,
      });
      alert(
        `${data.succeeded} ta muvaffaqiyatli, ${data.failed.length} ta xato`,
      );
      load();
    } catch (err: any) {
      alert('Xato: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="text-slate-500">Yuklanmoqda...</div>;
  if (!product) return <div>Mahsulot topilmadi</div>;

  return (
    <div>
      <Link
        href={`/dashboard/products/${productId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Mahsulotga qaytish
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Marketplace kartochkalari</h1>
          <p className="text-slate-600 mt-1">{product.title}</p>
        </div>
      </div>

      {/* AI Generation Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg">
            <Wand2 className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg mb-1">AI generatsiya</h2>
            <p className="text-sm text-slate-600 mb-4">
              Har bir marketplace uchun matn (title, tavsif, SEO) avtomatik yaratiladi
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(MARKETPLACE_INFO).map(([id, info]) => (
                <label
                  key={id}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer text-sm
                    ${
                      selectedMps.includes(id)
                        ? 'bg-white border-blue-500 text-blue-700'
                        : 'bg-white/60 border-slate-300 text-slate-600'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedMps.includes(id)}
                    onChange={(e) => {
                      setSelectedMps((prev) =>
                        e.target.checked
                          ? [...prev, id]
                          : prev.filter((m) => m !== id),
                      );
                    }}
                    className="rounded"
                  />
                  <span>{info.icon}</span>
                  <span>{info.name}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || selectedMps.length === 0}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? 'Yaratilmoqda...' : 'AI bilan generatsiya qilish'}
            </button>
          </div>
        </div>
      </div>

      {/* Listings */}
      {listings.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border">
          <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 mb-1">Hozircha kartochkalar yo'q</p>
          <p className="text-sm text-slate-500">
            Yuqoridagi "AI generatsiya" tugmasini bosing
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== LISTING CARD ====================
function ListingCard({ listing, onUpdate }: { listing: Listing; onUpdate: () => void }) {
  const info = MARKETPLACE_INFO[listing.marketplace];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    title: listing.title,
    description: listing.description,
    seoKeywords: listing.seoKeywords || '',
    price: listing.price,
  });

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/listings/${listing.id}`, form);
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Xato');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await api.get(`/listings/${listing.id}/export`);
      // JSON ni yuklab olish
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${listing.marketplace.toLowerCase()}-${listing.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Eksport xatosi: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{info.icon}</span>
          <span className="font-semibold">{info.name}</span>
          <span
            className={`ml-2 px-2 py-0.5 rounded text-xs ${
              listing.status === 'PUBLISHED'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {listing.status}
          </span>
        </div>
        <div className="flex gap-1">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 hover:bg-slate-200 rounded"
                title="Tahrirlash"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="p-1.5 hover:bg-slate-200 rounded"
                title="Eksport"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setForm({
                    title: listing.title,
                    description: listing.description,
                    seoKeywords: listing.seoKeywords || '',
                    price: listing.price,
                  });
                }}
                className="p-1.5 hover:bg-slate-200 rounded text-sm"
              >
                Bekor
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1.5 hover:bg-green-100 rounded"
                title="Saqlash"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 text-green-600" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500 uppercase">Sarlavha</label>
            {!editing && (
              <button
                onClick={() => handleCopy(listing.title, 'title')}
                className="text-slate-400 hover:text-slate-600"
              >
                {copied === 'title' ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          {editing ? (
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          ) : (
            <p className="text-sm font-medium">{listing.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500 uppercase">Tavsif</label>
            {!editing && (
              <button
                onClick={() => handleCopy(listing.description, 'desc')}
                className="text-slate-400 hover:text-slate-600"
              >
                {copied === 'desc' ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          {editing ? (
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={6}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          ) : (
            <p className="text-sm text-slate-700 line-clamp-4 whitespace-pre-wrap">
              {listing.description}
            </p>
          )}
        </div>

        {/* SEO */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500 uppercase">SEO kalit so'zlar</label>
            {!editing && listing.seoKeywords && (
              <button
                onClick={() => handleCopy(listing.seoKeywords!, 'seo')}
                className="text-slate-400 hover:text-slate-600"
              >
                {copied === 'seo' ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          {editing ? (
            <textarea
              value={form.seoKeywords}
              onChange={(e) => setForm((f) => ({ ...f, seoKeywords: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="kalit1, kalit2, kalit3"
            />
          ) : (
            <p className="text-sm text-slate-600">{listing.seoKeywords || '—'}</p>
          )}
        </div>

        {/* Price */}
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase block mb-1">
            Narx
          </label>
          {editing ? (
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          ) : (
            <p className="text-sm font-semibold">
              {parseFloat(listing.price).toLocaleString()} so'm
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
