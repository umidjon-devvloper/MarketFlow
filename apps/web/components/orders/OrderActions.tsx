'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Ban, Loader2, Info, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';

interface Capabilities {
  canConfirm: boolean;
  canCancel: boolean;
  cancelNeedsReason: boolean;
  notes: string[];
  reasons: Array<{ id: string; title: string }>;
  reasonsError?: string;
}

/**
 * Buyurtmani tasdiqlash va bekor qilish.
 *
 * Imkoniyatlar serverdan so'raladi va tugmalar SHU JAVOBGA qarab chiziladi.
 * Nega: "tasdiqlash" tushunchasi hamma bozorda yo'q (Ozon va WB'da FBS oqimi
 * boshqacha), WB'da esa bekor qilish umuman ochilmagan — keshdagi ID mos
 * kelmaydi. Tugmani ko'rsatib, keyin xato berish sotuvchini chalg'itadi.
 *
 * Imkoniyatlar faqat qator ochilganda so'raladi: Ozon uchun bu haqiqiy API
 * chaqiruvi (bekor qilish sabablari jo'natmaga qarab farq qiladi), uni
 * ro'yxatdagi har bir buyurtma uchun oldindan qilish limitni sarflardi.
 */
export function OrderActions({
  orderId,
  marketplaceName,
  externalId,
  status,
  onChanged,
}: {
  orderId: string;
  marketplaceName: string;
  externalId: string;
  status: string | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['order-actions', orderId],
    queryFn: async () => (await api.get<Capabilities>(`/orders/${orderId}/actions`)).data,
    staleTime: 60 * 1000,
    retry: false,
  });

  // Allaqachon bekor qilingan buyurtmada amal yo'q
  const closed = /cancel|отмен|bekor/i.test(status || '');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Imkoniyatlar tekshirilmoqda...
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-muted">
        {(error as any)?.response?.data?.error || "Imkoniyatlarni tekshirib bo'lmadi"}
      </p>
    );
  }

  if (!data) return null;

  const handleConfirm = async () => {
    const ok = await confirmDialog({
      title: `Buyurtma #${externalId} tasdiqlansinmi?`,
      description: `${marketplaceName} da buyurtma "qayta ishlanmoqda" holatiga o'tadi va siz uni yig'ish majburiyatini olasiz.`,
      confirmLabel: 'Ha, tasdiqlansin',
    });
    if (!ok) return;

    setBusy('confirm');
    try {
      const { data: result } = await api.post(`/orders/${orderId}/confirm`);
      toast('success', result.message);
      onChanged();
    } catch (err: any) {
      toast('error', err.response?.data?.error || "Tasdiqlab bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-start gap-2.5 flex-wrap">
      {!closed && data.canConfirm && (
        <button
          onClick={handleConfirm}
          disabled={busy !== null}
          className="btn-ghost btn-sm text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
        >
          {busy === 'confirm' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Tasdiqlash
        </button>
      )}

      {!closed && data.canCancel && (
        <button
          onClick={() => setCancelOpen(true)}
          disabled={busy !== null || (data.cancelNeedsReason && !data.reasons.length)}
          className="btn-ghost btn-sm text-red-600 disabled:opacity-50"
        >
          <Ban className="w-3.5 h-3.5" />
          Bekor qilish
        </button>
      )}

      {closed && <p className="text-xs text-muted">Buyurtma yopilgan — amal yo&apos;q</p>}

      {/* Nima uchun imkoniyat yo'qligini aytamiz — jim qolish chalg'itadi */}
      {!closed && data.notes.length > 0 && (
        <p className="text-[11px] text-muted flex items-start gap-1.5 max-w-xl">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>{data.notes[0]}</span>
        </p>
      )}

      {!closed && data.reasonsError && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">{data.reasonsError}</p>
      )}

      {cancelOpen && (
        <CancelDialog
          orderId={orderId}
          externalId={externalId}
          marketplaceName={marketplaceName}
          reasons={data.reasons}
          needsReason={data.cancelNeedsReason}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/**
 * Bekor qilish oynasi.
 *
 * Alohida oyna, oddiy tasdiqlash emas: sabab tanlash majburiy (Yandex va
 * Ozon shuni talab qiladi) va u statistikaga yoziladi — "do'kon aybi" bilan
 * "xaridor fikridan qaytdi" reytingga butunlay boshqacha ta'sir qiladi.
 */
function CancelDialog({
  orderId,
  externalId,
  marketplaceName,
  reasons,
  needsReason,
  onClose,
  onDone,
}: {
  orderId: string;
  externalId: string;
  marketplaceName: string;
  reasons: Array<{ id: string; title: string }>;
  needsReason: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reasonId, setReasonId] = useState(reasons[0]?.id ?? '');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const { data } = await api.post(`/orders/${orderId}/cancel`, {
        reasonId: reasonId || undefined,
        comment: comment.trim() || undefined,
      });
      toast('success', data.message);
      onDone();
    } catch (err: any) {
      toast('error', err.response?.data?.error || "Bekor qilib bo'lmadi");
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-order-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !sending && onClose()}
        aria-hidden="true"
      />

      <div className="relative card p-6 w-full max-w-md animate-fade-up">
        <button
          onClick={onClose}
          disabled={sending}
          aria-label="Yopish"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted transition hover:bg-panel hover:text-ink disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-3.5 mb-5 pr-8">
          <span className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
          </span>
          <div className="min-w-0">
            <h2 id="cancel-order-title" className="font-semibold text-[17px] leading-snug">
              Buyurtma bekor qilinsinmi?
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              <span className="font-mono">#{externalId}</span> — {marketplaceName}.
              Buni qaytarib bo&apos;lmaydi va bekor qilish sotuvchi reytingiga yoziladi.
            </p>
          </div>
        </div>

        {needsReason && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">
              Sabab <span className="text-red-500">*</span>
            </label>
            <select
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[14px] border border-line bg-paper/70 text-sm focus:outline-none focus:border-accent/50"
            >
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1.5">
              Sabab statistikaga yoziladi — &laquo;do&apos;kon aybi&raquo; va &laquo;xaridor
              fikridan qaytdi&raquo; reytingga har xil ta&apos;sir qiladi.
            </p>
          </div>
        )}

        <label className="block text-sm font-medium mb-1.5">
          Izoh <span className="text-muted font-normal">(ixtiyoriy)</span>
        </label>
        <textarea
          rows={2}
          value={comment}
          maxLength={500}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Masalan: omborda tovar tugadi"
          className="w-full px-4 py-2.5 rounded-[14px] border border-line bg-paper/70 text-sm focus:outline-none focus:border-accent/50"
        />

        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} disabled={sending} className="btn-ghost btn-sm flex-1">
            Yo&apos;q, qoldirilsin
          </button>
          <button
            onClick={submit}
            disabled={sending || (needsReason && !reasonId)}
            className="btn btn-sm flex-1 text-white font-semibold bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            Ha, bekor qilinsin
          </button>
        </div>
      </div>
    </div>
  );
}
