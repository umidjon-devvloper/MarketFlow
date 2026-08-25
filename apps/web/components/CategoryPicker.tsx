'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, Check, ChevronDown, AlertTriangle, X } from 'lucide-react';
import { api } from '@/lib/api';

export interface CategoryOption {
  id: string;
  name: string;
  path: string;
  /** Ozon'da tovar turi — kategoriya bilan juftlikda yuboriladi */
  typeId?: string;
}

interface CategoryPickerProps {
  marketplace: string;
  /** Ko'rinadigan nom (spec'dagi `category` maydoni) */
  value: string;
  /** Tanlangan ID (spec'dagi `categoryId`) — bo'sh bo'lsa hali tanlanmagan */
  categoryId: string;
  onSelect: (option: CategoryOption | null) => void;
  error?: string;
}

/**
 * Marketplace kategoriyasini katalogdan tanlash.
 *
 * Nega oddiy matn maydoni yaramaydi: Ozon, WB va Yandex kartochka yaratishda
 * raqamli identifikator talab qiladi ("Erkaklar ko'ylagi" emas, 17028922).
 * Uni faqat marketplace katalogidan olish mumkin, ya'ni kalit ulangan
 * bo'lishi kerak.
 *
 * Kalit ulanmagan bo'lsa tanlagich bloklanmaydi — sotuvchi nomni qo'lda
 * yozib, Excel eksportini davom ettira oladi. Faqat "API orqali joylash"
 * tugmasi ishlamaydi va buning sababi aytiladi.
 */
export function CategoryPicker({
  marketplace,
  value,
  categoryId,
  onSelect,
  error,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Tashqariga bosilganda yopiladi
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const { data, isFetching, isError, error: queryError } = useQuery({
    queryKey: ['categories', marketplace, debounced],
    queryFn: async () =>
      (
        await api.get(`/cards/categories/${marketplace.toLowerCase()}`, {
          params: { q: debounced || undefined, limit: 40 },
        })
      ).data.items as CategoryOption[],
    enabled: open,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const options = useMemo(() => data ?? [], [data]);

  // Ro'yxat yangilanganda tanlov boshiga qaytadi
  useEffect(() => setHighlight(0), [options]);

  const notConnected =
    isError && (queryError as any)?.response?.status === 400;
  const errorText =
    (queryError as any)?.response?.data?.error || (queryError as Error)?.message;

  // Nom bor, lekin katalog ID si yo'q — bu asosiy mahsulotdan ko'chirilgan
  // matn, HALI katalogdan tanlanmagan. Ko'rinishi "to'ldirilgan"dek, aslida
  // joylashda rad etiladi. Shuni aniq ko'rsatamiz.
  const needsCatalogSelect = !!value && !categoryId;

  const choose = (option: CategoryOption) => {
    onSelect(option);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
    if (e.key === 'Enter' && options[highlight]) {
      e.preventDefault();
      choose(options[highlight]);
    }
  };

  const inputClass = `w-full pl-4 pr-10 py-2.5 rounded-[14px] border bg-paper/70 text-sm text-left transition focus:outline-none ${
    error ? 'border-red-500/60' : 'border-line focus:border-accent/50'
  }`;

  return (
    <div ref={boxRef} className="relative">
      {/* Tanlangan holat — tugma, tanlanmagan — qidiruv maydoni */}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={`${inputClass} flex items-center justify-between gap-2 ${
            needsCatalogSelect ? 'border-amber-500/70' : ''
          }`}
        >
          <span
            className={
              needsCatalogSelect
                ? 'text-amber-700 dark:text-amber-400'
                : value
                  ? ''
                  : 'text-muted'
            }
          >
            {value || 'Katalogdan tanlang...'}
          </span>
          {needsCatalogSelect ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 absolute right-3" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted flex-shrink-0 absolute right-3" />
          )}
        </button>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Kategoriya nomini yozing..."
            aria-label="Kategoriya qidirish"
            className={`${inputClass} pl-10`}
          />
          {isFetching && (
            <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
          )}
        </div>
      )}

      {/* Tanlangan ID — sotuvchi nima yuborilishini ko'rib tursin */}
      {categoryId && !open && (
        <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono">
            ID {categoryId}
            {/* Ozon juftlik talab qiladi — ikkalasi ham ko'rinsin */}
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Kategoriya tanlovini bekor qilish"
            className="ml-1 text-muted hover:text-red-600 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </p>
      )}

      {/* Nom bor, ID yo'q — "to'ldirilgandek" ko'rinadi, lekin joylanmaydi */}
      {needsCatalogSelect && !open && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>
            «{value}» faqat matn — hali katalogdan tanlanmagan. Bosib, ro&apos;yxatdan tanlang
            (ID shundan olinadi), aks holda joylab bo&apos;lmaydi.
          </span>
        </p>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 card p-0 overflow-hidden max-h-72 overflow-y-auto">
          {notConnected || isError ? (
            <div className="p-4 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Katalogni ochib bo'lmadi</p>
                <p className="text-xs text-muted mt-1">{errorText}</p>
                <p className="text-xs text-muted mt-2">
                  Kategoriya nomini qo'lda yozsangiz Excel eksporti ishlaydi, lekin API orqali
                  joylash uchun katalogdan tanlash shart.
                </p>
              </div>
            </div>
          ) : isFetching && !options.length ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : options.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              {debounced ? `"${debounced}" bo'yicha hech narsa topilmadi` : "Ro'yxat bo'sh"}
            </p>
          ) : (
            <ul role="listbox">
              {options.map((option, index) => (
                <li key={`${option.id}-${option.typeId ?? ''}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(option)}
                    className={`w-full text-left px-4 py-2.5 transition ${
                      index === highlight ? 'bg-accent-soft' : 'hover:bg-panel'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{option.name}</p>
                    {option.path !== option.name && (
                      <p className="text-[11px] text-muted truncate mt-0.5">{option.path}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {!error && !categoryId && value && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
          Nom qo'lda yozilgan — Excel uchun yetarli, API orqali joylash uchun katalogdan tanlang
        </p>
      )}
    </div>
  );
}
