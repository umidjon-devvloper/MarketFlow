'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, X, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface WillSend {
  productId: string;
  title: string;
  sku: string;
  price?: number;
  oldPrice?: number;
  stock?: number;
}

interface Skipped {
  productId: string;
  title: string;
  reason: string;
}

interface Preview {
  willSend: WillSend[];
  skipped: Skipped[];
  warnings: string[];
  message: string;
}

interface SendResult {
  pricesUpdated: number;
  stocksUpdated: number;
  failed: Skipped[];
  skipped: Skipped[];
  warnings: string[];
  message: string;
}

/**
 * Narx va qoldiqni yuborishdan oldingi ko'rsatish.
 *
 * Narx — qaytarib bo'lmaydigan o'zgarish: marketplace'dagi joriy qiymat
 * ustiga yoziladi va eskisi saqlanmaydi. Shuning uchun avval `dryRun` bilan
 * "nima ketadi" so'raladi, sotuvchi ko'radi, keyin tasdiqlaydi.
 *
 * Ayniqsa muhimi — ogohlantirishlar: valyutasi mos kelmagani uchun
 * yuborilmaydigan narxlar va turli valyutada bir xil raqam yozilgan holatlar
 * shu yerda ko'rinadi, marketplace'ga tegmasdan oldin.
 */
export function PriceStockDialog({
  marketplace,
  marketplaceName,
  currency,
  productIds,
  onClose,
  onSent,
}: {
  marketplace: string;
  marketplaceName: string;
  currency: string;
  productIds: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post<Preview>('/cards/sync-price-stock', {
          marketplace,
          productIds,
          price: true,
          stock: true,
          dryRun: true,
        });
        if (!cancelled) setPreview(data);
      } catch (err: any) {
        if (!cancelled) {
          toast('error', err.response?.data?.error || "Ma'lumotni tayyorlab bo'lmadi");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace]);

  const send = async () => {
    setSending(true);
    try {
      const { data } = await api.post<SendResult>('/cards/sync-price-stock', {
        marketplace,
        productIds,
        price: true,
        stock: true,
      });
      setResult(data);
      onSent();
    } catch (err: any) {
      toast('error', err.response?.data?.error || "Yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  };

  const prices = preview?.willSend.filter((w) => w.price !== undefined) ?? [];
  const stocks = preview?.willSend.filter((w) => w.stock !== undefined) ?? [];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-stock-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !sending && onClose()}
        aria-hidden="true"
      />

      <div className="relative card p-6 w-full max-w-xl animate-fade-up max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={sending}
          aria-label="Yopish"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted transition hover:bg-panel hover:text-ink disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        {result ? (
          <>
            <Header
              icon={CheckCircle2}
              tone="ok"
              title={result.message}
              subtitle={`${marketplaceName} dagi qiymatlar yangilandi.`}
            />
            <Issues title="Yuborilmadi" items={[...result.failed, ...result.skipped]} />
            <Warnings items={result.warnings} />
            <button onClick={onClose} className="btn-primary w-full mt-5">
              Yopish
            </button>
          </>
        ) : loading ? (
          <div className="py-10 flex flex-col items-center gap-3" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <p className="text-sm text-muted">Nima yuborilishi hisoblanmoqda...</p>
          </div>
        ) : (
          <>
            <Header
              icon={RefreshCw}
              tone="accent"
              title={`${marketplaceName} ga yuboriladi`}
              subtitle={`${prices.length} ta narx (${currency}) va ${stocks.length} ta qoldiq. Marketplace'dagi joriy qiymatlar ustiga yoziladi.`}
            />

            {prices.length > 0 && (
              <div className="rounded-[18px] border border-line bg-panel p-3.5 mb-4 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted text-left">
                      <th className="font-medium pb-1.5">Tovar</th>
                      <th className="font-medium pb-1.5 text-right">Narx</th>
                      <th className="font-medium pb-1.5 text-right">Qoldiq</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview!.willSend.slice(0, 20).map((w) => (
                      <tr key={w.productId} className="border-t border-line/60">
                        <td className="py-1.5 pr-2 truncate max-w-[240px]">{w.title}</td>
                        <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                          {w.price !== undefined ? `${w.price.toLocaleString('uz-UZ')} ${currency}` : '—'}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{w.stock ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview!.willSend.length > 20 && (
                  <p className="text-[11px] text-muted mt-2">
                    …va yana {preview!.willSend.length - 20} ta
                  </p>
                )}
              </div>
            )}

            <Warnings items={preview?.warnings ?? []} />
            <Issues title="Yuborilmaydi" items={preview?.skipped ?? []} />

            <div className="flex gap-2.5 mt-5">
              <button onClick={onClose} disabled={sending} className="btn-ghost btn-sm flex-1">
                Bekor qilish
              </button>
              <button
                onClick={send}
                disabled={sending || !preview?.willSend.length}
                className="btn-primary btn-sm flex-1 disabled:opacity-50"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                Yuborish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  icon: Icon,
  tone,
  title,
  subtitle,
}: {
  icon: typeof RefreshCw;
  tone: 'ok' | 'accent';
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3.5 mb-5 pr-8">
      <span
        className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
          tone === 'ok' ? 'bg-emerald-500/10' : 'bg-accent-soft'
        }`}
      >
        <Icon
          className={`w-5 h-5 ${
            tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-accent'
          }`}
        />
      </span>
      <div className="min-w-0">
        <h2 id="price-stock-title" className="font-semibold text-[17px] leading-snug">
          {title}
        </h2>
        <p className="text-sm text-ink-soft mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-[18px] border border-amber-500/30 bg-amber-500/10 p-3.5 mb-4">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-1.5">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Tekshirib ko&apos;ring
      </p>
      <ul className="space-y-1">
        {items.map((w, i) => (
          <li key={i} className="text-xs text-amber-700 dark:text-amber-300">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Issues({ title, items }: { title: string; items: Skipped[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-[18px] border border-line bg-panel p-3.5 mb-4 max-h-40 overflow-y-auto">
      <p className="text-sm font-medium flex items-center gap-2 mb-1.5">
        <Ban className="w-4 h-4 text-muted flex-shrink-0" />
        {title} ({items.length})
      </p>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={`${s.productId}-${i}`} className="text-xs">
            <span className="font-medium">{s.title}</span>
            <span className="text-muted"> — {s.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
