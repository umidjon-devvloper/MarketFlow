import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | string, currency = 'UZS') {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (!Number.isFinite(num)) return `— ${currency}`;
  return new Intl.NumberFormat('uz-UZ').format(num) + ' ' + currency;
}

/**
 * O'zbekcha (lotin) oy nomlari.
 *
 * Nega qo'lda: `Intl` da uz-Latn uchun oy nomlari yo'q —
 * `toLocaleDateString('uz-UZ', { month: 'long' })` "2026 M08 19" beradi.
 * Oy nomi faqat kirill variantida bor (uz-Cyrl-UZ), lekin ilova lotinda.
 *
 * Sana buyurtmalar sahifasida asosiy ma'lumot, "M08" esa o'qib bo'lmaydi.
 */
const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

const MONTHS_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
];

/** "19 avgust 2026" yoki "19 avg 2026" */
export function formatDate(date: string | Date, style: 'long' | 'short' = 'short') {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const month = (style === 'long' ? MONTHS : MONTHS_SHORT)[d.getMonth()];
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

/** "19 avg 2026, 14:30" — sinxronizatsiya vaqti kabi aniq lahzalar uchun */
export function formatDateTime(date: string | Date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(d)}, ${time}`;
}
