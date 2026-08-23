'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Wand2, CheckCircle2, CopyPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { SkeletonText } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';
import { ListingCard } from './ListingCard';
import {
  Listing,
  MarketplaceId,
  MARKETPLACE_IDS,
  MARKETPLACE_INFO,
  errorText,
} from './constants';

interface Props {
  productId: string;
  /** Mahsulot nomi sarlavhada ko'rsatilsinmi (alohida sahifada kerak emas) */
  showTitle?: boolean;
}

export function ListingsWorkspace({ productId, showTitle = true }: Props) {
  const toast = useToast();
  const [product, setProduct] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<MarketplaceId[]>([]);

  const done = useMemo(
    () => new Set(listings.map((l) => l.marketplace)),
    [listings],
  );
  const missing = useMemo(
    () => MARKETPLACE_IDS.filter((mp) => !done.has(mp)),
    [done],
  );

  async function load() {
    try {
      const { data } = await api.get(`/listings/product/${productId}`);
      setProduct(data.product);
      setListings(data.listings);
      return data.listings as Listing[];
    } catch (err) {
      toast('error', errorText(err));
      return [];
    } finally {
      setLoading(false);
    }
  }

  // Mahsulot almashganda hammasini qaytadan yuklaymiz
  useEffect(() => {
    setLoading(true);
    setProduct(null);
    setListings([]);
    load().then((fresh) => {
      // Standart tanlov — hali kartochkasi yo'q marketplace'lar. Foydalanuvchi
      // odatda aynan qolganlarini to'ldirmoqchi bo'ladi, tayyorlarini emas.
      const have = new Set(fresh.map((l) => l.marketplace));
      const gaps = MARKETPLACE_IDS.filter((mp) => !have.has(mp));
      setSelected(gaps.length ? gaps : MARKETPLACE_IDS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleGenerate(targets: MarketplaceId[]) {
    if (!targets.length) {
      toast('error', 'Kamida bitta marketplace tanlang');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post('/ai/generate-listings', {
        productId,
        marketplaces: targets,
      });
      if (data.failed.length) {
        toast('info', `${data.succeeded} ta yaratildi, ${data.failed.length} tasida xato`);
      } else {
        toast('success', `${data.succeeded} ta kartochka yaratildi`);
      }
      await load();
    } catch (err) {
      toast('error', errorText(err));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <SkeletonText lines={3} />
      </div>
    );
  }
  if (!product) return <p className="text-ink-soft">Mahsulot topilmadi</p>;

  const allDone = missing.length === 0;

  return (
    <div>
      {showTitle && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Marketplace kartochkalari</h1>
          <p className="text-ink-soft mt-1">{product.title}</p>
        </div>
      )}

      {/* AI paneli */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-accent/30 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-paper rounded-lg flex-shrink-0">
            <Wand2 className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-lg">AI generatsiya</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-paper border text-ink-soft">
                {done.size}/{MARKETPLACE_IDS.length} tayyor
              </span>
            </div>
            <p className="text-sm text-ink-soft mb-4 mt-0.5">
              Har bir marketplace uchun matn (sarlavha, tavsif, SEO) avtomatik yaratiladi
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {MARKETPLACE_IDS.map((mp) => {
                const info = MARKETPLACE_INFO[mp];
                const isDone = done.has(mp);
                const isOn = selected.includes(mp);
                return (
                  <label
                    key={mp}
                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer text-sm transition ${
                      isOn ? 'bg-paper border-accent text-accent' : 'bg-paper/60 border-line text-ink-soft'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, mp] : prev.filter((m) => m !== mp),
                        )
                      }
                      className="rounded"
                    />
                    <RemoteImage
                      src={info.logo}
                      alt=""
                      fit="contain"
                      sizes="16px"
                      className="w-4 h-4 rounded flex-shrink-0"
                    />
                    <span>{info.name}</span>
                    {isDone && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Asosiy amal: qolganlarini to'ldirish. Hammasi tayyor bo'lsa — qayta yaratish */}
              <button
                onClick={() => handleGenerate(allDone ? selected : missing)}
                disabled={generating}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generating
                  ? 'Yaratilmoqda...'
                  : allDone
                    ? 'Tanlanganini qayta yaratish'
                    : `Qolgan ${missing.length} tasini yaratish`}
              </button>

              {!allDone && (
                <button
                  onClick={() => handleGenerate(selected)}
                  disabled={generating || !selected.length}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm bg-paper hover:bg-panel disabled:opacity-50"
                >
                  Faqat tanlanganini yaratish
                </button>
              )}
            </div>

            {/* AI'siz tez yo'l — bitta kartochka tayyor bo'lsa qolganlarini nusxalash */}
            {listings.length > 0 && !allDone && (
              <p className="text-xs text-ink-soft mt-3 flex items-center gap-1.5">
                <CopyPlus className="w-3.5 h-3.5 flex-shrink-0" />
                AI kutmasdan tayyor kartochkadagi{' '}
                <CopyPlus className="w-3 h-3 inline" /> tugmasi bilan matnni qolganlariga
                bir zumda ko'chirish mumkin
              </p>
            )}
          </div>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="card p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-muted/50 mb-3" />
          <p className="text-ink-soft mb-1">Hozircha kartochkalar yo'q</p>
          <p className="text-sm text-muted">Yuqoridagi tugmani bosing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              missing={missing}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
