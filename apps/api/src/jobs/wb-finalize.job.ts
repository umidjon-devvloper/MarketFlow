/**
 * WB kartochkalariga rasmni avtomatik biriktirish (finalize).
 *
 * WB kartochkani ~30 daqiqada yaratadi. Bu cron PENDING WB listinglarni
 * davriy tekshirib, tayyor bo'lganига rasm biriktiradi va PUBLISHED qiladi.
 *
 * Jadval WB_FINALIZE_CRON orqali sozlanadi (standart — har 15 daqiqa),
 * "off" — butunlay o'chirish.
 */

import cron from 'node-cron';
import { finalizePendingWbCards } from '../services/marketplace/wb-finalize.service';

const DEFAULT_SCHEDULE = '*/15 * * * *';
const TIMEZONE = process.env.WB_FINALIZE_TZ || 'Asia/Tashkent';

let running = false;

export async function runWbFinalize(): Promise<void> {
  if (running) {
    console.log("⏭  WB finalize allaqachon ketyapti — o'tkazib yuborildi");
    return;
  }
  running = true;
  try {
    const r = await finalizePendingWbCards();
    if (r.checked) {
      console.log(
        `🖼  WB finalize: ${r.checked} ta tekshirildi — ${r.attached} rasm biriktirildi, ${r.stillPending} kutmoqda, ${r.failed} xato`,
      );
    }
  } catch (err: any) {
    console.error(`🖼  WB finalize xato: ${err?.message}`);
  } finally {
    running = false;
  }
}

export function startWbFinalizeJob(): void {
  const schedule = process.env.WB_FINALIZE_CRON || DEFAULT_SCHEDULE;
  if (schedule.toLowerCase() === 'off') {
    console.log("🖼  WB finalize o'chirilgan (WB_FINALIZE_CRON=off)");
    return;
  }
  if (!cron.validate(schedule)) {
    console.error(`🖼  WB_FINALIZE_CRON noto'g'ri: "${schedule}" — job ishga tushmadi`);
    return;
  }
  cron.schedule(schedule, runWbFinalize, { timezone: TIMEZONE });
  console.log(`🖼  WB rasm biriktirish (finalize) yoqildi: "${schedule}" (${TIMEZONE})`);
}
