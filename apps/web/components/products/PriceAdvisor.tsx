'use client';

/**
 * AI narx maslahatchisi — "Narx va zaxira" bo'limi tepasida turadi.
 *
 * Ikki ish qiladi:
 *   1. Narx bo'sh bo'lsa — AI bozorga qarab narx tavsiya qiladi, bir bosishda
 *      maydonga qo'yiladi.
 *   2. Narx kiritilgan bo'lsa — AI o'sha narxga baho beradi: bozorga to'g'ri
 *      keladimi, kelmasa qanchaga o'zgartirish kerak.
 *
 * Tavsiya olingandan keyin sotuvchi narxni qo'lda o'zgartirsa, oraliqqa
 * tushish-tushmasligi darhol ko'rsatiladi — buning uchun qayta so'rov
 * yuborilmaydi (har chaqiruv AI limitidan yeydi).
 */

import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export interface PriceAdviceResult {
  currency: string;
  min: number;
  recommended: number;
  max: number;
  summary: string;
  factors: string[];
  verdict: { level: 'low' | 'ok' | 'high'; message: string } | null;
  confidence: 'low' | 'medium' | 'high';
  warnings: string[];
  provider: 'openai' | 'gemini';
}

interface Props {
  marketplace: string;
  /** Marketplace rangi — tugma shu rangda bo'ladi */
  color: string;
  currency: string;
  values: Record<string, string>;
  onApplyPrice: (price: number) => void;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'ishonch yuqori',
  medium: "ishonch o'rtacha",
  low: 'ishonch past',
};

function fmt(value: number, currency: string): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ${currency}`;
}

export function PriceAdvisor({ marketplace, color, currency, values, onApplyPrice }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<PriceAdviceResult | null>(null);

  const typedPrice = Number(String(values.price ?? '').replace(',', '.')) || 0;
  const hasPrice = typedPrice > 0;

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/cards/price-advice', {
        marketplace,
        values,
        // Narx kiritilgan bo'lsa — unga baho so'raymiz
        ...(hasPrice ? { price: typedPrice } : {}),
      });
      setAdvice(data as PriceAdviceResult);
      toast('success', hasPrice ? 'AI narxingizni baholadi' : 'AI narx tavsiya qildi');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'AI narx tavsiyasi olinmadi');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sotuvchi narxni o'zgartirgandan keyingi jonli holat.
   * AI javobidagi oraliqqa solishtiriladi — yangi so'rov yuborilmaydi.
   */
  const liveCheck = (() => {
    if (!advice || !hasPrice) return null;
    if (typedPrice < advice.min) {
      return {
        tone: 'amber' as const,
        text: `Narxingiz bozor oralig'idan past (${fmt(advice.min, advice.currency)} dan boshlanadi) — foyda qolmasligi mumkin.`,
      };
    }
    if (typedPrice > advice.max) {
      return {
        tone: 'amber' as const,
        text: `Narxingiz bozor oralig'idan yuqori (${fmt(advice.max, advice.currency)} gacha) — sotilishi sekinlashadi.`,
      };
    }
    return {
      tone: 'green' as const,
      text: `Narxingiz bozor oralig'ida — ${fmt(advice.min, advice.currency)} … ${fmt(advice.max, advice.currency)}.`,
    };
  })();

  const verdictTone =
    advice?.verdict?.level === 'ok' ? 'green' : advice?.verdict ? 'amber' : null;

  return (
    <div className="mt-4 rounded-[20px] border p-4" style={{ background: `${color}0d`, borderColor: `${color}40` }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color }} />
          <div>
            <p className="font-semibold">
              {hasPrice ? "Narxingiz bozorga to'g'ri keladimi?" : "Narxni AI qo'yib bersinmi?"}
            </p>
            <p className="text-sm text-muted mt-0.5">
              {hasPrice
                ? 'AI kiritgan narxingizni bozor bilan solishtiradi va nima qilish kerakligini aytadi.'
                : `Mahsulot ma'lumotlari va kuzatuvdagi raqobatchi narxlariga qarab ${currency} da tavsiya beradi.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="btn px-5 py-2.5 text-white font-semibold shadow-btn transition hover:shadow-btn-hover disabled:opacity-50 whitespace-nowrap"
          style={{ background: color }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Hisoblanmoqda...' : hasPrice ? 'Narxni tekshirish' : "AI bilan narx qo'yish"}
        </button>
      </div>

      {advice && (
        <div className="mt-4 rounded-[16px] border border-line bg-paper p-4">
          {/* Tavsiya etilgan narx */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <div>
              <p className="text-xs text-muted">Tavsiya etilgan narx</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(advice.recommended, advice.currency)}</p>
            </div>
            <p className="text-sm text-muted mb-1 tabular-nums">
              oraliq: {fmt(advice.min, advice.currency)} … {fmt(advice.max, advice.currency)}
            </p>
            <span className="mb-1.5 text-[11px] px-2 py-0.5 rounded-full border border-line text-muted">
              {CONFIDENCE_LABEL[advice.confidence]} · {advice.provider}
            </span>
            <button
              type="button"
              onClick={() => {
                onApplyPrice(advice.recommended);
                toast('success', "Narx qo'yildi");
              }}
              className="ml-auto btn px-4 py-2 border border-line font-medium hover:bg-panel transition"
            >
              <Check className="w-4 h-4" />
              Shu narxni qo&apos;yish
            </button>
          </div>

          {advice.summary && <p className="text-sm mt-3">{advice.summary}</p>}

          {/* AI ning kiritilgan narxga bahosi */}
          {advice.verdict && (
            <p
              className={`text-sm mt-3 rounded-xl px-3 py-2 border ${
                verdictTone === 'green'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              {advice.verdict.message}
            </p>
          )}

          {/* Narx qo'lda o'zgartirilsa — jonli tekshiruv, qayta so'rovsiz */}
          {liveCheck && (
            <p
              className={`text-xs mt-2 ${
                liveCheck.tone === 'green'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {liveCheck.text}
            </p>
          )}

          {advice.factors.length > 0 && (
            <ul className="text-xs text-muted mt-3 space-y-0.5">
              {advice.factors.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
          )}

          {advice.warnings.length > 0 && (
            <div className="mt-3 flex gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <ul className="space-y-0.5">
                {advice.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
