'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';

interface RowError {
  field: string;
  message: string;
}

interface ValidatedRow {
  rowNumber: number;
  data: any;
  errors: RowError[];
  isValid: boolean;
}

interface PreviewData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidatedRow[];
}

interface ImportResult {
  successCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; message: string }>;
  createdProductIds: string[];
}

export default function BulkImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ Fayl tanlash ============
  function handleFile(f: File) {
    setError(null);
    setPreview(null);
    setResult(null);

    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Faqat .xlsx, .xls yoki .csv fayllar');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('Fayl 20MB dan katta');
      return;
    }
    setFile(f);
    uploadFile(f);
  }

  // ============ Preview so'rovi ============
  async function uploadFile(f: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', f);

      const { data } = await api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Faylni tekshirishda xato');
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  // ============ Import ijro etish ============
  async function handleImport() {
    if (!preview) return;
    if (preview.validRows === 0) {
      alert('Import qilinadigan valid satr yo\'q');
      return;
    }

    if (
      !confirm(
        `${preview.validRows} ta valid satr import qilinadi.` +
          (preview.invalidRows > 0
            ? ` ${preview.invalidRows} ta xato satr o'tkazib yuboriladi.`
            : '') +
          ' Davom etamizmi?',
      )
    ) return;

    setImporting(true);
    try {
      const { data } = await api.post('/import/execute', {
        rows: preview.rows,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import qilishda xato');
    } finally {
      setImporting(false);
    }
  }

  // ============ Shablon yuklab olish ============
  async function downloadTemplate(withExamples: boolean) {
    try {
      const res = await api.get(
        `/import/template?examples=${withExamples}`,
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marketflow-shablon${withExamples ? '-namuna' : ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Shablon yuklab olishda xato');
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ============ Natija ekrani ============
  if (result) {
    return (
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Mahsulotlarga qaytish
        </Link>

        <div className="bg-white rounded-xl border p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">Import yakunlandi!</h1>
            <p className="text-slate-600 mt-1">
              {result.successCount} ta mahsulot muvaffaqiyatli qo'shildi
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm text-green-700">Muvaffaqiyatli</p>
              <p className="text-3xl font-bold text-green-900">{result.successCount}</p>
            </div>
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-700">Xato</p>
              <p className="text-3xl font-bold text-red-900">{result.failedCount}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-red-700">Xato satrlar:</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg divide-y divide-red-200 max-h-60 overflow-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="p-3 text-sm">
                    <span className="font-medium">Satr {e.rowNumber}:</span> {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 border border-slate-300 py-2.5 rounded-lg font-medium hover:bg-slate-50"
            >
              Yana import qilish
            </button>
            <Link
              href="/dashboard/products"
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 text-center"
            >
              Mahsulotlarni ko'rish
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============ Preview ekrani ============
  if (preview) {
    return (
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Mahsulotlarga qaytish
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Import: Tekshiruv</h1>
          <p className="text-slate-600 mt-1">
            Fayl: <span className="font-medium">{file?.name}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border">
            <p className="text-sm text-slate-600">Jami satrlar</p>
            <p className="text-3xl font-bold mt-1">{preview.totalRows}</p>
          </div>
          <div className="bg-green-50 border border-green-200 p-5 rounded-xl">
            <p className="text-sm text-green-700">✓ Valid</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{preview.validRows}</p>
          </div>
          <div className="bg-red-50 border border-red-200 p-5 rounded-xl">
            <p className="text-sm text-red-700">✕ Xato</p>
            <p className="text-3xl font-bold text-red-900 mt-1">{preview.invalidRows}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden mb-6">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="font-semibold">Ko'rib chiqish (birinchi 100 satr)</h2>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
              <span>Xato satr</span>
            </div>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 border-b">
                <tr>
                  <th className="p-2 text-left font-medium">#</th>
                  <th className="p-2 text-left font-medium">Holat</th>
                  <th className="p-2 text-left font-medium">Nomi</th>
                  <th className="p-2 text-left font-medium">Kategoriya</th>
                  <th className="p-2 text-left font-medium">Narx</th>
                  <th className="p-2 text-left font-medium">Zaxira</th>
                  <th className="p-2 text-left font-medium">Xatolar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.slice(0, 100).map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50'}
                  >
                    <td className="p-2 font-mono text-xs">{row.rowNumber}</td>
                    <td className="p-2">
                      {row.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                    </td>
                    <td className="p-2 max-w-xs truncate">{row.data.title || '—'}</td>
                    <td className="p-2">{row.data.category || '—'}</td>
                    <td className="p-2">{row.data.basePrice || '—'}</td>
                    <td className="p-2">{row.data.stock || 0}</td>
                    <td className="p-2 text-xs text-red-700">
                      {row.errors.length > 0 && (
                        <div className="space-y-0.5">
                          {row.errors.map((e, i) => (
                            <div key={i}>
                              <span className="font-medium">{e.field}:</span> {e.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {preview.rows.length > 100 && (
              <div className="p-3 text-center text-sm text-slate-500 bg-slate-50 border-t">
                ...va yana {preview.rows.length - 100} ta satr
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 sticky bottom-0 bg-white p-4 border-t -mx-8 -mb-8">
          <button
            onClick={reset}
            className="border border-slate-300 px-6 py-2.5 rounded-lg font-medium hover:bg-slate-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleImport}
            disabled={importing || preview.validRows === 0}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Import qilinmoqda...
              </>
            ) : (
              <>
                {preview.validRows} ta valid satrni import qilish
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============ Boshlang'ich ekran ============
  return (
    <div>
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Mahsulotlarga qaytish
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Ommaviy import</h1>
        <p className="text-slate-600 mt-1">
          Excel yoki CSV fayl orqali ko'p mahsulotni bir vaqtda qo'shing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload zone */}
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="font-semibold mb-4">1. Faylni yuklang</h2>

            <div
              onClick={() => !uploading && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!uploading && e.dataTransfer.files[0]) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition
                ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
                ${uploading ? 'opacity-60 pointer-events-none' : ''}
              `}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                  <p className="text-sm text-slate-600">Tekshirilmoqda...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-3" />
                  <p className="font-medium">Fayl bu yerga tashlang</p>
                  <p className="text-sm text-slate-500 mt-1">yoki bosing va tanlang</p>
                  <p className="text-xs text-slate-400 mt-3">
                    .xlsx, .xls, .csv · Max 20MB · Max 1000 satr
                  </p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Muhim eslatmalar:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Barcha rasmlar oldindan yuklangan URL bo'lishi kerak</li>
                  <li>SKU maydonlari takrorlanmasligi kerak</li>
                  <li>Xato satrlar o'tkazib yuboriladi (import bekor bo'lmaydi)</li>
                  <li>Import qilingandan so'ng mahsulotlar DRAFT holatida bo'ladi</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* O'ng: shablonlar */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="font-semibold mb-3">Shablon</h2>
            <p className="text-sm text-slate-600 mb-4">
              Faylni to'g'ri formatda tayyorlash uchun shablonni yuklab oling
            </p>

            <div className="space-y-2">
              <button
                onClick={() => downloadTemplate(true)}
                className="w-full flex items-center gap-2 border border-slate-300 py-2.5 px-3 rounded-lg hover:bg-slate-50 text-sm text-left"
              >
                <Download className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="flex-1">Namuna bilan shablon</span>
              </button>
              <button
                onClick={() => downloadTemplate(false)}
                className="w-full flex items-center gap-2 border border-slate-300 py-2.5 px-3 rounded-lg hover:bg-slate-50 text-sm text-left"
              >
                <Download className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="flex-1">Bo'sh shablon</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border">
            <h3 className="font-semibold text-sm mb-3">Majburiy ustunlar</h3>
            <ul className="text-xs space-y-1.5 text-slate-600">
              <li>
                <span className="font-medium text-slate-900">title</span> — nomi (3-200 belgi)
              </li>
              <li>
                <span className="font-medium text-slate-900">description</span> — tavsif (10+ belgi)
              </li>
              <li>
                <span className="font-medium text-slate-900">category</span> — kategoriya
              </li>
              <li>
                <span className="font-medium text-slate-900">basePrice</span> — narx (musbat son)
              </li>
            </ul>

            <h3 className="font-semibold text-sm mt-4 mb-3">Ixtiyoriy</h3>
            <ul className="text-xs space-y-1.5 text-slate-600">
              <li>brand, sku, barcode, currency, stock</li>
              <li>imageUrl1..imageUrl5</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
