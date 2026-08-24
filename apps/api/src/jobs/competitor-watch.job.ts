/**
 * Raqobatchi narxlarini avtomatik o'qish.
 *
 * Kuniga bir-ikki marta yetarli — narx tez-tez o'zgarmaydi va ochiq
 * sahifalarga tez-tez urilsa bloklanish xavfi bor.
 *
 *   COMPETITOR_WATCH_CRON="0 8,20 * * *"   (standart — 8:00 va 20:00)
 *   COMPETITOR_WATCH_CRON="off"            (o'chirish)
 */

import cron from 'node-cron';
import { checkAllCompetitors } from '../services/marketplace/competitor-check.service';

const DEFAULT_SCHEDULE = '0 8,20 * * *';
const TIMEZONE = process.env.COMPETITOR_WATCH_TZ || 'Asia/Tashkent';

let running = false;

export async function runCompetitorWatch(): Promise<void> {
  if (running) {
    console.log("⏭  Raqobatchi tekshiruvi allaqachon ketyapti — o'tkazib yuborildi");
    return;
  }
  running = true;
  try {
    const { orgs, checked, dropped } = await checkAllCompetitors();
    console.log(
      `🏷  Raqobatchi narxlari: ${orgs} ta tashkilot, ${checked} ta o'qildi, ${dropped} ta arzonlashdi`,
    );
  } catch (err: any) {
    console.error(`🏷  Raqobatchi tekshiruvi xato: ${err?.message}`);
  } finally {
    running = false;
  }
}

export function startCompetitorWatchJob(): void {
  const schedule = process.env.COMPETITOR_WATCH_CRON || DEFAULT_SCHEDULE;

  if (schedule.toLowerCase() === 'off') {
    console.log("🏷  Raqobatchi kuzatuvi o'chirilgan (COMPETITOR_WATCH_CRON=off)");
    return;
  }
  if (!cron.validate(schedule)) {
    console.error(`🏷  COMPETITOR_WATCH_CRON noto'g'ri: "${schedule}" — job ishga tushmadi`);
    return;
  }

  cron.schedule(schedule, runCompetitorWatch, { timezone: TIMEZONE });
  console.log(`🏷  Raqobatchi kuzatuvi yoqildi: "${schedule}" (${TIMEZONE})`);
}
