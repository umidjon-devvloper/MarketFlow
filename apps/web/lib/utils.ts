import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | string, currency = 'UZS') {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('uz-UZ').format(num) + ' ' + currency;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
