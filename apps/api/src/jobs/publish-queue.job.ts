/**
 * Joylash navbatining avtomatik ishlashi.
 *
 * Sinxronizatsiyadan (har 3 soat) ko'ra tez-tez ishlaydi: sotuvchi tugmani
 * bosgandan keyin natijani daqiqalar ichida ko'rishi kerak, soatlar emas.
 * Lekin har bir sikl marketplace limitlarini hisobga oladi — `publish.service`
 * va `rate-limit.ts` dagi navbatlar so'rovlarni o'zi pauzalaydi.
 *
 *   PUBLISH_QUEUE_CRON="*\/2 * * * *"   (standart — har 2 daqiqada)
 *   PUBLISH_QUEUE_CRON="off"           (o'chirish)
 */

import cron from 'node-cron';
import {
  processPublishQueue,
  checkPendingPublishJobs,
} from '../services/marketplace/publish-queue.service';

const DEFAULT_SCHEDULE = '*/2 * * * *';
const TIMEZONE = process.env.STOCK_ALERT_TZ || 'Asia/Tashkent';

/** Bir vaqtda ikki sikl ketmasligi uchun — aks holda bitta vazifa ikki marta yuborilardi */
let running = false;

export async function runPublishQueue(): Promise<void> {
  if (running) return;
  running = true;

  try {
    // Avval kutayotganlarni tekshiramiz: ular allaqachon marketplace'da,
    // yangi so'rov yubormasdan turib natijani yopish arzonroq
    const checked = await checkPendingPublishJobs();
    const sent = await processPublishQueue();

    const total = checked.processed + sent.processed;
    if (total > 0) {
      console.log(
        `📤 Publish navbati: ${sent.processed} yuborildi, ${checked.processed} tekshirildi | ` +
          `${sent.done + checked.done} tayyor, ${sent.pending + checked.pending} kutmoqda, ` +
          `${sent.failed + checked.failed} xato`,
      );
    }
  } catch (err: any) {
    console.error(`📤 Publish navbati xato: ${err?.message}`);
  } finally {
    running = false;
  }
}

export function startPublishQueueJob(): void {
  const schedule = process.env.PUBLISH_QUEUE_CRON || DEFAULT_SCHEDULE;

  if (schedule.toLowerCase() === 'off') {
    console.log("📤 Publish navbati o'chirilgan (PUBLISH_QUEUE_CRON=off)");
    return;
  }
  if (!cron.validate(schedule)) {
    console.error(`📤 PUBLISH_QUEUE_CRON noto'g'ri: "${schedule}" — job ishga tushmadi`);
    return;
  }

  cron.schedule(schedule, runPublishQueue, { timezone: TIMEZONE });
  console.log(`📤 Publish navbati yoqildi: "${schedule}" (${TIMEZONE})`);
}
