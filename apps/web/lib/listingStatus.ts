/**
 * Kartochka holatini ko'rsatish — yagona manba.
 *
 * Avval holat ikki joyda ikki xil chiqardi: mahsulot sahifasida hamma holat
 * YASHIL fonda ("ERROR" ham), kartochkalar ro'yxatida esa PUBLISHED dan
 * boshqasi kulrang. Ya'ni xato holati hech qayerda xato bo'lib ko'rinmasdi.
 */

export type ListingStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'PAUSED'
  | 'ERROR';

const LABELS: Record<string, string> = {
  DRAFT: 'Qoralama',
  PENDING: 'Kutilmoqda',
  PUBLISHED: 'Joylandi',
  REJECTED: 'Rad etildi',
  PAUSED: "To'xtatilgan",
  ERROR: 'Xato',
};

const STYLES: Record<string, string> = {
  DRAFT: 'bg-paper text-ink-soft border border-line',
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  REJECTED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  PAUSED: 'bg-paper text-ink-soft border border-line',
  ERROR: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export function statusLabel(status: string): string {
  return LABELS[status] || status;
}

export function statusClass(status: string): string {
  return STYLES[status] || STYLES.DRAFT;
}

/**
 * Shu holatdan qayta yuborish mumkinmi.
 *
 * PUBLISHED — allaqachon joylangan, PENDING — marketplace hali ishlayapti;
 * ikkalasida ham qayta yuborish dublikat yaratishi mumkin.
 */
export function canRepublish(status: string): boolean {
  return status !== 'PUBLISHED' && status !== 'PENDING';
}
