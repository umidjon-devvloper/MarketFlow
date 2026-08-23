/**
 * Marketplace sinxronizatsiyasining avtomatik ishga tushishi.
 *
 * Standart — har 3 soatda. Undan tez-tez qilishning ma'nosi yo'q:
 * WB statistikasi o'z tomonida ~30 daqiqada yangilanadi, ustiga
 * daqiqasiga 1 so'rov limiti bor.
 *
 *   MARKETPLACE_SYNC_CRON="0 *\/3 * * *"   (standart)
 *   MARKETPLACE_SYNC_CRON="off"           (o'chirish)
 */

import cron from 'node-cron';
import { syncAllOrganizations } from '../services/sync/marketplace-sync.service';

const DEFAULT_SCHEDULE = '0 */3 * * *';
const TIMEZONE = process.env.STOCK_ALERT_TZ || 'Asia/Tashkent';

/** Bir vaqtning o'zida ikki sync ketmasligi uchun */
let running = false;

export async function runMarketplaceSync(): Promise<void> {
  if (running) {
    console.log("⏭  Sync allaqachon ketyapti — bu safar o'tkazib yuborildi");
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    const orgs = await syncAllOrganizations();
    const all = orgs.flatMap((o) => o.results);
    const ok = all.filter((r) => r.status === 'OK').length;
    const partial = all.filter((r) => r.status === 'PARTIAL').length;
    const failed = all.filter((r) => r.status === 'FAILED').length;
    const items = all.reduce((n, r) => n + r.itemCount, 0);
    console.log(
      `🔄 Sync: ${orgs.length} tashkilot, ${ok} OK / ${partial} qisman / ${failed} xato, ` +
        `${items} SKU, ${Math.round((Date.now() - startedAt) / 1000)}s`,
    );
  } catch (err: any) {
    console.error(`🔄 Sync xato: ${err?.message}`);
  } finally {
    running = false;
  }
}

export function startMarketplaceSyncJob(): void {
  const schedule = process.env.MARKETPLACE_SYNC_CRON || DEFAULT_SCHEDULE;

  if (schedule.toLowerCase() === 'off') {
    console.log("🔄 Marketplace sync o'chirilgan (MARKETPLACE_SYNC_CRON=off)");
    return;
  }
  if (!cron.validate(schedule)) {
    console.error(`🔄 MARKETPLACE_SYNC_CRON noto'g'ri: "${schedule}" — job ishga tushmadi`);
    return;
  }

  cron.schedule(schedule, runMarketplaceSync, { timezone: TIMEZONE });
  console.log(`🔄 Marketplace sync yoqildi: "${schedule}" (${TIMEZONE})`);
}
