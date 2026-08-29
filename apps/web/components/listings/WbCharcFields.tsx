'use client';

import { useState } from 'react';
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
}: {
  charcs: CharcField[];
  values: Record<string, string>;
  onChange: (id: number, value: string) => void;
  loading?: boolean;
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
}: {
  field: CharcField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = `w-full px-4 py-2.5 rounded-[14px] border bg-paper/70 text-sm transition focus:outline-none border-line focus:border-accent/50`;
  const multi = field.maxCount > 1;

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {field.name}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
        {field.unit && <span className="text-muted font-normal ml-1">({field.unit})</span>}
      </label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={multi ? 'bir nechta — vergul bilan ajrating' : ''}
        className={base}
      />
      {multi && (
        <p className="mt-1 text-xs text-muted">
          {field.maxCount} tagacha qiymat kiritish mumkin
        </p>
      )}
    </div>
  );
}
