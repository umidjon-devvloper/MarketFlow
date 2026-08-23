import type { AxiosResponse } from 'axios';

export interface ExportWarning {
  row: number;
  column: string;
  message: string;
}

/**
 * Content-Disposition dan fayl nomini olish.
 *
 * Nega kerak: Uzum eksporti `.xlsm` (makrosli shablon), qolganlari `.xlsx`.
 * Nomni frontendda qattiq yozib qo'ysak, Uzum fayli noto'g'ri kengaytma
 * bilan tushadi va Excel uni ochmaydi.
 */
export function fileNameFromResponse(res: AxiosResponse, fallback: string): string {
  const header = res.headers['content-disposition'] as string | undefined;
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

/** Server qaytargan eksport ogohlantirishlari (majburiy maydon bo'sh, matn qisqartirildi…) */
export function warningsFromResponse(res: AxiosResponse): ExportWarning[] {
  const raw = res.headers['x-export-warnings'] as string | undefined;
  if (!raw) return [];
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Ogohlantirishlarni bitta qisqa xabarga yig'ish */
export function summarizeWarnings(warnings: ExportWarning[]): string | null {
  if (!warnings.length) return null;
  const missing = warnings.filter((w) => w.message.includes('majburiy'));
  const parts: string[] = [];
  if (missing.length) {
    const columns = [...new Set(missing.map((w) => w.column))].slice(0, 3);
    parts.push(`${missing.length} ta majburiy maydon bo'sh (${columns.join(', ')})`);
  }
  const trimmed = warnings.length - missing.length;
  if (trimmed) parts.push(`${trimmed} ta matn qisqartirildi`);
  return parts.join(' · ');
}
