'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Wand2,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  Trash2,
  Save,
  Send,
} from 'lucide-react';
import { api } from '@/lib/api';
import { UploadDropzone } from '@/components/UploadDropzone';
import { CategoryPicker, CategoryOption } from '@/components/CategoryPicker';
import { WbCharcFields, CharcField } from '@/components/listings/WbCharcFields';
import { RemoteImage } from '@/components/RemoteImage';
import { QualityPanel, QualityScore } from '@/components/quality/QualityBadge';
import { PriceAdvisor } from '@/components/products/PriceAdvisor';
import { TnvedPicker } from '@/components/products/TnvedPicker';
import { useToast } from '@/components/Toast';
import { SkeletonPage } from '@/components/Skeleton';
import {
  downloadBlob,
  fileNameFromResponse,
  summarizeWarnings,
  warningsFromResponse,
} from '@/lib/export';

// ============================================
// Turlar (backend specs.ts bilan bir xil)
// ============================================

interface SpecField {
  key: string;
  label: string;
  excelHeader: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'tags' | 'category';
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  unit?: string;
  options?: string[];
  placeholder?: string;
  hint?: string;
  /** Qiymat shakli (regex) — masalan TN VED uchun 10 ta raqam */
  pattern?: string;
  patternHint?: string;
  /** Variantlar marketplace'dan kategoriyaga qarab olinadi */
  optionsFrom?: 'wb-tnved';
  aiFillable?: boolean;
  mapsTo?: string;
  /** Formada ko'rsatilmaydi — kategoriya tanlagichi to'ldiradi */
  hidden?: boolean;
  /** Faqat API orqali joylashda majburiy (Excel uchun emas) */
  publishRequired?: boolean;
}

interface SpecGroup {
  key: string;
  label: string;
  description?: string;
  fields: SpecField[];
}

interface ImageSpec {
  minWidth: number;
  minHeight: number;
  targetWidth: number;
  targetHeight: number;
  aspectRatio: string;
  background: string;
  formats: string[];
  maxSizeMB: number;
  minCount: number;
  maxCount: number;
  notes: string[];
}

interface MarketplaceSpec {
  id: 'UZUM' | 'OZON' | 'WB' | 'YANDEX';
  name: string;
  logo: string;
  color: string;
  currency: string;
  docsUrl: string;
  uploadHint: string;
  canPublishViaApi: boolean;
  image: ImageSpec;
  groups: SpecGroup[];
}

interface AdaptInfo {
  url: string;
  fileKey: string;
  width: number;
  height: number;
  sizeKB: number;
  steps: string[];
  warnings: string[];
}

interface PrefillResponse {
  values: Record<string, string>;
  copied: string[];
  needsReview: Array<{ key: string; label: string; reason: string }>;
  missing: Array<{ key: string; label: string }>;
  sourceMarketplace: string | null;
  alreadyExists: boolean;
  product: { id: string; title: string };
  images: {
    originals: Array<{ url: string; fileKey: string | null }>;
    adapted: Array<{ url: string; fileKey: string | null }>;
  };
}

interface WizardImage {
  url: string;
  fileKey: string;
  adapted?: AdaptInfo;
  adapting?: boolean;
  error?: string;
}

const STEPS = [
  { key: 'images', label: 'Rasm yuklash' },
  { key: 'adapt', label: 'AI moslashtirish' },
  { key: 'fields', label: "Maydonlarni to'ldirish" },
  { key: 'export', label: 'Excel' },
];

/** Query kalitida ishlatiladigan barqaror snapshot — bo'sh maydonlar hisobga olinmaydi */
function filledCountKey(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, v]) => (v ?? '').toString().trim())
    .map(([k, v]) => `${k}:${String(v).length}`)
    .sort()
    .join('|');
}

export default function NewCardPage() {
  const params = useParams<{ marketplace: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const marketplace = (params.marketplace || '').toUpperCase();
  // ?from=<productId> — mavjud kartochkadan davom etamiz
  const fromProductId = searchParams.get('from');

  const [step, setStep] = useState(0);
  const [images, setImages] = useState<WizardImage[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  // Kategoriyaga mos dinamik xarakteristikalar — charcID → qiymat
  const [wbCharcs, setWbCharcs] = useState<Record<string, string>>({});
  const [aiFilling, setAiFilling] = useState(false);
  /** Kategoriya xususiyatlari bo'limidagi tugma alohida kutadi */
  const [charcFilling, setCharcFilling] = useState(false);
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);

  const { data: spec, isLoading, error } = useQuery({
    queryKey: ['card-spec', marketplace],
    queryFn: async () => (await api.get(`/cards/specs/${marketplace}`)).data as MarketplaceSpec,
    enabled: !!marketplace,
    staleTime: 60 * 60 * 1000,
  });

  const { data: prefill } = useQuery({
    queryKey: ['card-prefill', fromProductId, marketplace],
    queryFn: async () =>
      (await api.get(`/cards/${fromProductId}/prefill/${marketplace}`)).data as PrefillResponse,
    enabled: !!fromProductId && !!marketplace,
  });

  // Kategoriya tanlanganda WB'ning aynan o'sha predmeti xarakteristikalari
  const subjectId = values.categoryId;
  const { data: charcData, isFetching: charcsLoading } = useQuery({
    queryKey: ['card-charcs', marketplace, subjectId],
    queryFn: async () =>
      (
        await api.get(`/cards/categories/${marketplace}/charcs`, {
          params: { subjectId },
        })
      ).data as { charcs: CharcField[] },
    enabled: spec?.id === 'WB' && !!subjectId,
    staleTime: 30 * 60 * 1000,
  });
  const charcFields: CharcField[] = charcData?.charcs || [];

  // Tayyor qiymatlar va rasmlarni bir marta joylashtiramiz
  useEffect(() => {
    if (!prefill || prefillApplied) return;

    setValues((prev) => ({ ...prefill.values, ...prev }));
    // Oldin saqlangan dinamik xarakteristikalar (charcID → qiymat) bo'lsa yuklaymiz
    const savedCharcs = (prefill.values as Record<string, unknown>)?.wbCharacteristics;
    if (savedCharcs && typeof savedCharcs === 'object') {
      setWbCharcs(savedCharcs as Record<string, string>);
    }
    setImages(
      prefill.images.adapted.length
        ? prefill.images.adapted.map((i) => ({
            url: i.url,
            fileKey: i.fileKey || i.url,
            adapted: {
              url: i.url,
              fileKey: i.fileKey || i.url,
              width: 0,
              height: 0,
              sizeKB: 0,
              steps: ['Oldin moslashtirilgan'],
              warnings: [],
            },
          }))
        : prefill.images.originals.map((i) => ({ url: i.url, fileKey: i.fileKey || i.url })),
    );
    setPrefillApplied(true);
    // Rasm bor, maydonlar to'ldirilgan — to'g'ridan-to'g'ri moslashtirishga o'tamiz
    setStep(1);
  }, [prefill, prefillApplied]);

  const allFields = useMemo(() => spec?.groups.flatMap((g) => g.fields) ?? [], [spec]);

  // Jonli sifat bahosi — faqat yakun qadamida so'raladi (bazaga tegmaydi).
  // Maydonlar shu qadamda o'zgarmaydi, shuning uchun har harfda emas.
  const { data: quality } = useQuery({
    queryKey: ['card-quality', spec?.id, step, filledCountKey(values), images.length],
    queryFn: async () =>
      (
        await api.post('/cards/quality', {
          marketplace: spec!.id,
          values,
          imageCount: images.length,
        })
      ).data as QualityScore,
    enabled: step === 3 && !!spec,
    staleTime: 10_000,
  });


  // Eksport uchun rasm ro'yxati: moslashtirilgani bo'lsa o'sha, bo'lmasa asl
  const exportImageUrls = images.map((img) => img.adapted?.url || img.url);

  // ============================================
  // Validatsiya
  // ============================================

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const field of allFields) {
      // Yashirin maydonlarni (kategoriya ID) sotuvchi qo'lda to'ldirmaydi —
      // ular publish paytida serverda tekshiriladi
      if (field.hidden) continue;
      const raw = (values[field.key] ?? '').toString().trim();

      if (!raw) {
        if (field.required) errors[field.key] = "To'ldirilishi shart";
        continue;
      }
      if (field.type === 'number') {
        const num = Number(raw);
        if (!Number.isFinite(num)) errors[field.key] = 'Son kiriting';
        else if (field.min !== undefined && num < field.min) errors[field.key] = `Kamida ${field.min}`;
        else if (field.max !== undefined && num > field.max) errors[field.key] = `Ko'pi bilan ${field.max}`;
        continue;
      }
      if (field.maxLength && raw.length > field.maxLength) {
        errors[field.key] = `${field.maxLength} belgidan oshdi (${raw.length})`;
        continue;
      }
      // Marketplace formatni qat'iy tekshiradigan maydonlar (TN VED kabi):
      // noto'g'ri qiymat kartochkani kabinetda qizil xatoga aylantiradi
      if (field.pattern && !new RegExp(field.pattern).test(raw)) {
        errors[field.key] = field.patternHint || "Format noto'g'ri";
      }
    }
    return errors;
  }, [allFields, values]);

  const errorCount = Object.keys(fieldErrors).length;
  const filledCount = allFields.filter((f) => (values[f.key] ?? '').toString().trim()).length;

  // ============================================
  // Amallar
  // ============================================

  /**
   * Kategoriya tanlanganda uchta maydon birga yoziladi:
   *   category   — ko'rinadigan nom (Product.category ga tushadi, Excel'ga chiqadi)
   *   categoryId — marketplace ID si (API uchun)
   *   typeId     — faqat Ozon: tovar turi, kategoriya bilan juftlikda majburiy
   *
   * Bekor qilinganda uchalasi ham tozalanadi — aks holda eski ID yangi nom
   * bilan qolib ketib, boshqa kategoriyaga tovar joylanardi.
   */
  const handleCategorySelect = (option: CategoryOption | null) => {
    setValues((prev) => ({
      ...prev,
      category: option?.name ?? '',
      categoryId: option?.id ?? '',
      typeId: option?.typeId ?? '',
    }));
    // Yangi kategoriya — eski kategoriyaning xarakteristikalari tozalanadi
    setWbCharcs({});
  };

  const handleUpload = (uploaded: { url: string; fileKey: string }) => {
    setImages((prev) => {
      if (spec && prev.length >= spec.image.maxCount) {
        toast('error', `${spec.name} uchun ${spec.image.maxCount} tadan ko'p rasm bo'lmaydi`);
        return prev;
      }
      return [...prev, { ...uploaded }];
    });
  };

  const removeImage = (fileKey: string) =>
    setImages((prev) => prev.filter((img) => img.fileKey !== fileKey));

  /** Bitta rasmni marketplace o'lchamiga moslashtirish */
  const adaptOne = async (fileKey: string) => {
    if (!spec) return;
    const target = images.find((i) => i.fileKey === fileKey);
    if (!target) return;

    setImages((prev) =>
      prev.map((i) => (i.fileKey === fileKey ? { ...i, adapting: true, error: undefined } : i)),
    );

    try {
      const { data } = await api.post('/cards/adapt-image', {
        marketplace: spec.id,
        imageUrl: target.url,
        removeBg: true,
      });
      setImages((prev) =>
        prev.map((i) => (i.fileKey === fileKey ? { ...i, adapted: data, adapting: false } : i)),
      );
    } catch (err: any) {
      const message = err.response?.data?.error || 'Moslashtirib bo\'lmadi';
      setImages((prev) =>
        prev.map((i) => (i.fileKey === fileKey ? { ...i, adapting: false, error: message } : i)),
      );
      toast('error', message);
    }
  };

  const adaptAll = async () => {
    for (const img of images) {
      if (!img.adapted) await adaptOne(img.fileKey);
    }
  };

  /**
   * AI rasmga qarab maydonlarni to'ldiradi.
   *
   * scope='charcs' — faqat kategoriya xususiyatlari (o'sha bo'limdagi tugma).
   * Asosiy maydonlar so'ralmaydi: ular allaqachon to'ldirilgan bo'ladi va
   * qayta so'rash bekorga token sarflaydi.
   */
  const runAiFill = async (scope: 'all' | 'charcs' = 'all') => {
    if (!spec) return;
    if (!exportImageUrls.length) {
      toast('error', 'Avval rasm yuklang');
      return;
    }
    if (scope === 'charcs' && !charcFields.length) {
      toast('error', "Avval kategoriyani tanlang — xususiyatlar shundan keyin chiqadi");
      return;
    }

    const setBusy = scope === 'charcs' ? setCharcFilling : setAiFilling;
    setBusy(true);
    setAiNotes([]);
    try {
      const hints: Record<string, string> = {};
      // Foydalanuvchi allaqachon kiritgan qiymatlar AI ga kontekst bo'ladi
      for (const field of allFields) {
        const raw = (values[field.key] ?? '').toString().trim();
        if (raw) hints[field.label] = raw;
      }

      const { data } = await api.post('/cards/ai-fill', {
        marketplace: spec.id,
        imageUrls: exportImageUrls.slice(0, 4),
        hints,
        scope,
        // TN VED ro'yxati kategoriyaga bog'liq — AI shundan tanlaydi
        categoryId: values.categoryId || undefined,
        // Kategoriya xususiyatlari ham to'ldirilsin — ular spec'da yo'q,
        // kategoriya tanlangandan keyin marketplace'dan keladi
        charcs: charcFields.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          required: c.required,
          unit: c.unit,
          maxCount: c.maxCount,
          popular: c.popular,
        })),
      });

      // AI faqat bo'sh maydonlarni to'ldiradi — qo'lda yozilganini buzmaydi
      setValues((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(data.values as Record<string, string>)) {
          if (!(next[key] ?? '').toString().trim()) next[key] = value;
        }
        // Kategoriya nomi va ID — ajralmas juftlik. Server ID qaytargan
        // bo'lsa (ya'ni oldin tanlanmagan edi), nomni ham katalogdagi nomga
        // almashtiramiz: aks holda "Футболки" nomi 219 (Футболки-поло) ID si
        // bilan qolib, sotuvchi nima joylanayotganini tushunmaydi.
        if (data.values?.categoryId) {
          next.categoryId = data.values.categoryId;
          if (data.values.category) next.category = data.values.category;
        }
        return next;
      });

      const charcValues = (data.charcValues || {}) as Record<string, string>;
      if (Object.keys(charcValues).length) {
        setWbCharcs((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(charcValues)) {
            if (!(next[id] ?? '').trim()) next[id] = value;
          }
          return next;
        });
      }

      setAiNotes(data.notes || []);
      const count = Object.keys(data.values || {}).length;
      const charcCount = Object.keys(charcValues).length;

      if (scope === 'charcs') {
        toast(
          charcCount ? 'success' : 'info',
          charcCount
            ? `AI ${charcCount} ta xususiyatni to'ldirdi (${data.provider})`
            : 'AI rasmdan hech narsa aniqlay olmadi — qo\'lda kiriting',
        );
      } else {
        toast(
          'success',
          charcCount
            ? `AI ${count} ta maydon va ${charcCount} ta xususiyatni to'ldirdi (${data.provider})`
            : `AI ${count} ta maydonni to'ldirdi (${data.provider})`,
        );
      }
    } catch (err: any) {
      toast('error', err.response?.data?.error || "AI to'ldirish ishlamadi");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!spec) return;
    setShowErrors(true);
    if (errorCount > 0) {
      toast('error', `${errorCount} ta maydon to'g'ri emas`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        marketplace: spec.id,
        // Kategoriyaga mos dinamik xarakteristikalarni ham qo'shamiz
        values: Object.keys(wbCharcs).length ? { ...values, wbCharacteristics: wbCharcs } : values,
        images: images.map((img) => ({
          url: img.adapted?.url || img.url,
          fileKey: img.adapted?.fileKey || img.fileKey,
          originalUrl: img.url,
          isAdapted: !!img.adapted,
        })),
      };

      // Mavjud mahsulotdan kelgan bo'lsak — yangi Product yaratmaymiz,
      // shu mahsulotga yangi marketplace kartochkasini qo'shamiz
      const { data } = fromProductId
        ? await api.post(`/cards/${fromProductId}/listings`, payload)
        : await api.post('/cards', payload);

      setSavedId(fromProductId || data.product.id);
      toast('success', 'Kartochka saqlandi');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  };

  /** Kartochkani marketplace API'si orqali joylash */
  const handlePublish = async () => {
    if (!spec || !savedId) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const { data } = await api.post(`/cards/${savedId}/publish/${spec.id}`);
      setPublishResult(data);
      toast('success', data.message);
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Joylashda xato';
      setPublishResult({ success: false, message });
      toast('error', message);
    } finally {
      setPublishing(false);
    }
  };

  const handleExport = async () => {
    if (!spec) return;
    setExporting(true);
    try {
      const res = await api.post(
        '/cards/export',
        savedId
          ? { marketplace: spec.id, productIds: [savedId] }
          : { marketplace: spec.id, rows: [{ values, imageUrls: exportImageUrls }] },
        { responseType: 'blob' },
      );
      downloadBlob(res.data, fileNameFromResponse(res, `${spec.id.toLowerCase()}-kartochka.xlsx`));
      const issues = summarizeWarnings(warningsFromResponse(res));
      toast(issues ? 'info' : 'success', issues ? `Yuklandi, lekin: ${issues}` : 'Excel yuklab olindi');
    } catch {
      toast('error', 'Excel tayyorlashda xato');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  if (isLoading) {
    return <SkeletonPage label="Marketplace talablari yuklanmoqda" />;
  }

  if (error || !spec) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted mb-4">Bunday marketplace topilmadi</p>
        <Link href="/dashboard/products" className="text-accent hover:underline">
          Mahsulotlarga qaytish
        </Link>
      </div>
    );
  }

  const canLeaveImages = images.length >= spec.image.minCount;
  const adaptedCount = images.filter((i) => i.adapted).length;

  return (
    <div>
      {/* Sarlavha */}
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Mahsulotlarga qaytish
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-line bg-paper flex items-center justify-center">
            <RemoteImage src={spec.logo} alt={spec.name} fit="contain" sizes="64px" className="w-full h-full" priority />
          </div>
          <div>
            <h1 className="text-[30px] font-bold tracking-tight">{spec.name} kartochkasi</h1>
            <p className="text-muted mt-0.5">
              {allFields.length} ta maydon · rasm {spec.image.targetWidth}×{spec.image.targetHeight} (
              {spec.image.aspectRatio})
            </p>
          </div>
        </div>
      </div>

      {/* Mavjud kartochkadan ko'chirilganda — nima ko'chgani va nima tekshirish kerakligi */}
      {prefill && (
        <div className="card p-5 mb-6 border-accent/30">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: spec.color }} />
            <div className="min-w-0">
              <p className="font-semibold">
                &quot;{prefill.product.title}&quot; dan {prefill.copied.length} ta maydon ko&apos;chirildi
              </p>
              <p className="text-sm text-muted mt-0.5">
                {prefill.sourceMarketplace
                  ? `Manba: ${prefill.sourceMarketplace} kartochkasi. `
                  : ''}
                {prefill.missing.length > 0
                  ? `${prefill.missing.length} ta maydonni siz to'ldirasiz: ${prefill.missing
                      .map((m) => m.label)
                      .join(', ')}`
                  : "Barcha majburiy maydonlar to'ldirilgan — tekshirib saqlang"}
              </p>

              {prefill.needsReview.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {prefill.needsReview.map((n) => (
                    <li key={n.key} className="text-xs text-amber-700 dark:text-amber-400 flex gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                      <span>
                        <b>{n.label}</b> — {n.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {prefill.alreadyExists && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Diqqat: bu mahsulot uchun {spec.name} kartochkasi allaqachon bor — saqlasangiz
                  ustiga yoziladi.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Qadamlar */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, index) => {
          const isDone = index < step;
          const isCurrent = index === step;
          return (
            <button
              key={s.key}
              onClick={() => index <= step && setStep(index)}
              disabled={index > step}
              className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-full border-2 text-left transition ${
                isCurrent
                  ? 'bg-paper shadow-card'
                  : isDone
                    ? 'bg-paper hover:bg-panel'
                    : 'bg-panel opacity-60 cursor-not-allowed'
              }`}
              style={isCurrent ? { borderColor: spec.color } : { borderColor: 'transparent' }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: isDone || isCurrent ? spec.color : 'rgb(var(--c-muted))' }}
              >
                {isDone ? <Check className="w-4 h-4" /> : index + 1}
              </span>
              <span className="text-sm font-medium">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1-QADAM: rasm */}
      {step === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <h2 className="font-semibold mb-1">Mahsulot rasmlari</h2>
            <p className="text-sm text-muted mb-4">
              Avval oddiy rasm yuklang — keyingi qadamda AI uni {spec.name} talabiga moslashtiradi.
            </p>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {images.map((img, index) => (
                  <div key={img.fileKey} className="relative group">
                    <RemoteImage
                      src={img.url}
                      alt=""
                      sizes="(max-width: 768px) 25vw, 160px"
                      className="w-full aspect-square rounded-xl border border-line"
                    />
                    {index === 0 && (
                      <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                        Asosiy
                      </span>
                    )}
                    <button
                      onClick={() => removeImage(img.fileKey)}
                      aria-label={`${index + 1}-rasmni o'chirish`}
                      className="absolute top-1 right-1 p-1 bg-paper rounded-lg shadow-card opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <UploadDropzone onUpload={handleUpload} />
          </div>

          <div className="card p-6 h-fit">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" style={{ color: spec.color }} />
              {spec.name} rasm talablari
            </h3>
            <dl className="text-sm space-y-2 mb-4">
              <Row label="O'lcham" value={`${spec.image.targetWidth}×${spec.image.targetHeight} px`} />
              <Row label="Nisbat" value={spec.image.aspectRatio} />
              <Row label="Fon" value={spec.image.background} />
              <Row label="Format" value={spec.image.formats.join(', ')} />
              <Row label="Maks. hajm" value={`${spec.image.maxSizeMB} MB`} />
              <Row label="Rasm soni" value={`${spec.image.minCount}–${spec.image.maxCount}`} />
            </dl>
            <ul className="text-xs text-muted space-y-1.5">
              {spec.image.notes.map((note, i) => (
                <li key={i} className="flex gap-1.5">
                  <span style={{ color: spec.color }}>•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2-QADAM: AI moslashtirish */}
      {step === 1 && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Wand2 className="w-4 h-4" style={{ color: spec.color }} />
                Rasmni {spec.name} talabiga moslashtirish
              </h2>
              <p className="text-sm text-muted mt-1">
                AI fonni oq qiladi va rasmni {spec.image.targetWidth}×{spec.image.targetHeight} kanvasga
                joylaydi. Bu qadamni o'tkazib yuborsangiz asl rasm ishlatiladi.
              </p>
            </div>
            <button
              onClick={adaptAll}
              disabled={images.every((i) => i.adapted) || images.some((i) => i.adapting)}
              className="btn px-5 py-2.5 text-white font-semibold shadow-btn transition hover:shadow-btn-hover disabled:opacity-50 whitespace-nowrap"
              style={{ background: spec.color }}
            >
              {images.some((i) => i.adapting) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Hammasini moslashtirish
            </button>
          </div>

          <div className="space-y-4">
            {images.map((img) => (
              <div key={img.fileKey} className="border border-line rounded-[20px] p-4 flex gap-4 bg-paper">
                <div className="text-center">
                  <RemoteImage src={img.url} alt="Asl rasm" sizes="112px" className="w-28 h-28 rounded-xl border border-line" />
                  <p className="text-xs text-muted mt-1">Asl</p>
                </div>

                <div className="flex items-center text-muted/50">
                  <ArrowRight className="w-5 h-5" />
                </div>

                <div className="text-center">
                  {img.adapted ? (
                    <RemoteImage
                      src={img.adapted.url}
                      alt="Moslashtirilgan rasm"
                      fit="contain"
                      sizes="112px"
                      className="w-28 h-28 rounded-xl border border-line bg-white"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-xl border border-dashed border-line flex items-center justify-center bg-panel">
                      {img.adapting ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted" />
                      ) : (
                        <span className="text-xs text-muted">kutilmoqda</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted mt-1">{spec.name}</p>
                </div>

                <div className="flex-1 min-w-0">
                  {img.adapted ? (
                    <>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                        Tayyor — {img.adapted.width}×{img.adapted.height}, {img.adapted.sizeKB} KB
                      </p>
                      <ul className="text-xs text-muted space-y-0.5">
                        {img.adapted.steps.map((s, i) => (
                          <li key={i}>✓ {s}</li>
                        ))}
                      </ul>
                      {img.adapted.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                          {w}
                        </p>
                      ))}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => adaptOne(img.fileKey)}
                        disabled={img.adapting}
                        className="btn-ghost btn-sm disabled:opacity-50"
                      >
                        Moslashtirish
                      </button>
                      {img.error && <p className="text-xs text-red-600 mt-2">{img.error}</p>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted mt-4">
            {adaptedCount}/{images.length} rasm moslashtirildi
          </p>
        </div>
      )}

      {/* 3-QADAM: maydonlar */}
      {step === 2 && (
        <div className="space-y-6">
          <div
            className="rounded-[22px] border p-5 flex items-center justify-between gap-4"
            style={{ background: `${spec.color}0d`, borderColor: `${spec.color}40` }}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: spec.color }} />
              <div>
                <p className="font-semibold">AI rasmga qarab to'ldirsinmi?</p>
                <p className="text-sm text-muted mt-0.5">
                  Rasmdan nom, tavsif, rang, material kabi maydonlar aniqlanadi. Qo'lda yozganingiz
                  o'zgarmaydi — faqat bo'sh maydonlar to'ldiriladi.
                </p>
              </div>
            </div>
            <button
              onClick={() => runAiFill('all')}
              disabled={aiFilling}
              className="btn px-5 py-2.5 text-white font-semibold shadow-btn transition hover:shadow-btn-hover disabled:opacity-50 whitespace-nowrap"
              style={{ background: spec.color }}
            >
              {aiFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiFilling ? 'To\'ldirilmoqda...' : "AI bilan to'ldirish"}
            </button>
          </div>

          {aiNotes.length > 0 && (
            <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">AI eslatmalari</p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                {aiNotes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            </div>
          )}

          {spec.groups.map((group) => (
            <div key={group.key} className="card p-6">
              <h2 className="font-semibold">{group.label}</h2>
              {group.description && <p className="text-sm text-muted mt-0.5">{group.description}</p>}

              {/* Narx bo'limi — AI narx tavsiyasi maydonlardan oldin turadi */}
              {group.key === 'price' && (
                <PriceAdvisor
                  marketplace={spec.id}
                  color={spec.color}
                  currency={spec.currency}
                  values={values}
                  onApplyPrice={(price) => setValues((prev) => ({ ...prev, price: String(price) }))}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {group.fields
                  .filter((field) => !field.hidden)
                  .map((field) => (
                    <FieldInput
                      key={field.key}
                      field={field}
                      marketplace={spec.id}
                      value={values[field.key] ?? ''}
                      categoryId={values.categoryId ?? ''}
                      error={showErrors ? fieldErrors[field.key] : undefined}
                      onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                      onCategorySelect={handleCategorySelect}
                    />
                  ))}
              </div>
            </div>
          ))}

          {/* Kategoriyaga mos dinamik xarakteristikalar (WB) */}
          {spec.id === 'WB' && values.categoryId && (charcFields.length > 0 || charcsLoading) && (
            <div className="card p-6">
              <WbCharcFields
                charcs={charcFields}
                values={wbCharcs}
                loading={charcsLoading}
                onChange={(id, v) => setWbCharcs((prev) => ({ ...prev, [String(id)]: v }))}
                onAiFill={() => runAiFill('charcs')}
                aiFilling={charcFilling}
              />
            </div>
          )}
        </div>
      )}

      {/* 4-QADAM: yakun */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Kartochka ko'rinishi</h2>
              <div className="flex gap-4">
                {exportImageUrls[0] && (
                  <RemoteImage
                    src={exportImageUrls[0]}
                    alt="Kartochka rasmi"
                    fit="contain"
                    sizes="128px"
                    className="w-32 flex-shrink-0 rounded-xl border border-line bg-white"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-lg truncate">{values.title || 'Nomsiz'}</p>
                  <p className="text-sm text-muted mt-1">
                    {/* Brend hamma marketplace'da ham bo'lavermaydi (WB da olib
                        tashlangan) — bo'sh bo'lsa ortiqcha nuqta chiqmasin */}
                    {[values.brand, values.category].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xl font-bold mt-2">
                    {values.price ? Number(values.price).toLocaleString('uz-UZ') : '—'} {spec.currency}
                  </p>
                  <p className="text-sm text-muted mt-1">Zaxira: {values.stock || 0}</p>
                </div>
              </div>
            </div>

            {errorCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-[20px] p-4">
                <p className="font-medium text-red-700 dark:text-red-300 mb-2">
                  {errorCount} ta maydon to'ldirilmagan yoki noto'g'ri
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-0.5">
                  {Object.entries(fieldErrors).map(([key, message]) => {
                    const field = allFields.find((f) => f.key === key);
                    return (
                      <li key={key}>
                        • {field?.label || key}: {message}
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => {
                    setShowErrors(true);
                    setStep(2);
                  }}
                  className="mt-3 text-sm font-medium text-red-700 dark:text-red-300 underline"
                >
                  Maydonlarga qaytish
                </button>
              </div>
            )}

            {quality && <QualityPanel quality={quality} />}

            <div className="card p-6">
              <h2 className="font-semibold mb-3">Excel'da nima bo'ladi</h2>
              <p className="text-sm text-muted mb-3">{spec.uploadHint}</p>
              <ul className="text-sm text-muted space-y-1">
                <li>• 1-varaq — {allFields.length} ta ustun {spec.name} nomlari bilan + rasm URL'lari</li>
                <li>• 2-varaq — rasm talablari</li>
                <li>• 3-varaq — har bir ustun uchun yo'riqnoma</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4 h-fit">
            <div className="card p-6">
              <p className="text-sm text-muted mb-1">To'ldirildi</p>
              <p className="text-2xl font-bold">
                {filledCount}/{allFields.length}
              </p>
              <p className="text-sm text-muted mt-3 mb-1">Rasmlar</p>
              <p className="text-2xl font-bold">
                {adaptedCount}/{images.length}
                <span className="text-sm font-normal text-muted ml-1">moslashtirilgan</span>
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !!savedId}
              className="btn w-full py-3 font-semibold text-white shadow-btn transition hover:shadow-btn-hover disabled:opacity-50"
              style={{ background: spec.color }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savedId ? 'Saqlandi' : 'Kartochkani saqlash'}
            </button>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn w-full py-3 font-semibold border border-emerald-600/50 text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel yuklab olish
            </button>

            {/* API orqali joylash — Uzum buni qo'llab-quvvatlamaydi */}
            {savedId && spec.canPublishViaApi && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="btn w-full py-3 font-semibold text-white shadow-btn transition hover:shadow-btn-hover disabled:opacity-50"
                style={{ background: spec.color }}
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {spec.name}&apos;ga joylash
              </button>
            )}

            {savedId && !spec.canPublishViaApi && (
              <p className="text-xs text-muted text-center px-2">
                {spec.name} API orqali kartochka yaratishni qo&apos;llab-quvvatlamaydi — Excel&apos;ni
                yuklab olib, seller kabinetiga qo&apos;lda joylang.
              </p>
            )}

            {publishResult && (
              <div
                className={`rounded-[18px] border p-3 text-xs ${
                  publishResult.success
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                }`}
              >
                {publishResult.message}
              </div>
            )}

            {savedId && <NextMarketplaces productId={savedId} currentId={spec.id} />}

            {savedId && (
              <button
                onClick={() => router.push('/dashboard/products')}
                className="btn w-full py-3 font-medium border border-line transition hover:border-accent/40 hover:text-accent"
              >
                Ro'yxatga qaytish
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigatsiya */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="btn-ghost btn-sm disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" />
          Orqaga
        </button>

        {step < STEPS.length - 1 && (
          <button
            onClick={() => {
              if (step === 0 && !canLeaveImages) {
                toast('error', `Kamida ${spec.image.minCount} ta rasm kerak`);
                return;
              }
              setStep((s) => s + 1);
            }}
            className="btn px-6 py-2.5 text-white font-semibold shadow-btn transition hover:shadow-btn-hover hover:-translate-y-0.5"
            style={{ background: spec.color }}
          >
            {step === 1 && adaptedCount === 0 ? "O'tkazib yuborish" : 'Keyingi'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Yordamchi komponentlar
// ============================================

/**
 * Saqlangandan keyin: shu mahsulotni qolgan marketplace'lar uchun ham tayyorlash.
 * Yangi mahsulot yaratilmaydi — maydonlar shu kartochkadan ko'chiriladi.
 */
function NextMarketplaces({ productId, currentId }: { productId: string; currentId: string }) {
  const { data: specs = [] } = useQuery({
    queryKey: ['card-specs'],
    queryFn: async () =>
      (await api.get('/cards/specs')).data.items as Array<{
        id: string;
        name: string;
        logo: string;
        color: string;
      }>,
    staleTime: 60 * 60 * 1000,
  });

  const others = specs.filter((s) => s.id !== currentId);
  if (!others.length) return null;

  return (
    <div className="card p-5">
      <p className="font-semibold text-sm">Boshqa bozorlarga ham tayyorlaysizmi?</p>
      <p className="text-xs text-muted mt-1 mb-3">
        Maydonlar shu kartochkadan ko&apos;chiriladi — noldan to&apos;ldirmaysiz.
      </p>
      <div className="space-y-2">
        {others.map((other) => (
          <Link
            key={other.id}
            href={`/dashboard/products/new/${other.id.toLowerCase()}?from=${productId}`}
            className="flex items-center gap-3 p-2.5 rounded-[14px] border border-line transition hover:border-accent/40 hover:-translate-y-0.5"
          >
            <span
              className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${other.color} 0%, ${other.color}cc 100%)` }}
            >
              <RemoteImage src={other.logo} alt="" fit="contain" sizes="28px" className="w-7 h-7 rounded-lg bg-white/95" />
            </span>
            <span className="text-sm font-medium flex-1">{other.name}</span>
            <ArrowRight className="w-4 h-4 text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

function FieldInput({
  field,
  marketplace,
  value,
  categoryId,
  error,
  onChange,
  onCategorySelect,
}: {
  field: SpecField;
  marketplace: string;
  value: string;
  categoryId: string;
  error?: string;
  onChange: (value: string) => void;
  onCategorySelect: (option: CategoryOption | null) => void;
}) {
  const base = `w-full px-4 py-2.5 rounded-[14px] border bg-paper/70 text-sm transition focus:outline-none ${
    error ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-accent/50'
  }`;

  return (
    <div className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
        {field.unit && <span className="text-muted font-normal ml-1">({field.unit})</span>}
        {field.aiFillable && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-purple-600 font-semibold">
            AI
          </span>
        )}
      </label>

      {field.optionsFrom === 'wb-tnved' ? (
        <TnvedPicker
          marketplace={marketplace}
          categoryId={categoryId}
          value={value}
          onChange={onChange}
          className={base}
        />
      ) : field.type === 'category' ? (
        <CategoryPicker
          marketplace={marketplace}
          value={value}
          categoryId={categoryId}
          onSelect={onCategorySelect}
          error={error}
        />
      ) : field.type === 'textarea' ? (
        <textarea
          rows={5}
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Tanlang...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}

      <div className="flex justify-between gap-2 mt-1">
        <p className="text-xs text-muted">{error ? '' : field.hint}</p>
        {field.maxLength && (
          <p
            className={`text-xs whitespace-nowrap ${
              value.length > field.maxLength ? 'text-red-600 font-medium' : 'text-muted'
            }`}
          >
            {value.length}/{field.maxLength}
          </p>
        )}
      </div>

      {/* Kategoriya tanlagichi xatoni o'zi ko'rsatadi — takrorlamaymiz */}
      {error && field.type !== 'category' && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
