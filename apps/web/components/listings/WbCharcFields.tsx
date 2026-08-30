'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';

/** Backend (getWbCharacteristics) qaytaradigan maydon */
export interface CharcField {
  id: number;
  name: string;
  type: 'number' | 'string';
  required: boolean;
  unit?: string;
  maxCount: number;
  popular: boolean;
  /**
   * Ruxsat etilgan qiymatlar (Yandex ENUM kabi). Bo'lsa ro'yxatdan tanlanadi:
   * erkin matn yuborilsa marketplace qiymatni tanimaydi.
   */
  options?: string[];
  /**
   * Ozon: lug'atli atribut. Erkin matn yozib bo'lmaydi — qiymat lug'atdan
   * qidirib tanlanadi, aks holda Ozon uni jimgina tashlab yuboradi.
   */
  dictionaryId?: number;
}

/**
 * Kategoriyaga mos WB xarakteristikalari — dinamik maydonlar.
 *
 * Kategoriya tanlangandan keyin WB'ning aynan o'sha predmeti uchun maydonlar
 * chiqadi (ko'ylak → ko'ylak maydonlari). Qiymatlar charcID bo'yicha saqlanadi.
 * Majburiy va "popular" maydonlar doim ko'rinadi, qolgani "Ko'proq" ostida.
 */
export function WbCharcFields({
  charcs,
  values,
  onChange,
  loading,
  onAiFill,
  aiFilling,
  searchValues,
}: {
  charcs: CharcField[];
  values: Record<string, string>;
  onChange: (id: number, value: string) => void;
  loading?: boolean;
  /** Ozon lug'atli atributi uchun qiymat qidirish */
  searchValues?: (attributeId: number, query: string) => Promise<string[]>;
  /** Shu bo'limni AI to'ldirsin. Berilmasa tugma ko'rinmaydi */
  onAiFill?: () => void;
  aiFilling?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Kategoriya maydonlari yuklanyapti…
      </p>
    );
  }
  if (!charcs.length) return null;

  const primary = charcs.filter((c) => c.required || c.popular);
  const rest = charcs.filter((c) => !c.required && !c.popular);
  const shown = showAll ? charcs : primary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-accent" />
          Kategoriya xususiyatlari
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{charcs.length} ta maydon</span>
          {onAiFill && (
            <button
              type="button"
              onClick={onAiFill}
              disabled={aiFilling}
              className="btn px-3 py-1.5 text-xs font-medium border border-line text-accent hover:bg-panel transition disabled:opacity-50"
            >
              {aiFilling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiFilling ? "To'ldirilmoqda..." : "AI to'ldirsin"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((c) => (
          <CharcInput
            key={c.id}
            field={c}
            searchValues={searchValues}
            value={values[String(c.id)] || ''}
            onChange={(v) => onChange(c.id, v)}
          />
        ))}
      </div>

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition hover:opacity-80"
        >
          <ChevronDown className={`h-4 w-4 transition ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'Kamroq ko\'rsatish' : `Yana ${rest.length} ta xususiyat`}
        </button>
      )}
    </div>
  );
}

function CharcInput({
  field,
  value,
  onChange,
  searchValues,
}: {
  field: CharcField;
  value: string;
  onChange: (v: string) => void;
  searchValues?: (attributeId: number, query: string) => Promise<string[]>;
}) {
  const base = `w-full px-4 py-2.5 rounded-[14px] border bg-paper/70 text-sm transition focus:outline-none border-line focus:border-accent/50`;
  const multi = field.maxCount > 1;

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {field.name}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
        {/* WB ba'zi nomlarga birlikni o'zi qo'shib beradi ("Вес ... (г)") —
            ikkinchi marta yozsak "(г) (г)" bo'lib chiqadi */}
        {field.unit && !field.name.includes(`(${field.unit})`) && (
          <span className="text-muted font-normal ml-1">({field.unit})</span>
        )}
      </label>
      {field.dictionaryId && searchValues ? (
        <DictionaryInput
          value={value}
          onChange={onChange}
          search={(q) => searchValues(field.id, q)}
          className={base}
        />
      ) : field.options?.length ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Tanlang... ({field.options.length} ta)</option>
          {/* Saqlangan qiymat ro'yxatda bo'lmasa ham ko'rinib tursin */}
          {value && !field.options.includes(value) && (
            <option value={value}>{value} — ro&apos;yxatda yo&apos;q</option>
          )}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={multi ? 'bir nechta — vergul bilan ajrating' : ''}
          className={base}
        />
      )}
      {multi && !field.options?.length && (
        <p className="mt-1 text-xs text-muted">
          {field.maxCount} tagacha qiymat kiritish mumkin
        </p>
      )}
    </div>
  );
}

/**
 * Lug'atdan qidirib tanlanadigan maydon (Ozon).
 *
 * Lug'at o'n minglab qiymatdan iborat bo'lishi mumkin (ИКПУ), shuning uchun
 * ro'yxat oldindan yuklanmaydi — sotuvchi yozgani bo'yicha qidiriladi.
 * Erkin matn qoldirib bo'lmaydi: Ozon uni qabul qilmaydi, lekin xatoni
 * faqat kartochkani rad etganda aytadi.
 */
function DictionaryInput({
  value,
  onChange,
  search,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  search: (query: string) => Promise<string[]>;
  className: string;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    const timer = setTimeout(() => {
      search(query)
        .then((rows) => alive && setItems(rows))
        .catch(() => alive && setItems([]))
        .finally(() => alive && setBusy(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, open, search]);

  if (value && !open) {
    return (
      <div className="flex items-center gap-2">
        <span className={`${className} truncate`}>{value}</span>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery('');
          }}
          className="shrink-0 text-sm text-accent hover:opacity-80"
        >
          O&apos;zgartirish
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Qidirish uchun yozing..."
        className={className}
      />
      {open && (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-[14px] border border-line bg-paper">
          {busy && <p className="px-3 py-2 text-xs text-muted">Qidirilmoqda…</p>}
          {!busy && !items.length && (
            <p className="px-3 py-2 text-xs text-muted">Topilmadi — boshqacha yozib ko&apos;ring</p>
          )}
          {items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-panel"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
