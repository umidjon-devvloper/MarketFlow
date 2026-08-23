/**
 * Qoldiq nazoratining avtomatik ishga tushishi.
 *
 * Kunига bir necha marta yetarli: marketplace statistikasi baribir real vaqtda
 * yangilanmaydi (WB'da ~30 daqiqa kechikish, ustiga daqiqasiga 1 so'rov limiti),
 * shuning uchun tez-tez so'rash foyda bermay, faqat limitga urib qo'yadi.
 *
 * Jadval .env orqali o'zgartiriladi:
 *   STOCK_ALERT_CRON="0 9,18 * * *"   (standart — soat 9:00 va 18:00)
 *   STOCK_ALERT_CRON="off"            (butunlay o'chirish)
 */

import cron from 'node-cron';
import { checkAllOrganizations } from '../services/mail/low-stock.service';

const DEFAULT_SCHEDULE = '0 9,18 * * *';
const TIMEZONE = process.env.STOCK_ALERT_TZ || 'Asia/Tashkent';

/** Bir vaqtning o'zida ikki tekshiruv ketmasligi uchun */
let running = false;

export async function runStockAlerts(): Promise<void> {
  if (running) {
    console.log('⏭  Qoldiq tekshiruvi allaqachon ketyapti — bu safar o\'tkazib yuborildi');
    return;
  }
  running = true;
  try {
    const reports = await checkAllOrganizations();
    const sent = reports.filter((r) => r.emailSent).length;
    const low = reports.reduce((n, r) => n + r.low.length, 0);
    console.log(
      `📦 Qoldiq tekshiruvi: ${reports.length} ta tashkilot, ${low} ta kam qolgan mahsulot, ${sent} ta xat yuborildi`,
    );
  } catch (err: any) {
    console.error(`📦 Qoldiq tekshiruvi xato: ${err?.message}`);
  } finally {
    running = false;
  }
}

export function startStockAlertJob(): void {
  const schedule = process.env.STOCK_ALERT_CRON || DEFAULT_SCHEDULE;

  if (schedule.toLowerCase() === 'off') {
    console.log('📦 Qoldiq xabarnomasi o\'chirilgan (STOCK_ALERT_CRON=off)');
    return;
  }
  if (!cron.validate(schedule)) {
    console.error(`📦 STOCK_ALERT_CRON noto'g'ri: "${schedule}" — job ishga tushmadi`);
    return;
  }

  cron.schedule(schedule, runStockAlerts, { timezone: TIMEZONE });
  console.log(`📦 Qoldiq xabarnomasi yoqildi: "${schedule}" (${TIMEZONE})`);
}
