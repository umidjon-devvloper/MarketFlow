'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, X, Tag, FileText, Layers } from 'lucide-react';

export type SkipAction = 'prepare' | 'category' | 'other';

export interface SkippedProduct {
  productId: string;
  title: string;
  reason: string;
  action: SkipAction;
  missing: string[];
}

/**
 * "Bu kartochkalar tayyor emas" paneli.
 *
 * Ilgari bu xato bitta toast edi: «Hech bir mahsulot navbatga qo'shilmadi.
 * Short + brend: Kategoriya ID, Tovar turi ID». Sotuvchi uchun bu boshi berk
 * ko'cha — "Kategoriya ID" nima ekani va uni qayerdan olish kerakligi
 * ayтilmagan.
 *
 * Endi har bir mahsulot uchun sababi va TUGMASI ko'rsatiladi: bosgan zahoti
 * mos sehrgar ochiladi, maydonlar eski kartochkadan ko'chiriladi va faqat
 * kategoriyani tanlash qoladi.
 */
export function NotReadyPanel({
  items,
  marketplace,
  marketplaceName,
  onClose,
  onBulkCategory,
}: {
  items: SkippedProduct[];
  marketplace: string;
  marketplaceName: string;
  onClose: () => void;
  /** Bir nechta kartochkaga bitta kategoriyani birdan qo'yish */
  onBulkCategory?: (productIds: string[]) => void;
}) {
  if (!items.length) return null;

  const prepare = items.filter((i) => i.action === 'prepare');
  const category = items.filter((i) => i.action === 'category');
  const other = items.filter((i) => i.action === 'other');

  return (
    <div className="card mb-6 overflow-hidden border-amber-500/40">
      <div className="p-4 flex items-start gap-3.5">
        <span className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {items.length} ta kartochka {marketplaceName} uchun tayyor emas
          </p>
          <p className="text-sm text-ink-soft mt-1">
            {marketplaceName} kartochka yaratishda kategoriyani <b>raqamli ID</b> bilan
            talab qiladi — uni faqat o&apos;z katalogidan tanlash mumkin. Matn bilan
            yozilgan kategoriya (masalan &laquo;Uzum katalogi/kiyim&raquo;) yaramaydi.
          </p>
        </div>

        <button
          onClick={onClose}
          aria-label="Yopish"
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted transition hover:bg-panel hover:text-ink flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y border-t border-line">
        {prepare.length > 0 && (
          <Group
            icon={FileText}
            title={`${prepare.length} tasi ${marketplaceName} uchun tayyorlanmagan`}
            hint="Maydonlar mavjud kartochkadan ko'chiriladi — noldan to'ldirmaysiz."
            items={prepare}
            marketplace={marketplace}
            cta="Tayyorlash"
          />
        )}

        {category.length > 0 && (
          <Group
            icon={Tag}
            title={`${category.length} tasida kategoriya tanlanmagan`}
            hint="Bir turdagi tovarlar bir xil kategoriyaga tushadi — hammasiga birdan qo'ysangiz bo'ladi."
            items={category}
            marketplace={marketplace}
            cta="Alohida tanlash"
            bulkCta={
              category.length > 1 && onBulkCategory
                ? {
                    label: `${category.length} tasiga birdan tanlash`,
                    onClick: () => onBulkCategory(category.map((i) => i.productId)),
                  }
                : undefined
            }
          />
        )}

        {other.length > 0 && (
          <Group
            icon={AlertTriangle}
            title={`${other.length} tasida boshqa maydonlar yetishmayapti`}
            items={other}
            marketplace={marketplace}
            cta="To'ldirish"
          />
        )}
      </div>
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  hint,
  items,
  marketplace,
  cta,
  bulkCta,
}: {
  icon: typeof Tag;
  title: string;
  hint?: string;
  items: SkippedProduct[];
  marketplace: string;
  cta: string;
  bulkCta?: { label: string; onClick: () => void };
}) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted flex-shrink-0" />
            {title}
          </p>
          {hint && <p className="text-xs text-muted mt-1 ml-6">{hint}</p>}
        </div>

        {/* Asosiy yo'l — bittalab emas, hammasiga birdan */}
        {bulkCta && (
          <button onClick={bulkCta.onClick} className="btn-primary btn-sm flex-shrink-0">
            <Layers className="w-4 h-4" />
            {bulkCta.label}
          </button>
        )}
      </div>

      <ul className="mt-3 ml-6 space-y-2">
        {items.slice(0, 6).map((item) => (
          <li key={item.productId} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{item.title}</p>
              {item.missing.length > 0 && (
                <p className="text-[11px] text-muted truncate">
                  yetishmayapti: {item.missing.join(', ')}
                </p>
              )}
            </div>

            <Link
              href={`/dashboard/products/new/${marketplace.toLowerCase()}?from=${item.productId}`}
              className="btn-ghost btn-sm flex-shrink-0"
            >
              {cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </li>
        ))}
      </ul>

      {items.length > 6 && (
        <p className="text-xs text-muted mt-2 ml-6">…va yana {items.length - 6} ta</p>
      )}
    </div>
  );
}
