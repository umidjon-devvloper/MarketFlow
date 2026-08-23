/**
 * Qoldiq nazorati — kam qolgan mahsulotlar uchun email ogohlantirish.
 *
 * Ish tartibi: tashkilotning har bir faol marketplace ulanishidan qoldiqlar
 * o'qiladi → chegaradan pastlari yig'iladi → bitta umumiy xat yuboriladi.
 *
 * Takrorlanishning oldi olinadi: har bir SKU uchun oxirgi yuborilgan qoldiq
 * `StockAlert` da saqlanadi va xat faqat quyidagi hollarda qayta ketadi —
 *   • qoldiq yana kamaygan bo'lsa,
 *   • chegara sozlamasi o'zgargan bo'lsa,
 *   • yoki oxirgi xatdan beri REMIND_AFTER_MS o'tgan bo'lsa.
 * Mahsulot to'ldirilsa yozuv o'chadi — keyingi safar yana ogohlantiriladi.
 */

import { Marketplace as PrismaMarketplace } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/encryption';
import { getAdapter, AdapterCreds } from '../marketplace/adapter';
import { sendMail } from './mailer';
import { lowStockEmail, LowStockRow } from './templates';

/** Qoldiq hamon kam bo'lsa, eslatma shu vaqtdan keyin takrorlanadi */
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

/** Bitta marketplace'dan ko'pi bilan shuncha qator o'qiymiz */
const MAX_ROWS = 1000;
const PAGE_SIZE = 200;

export interface LowStockReport {
  organizationId: string;
  orgName: string;
  checked: number;
  low: LowStockRow[];
  /** Yangi (yoki qayta ogohlantirish kerak bo'lgan) qatorlar */
  notified: LowStockRow[];
  recipients: string[];
  emailSent: boolean;
  emailError?: string;
  /** Ulanishlardan biri o'qilmasa — sabab shu yerda, lekin jarayon to'xtamaydi */
  errors: Array<{ marketplace: string; error: string }>;
}

/**
 * Bitta ulanishning barcha qoldiqlarini o'qish.
 *
 * Avval keshdan (`MarketplaceStock`) — uni sync cron to'ldiradi. Kesh bo'sh
 * bo'lsa jonli API'ga tushamiz, shunda birinchi ishga tushirishda ham
 * xabarnoma ishlaydi.
 */
async function readStocks(
  organizationId: string,
  marketplace: string,
  creds: AdapterCreds,
): Promise<{ rows: Array<{ sku: string; name?: string; amount: number; warehouse?: string }>; source: 'cache' | 'live' }> {
  const cached = await prisma.marketplaceStock.findMany({
    where: { organizationId, marketplace: marketplace as PrismaMarketplace },
    select: { sku: true, name: true, amount: true, warehouse: true },
  });

  if (cached.length) {
    return {
      source: 'cache',
      rows: cached.map((r) => ({
        sku: r.sku,
        name: r.name ?? undefined,
        amount: r.amount,
        warehouse: r.warehouse ?? undefined,
      })),
    };
  }

  const adapter = getAdapter(marketplace);
  const size = Math.min(PAGE_SIZE, adapter.maxPageSize ?? PAGE_SIZE);
  const rows: Array<{ sku: string; name?: string; amount: number; warehouse?: string }> = [];

  for (let page = 0; rows.length < MAX_ROWS; page++) {
    const { items, total } = await adapter.getStocks(creds, { page, size });
    rows.push(...items);
    if (items.length < size) break;
    if (total !== undefined && rows.length >= total) break;
  }
  return { rows, source: 'live' };
}

/**
 * Bir mahsulot bir necha omborda yotishi mumkin — ogohlantirish uchun
 * muhimi umumiy qoldiq, shuning uchun SKU bo'yicha yig'amiz.
 */
function groupBySku(
  marketplace: string,
  rows: Array<{ sku: string; name?: string; amount: number; warehouse?: string }>,
): LowStockRow[] {
  const map = new Map<string, LowStockRow>();
  for (const row of rows) {
    const sku = (row.sku || '').trim();
    if (!sku) continue;
    const hit = map.get(sku);
    if (hit) {
      hit.amount += row.amount;
      // Bir nechta ombor bo'lsa alohida nomlamaymiz
      if (hit.warehouse && hit.warehouse !== row.warehouse) hit.warehouse = 'bir necha ombor';
    } else {
      map.set(sku, { marketplace, sku, name: row.name, amount: row.amount, warehouse: row.warehouse });
    }
  }
  return [...map.values()];
}

/** Tashkilot uchun kimga xat ketishi: sozlamadagi manzillar, bo'lmasa — ega */
async function recipientsFor(organizationId: string, configured: string[]): Promise<string[]> {
  const list = configured.map((e) => e.trim()).filter(Boolean);
  if (list.length) return list;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { owner: { select: { email: true } } },
  });
  return org?.owner?.email ? [org.owner.email] : [];
}

/**
 * Bitta tashkilotni tekshirish.
 *
 * @param force  `true` bo'lsa takrorlanish filtri o'tkazib yuboriladi
 *               ("Hozir tekshirish" tugmasi uchun) — sozlama o'chirilgan
 *               bo'lsa ham hisobot qaytadi, lekin xat yuborilmaydi.
 */
export async function checkOrganization(
  organizationId: string,
  { force = false }: { force?: boolean } = {},
): Promise<LowStockReport> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      stockAlertsEnabled: true,
      lowStockThreshold: true,
      stockAlertEmails: true,
      userMarketplaces: {
        where: { isActive: true },
        select: { id: true, marketplace: true, apiKey: true, apiSecret: true, shopId: true },
      },
    },
  });
  if (!org) throw new Error('Tashkilot topilmadi');

  const threshold = org.lowStockThreshold;
  const report: LowStockReport = {
    organizationId: org.id,
    orgName: org.name,
    checked: 0,
    low: [],
    notified: [],
    recipients: [],
    emailSent: false,
    errors: [],
  };

  for (const cred of org.userMarketplaces) {
    try {
      const { rows } = await readStocks(organizationId, cred.marketplace, {
        apiKey: decrypt(cred.apiKey),
        apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
        shopId: cred.shopId,
      });
      const grouped = groupBySku(cred.marketplace, rows);
      report.checked += grouped.length;
      report.low.push(...grouped.filter((r) => r.amount <= threshold));
    } catch (err: any) {
      report.errors.push({ marketplace: cred.marketplace, error: err?.message || 'xato' });
    }
  }

  // ── Takrorlanishni filtrlash ──────────────────────────
  const previous = await prisma.stockAlert.findMany({ where: { organizationId } });
  const seen = new Map(previous.map((a) => [`${a.marketplace}|${a.sku}`, a]));
  const now = Date.now();

  for (const row of report.low) {
    const key = `${row.marketplace}|${row.sku}`;
    const last = seen.get(key);
    const isNew =
      !last ||
      row.amount < last.lastAmount ||
      last.lastThreshold !== threshold ||
      now - last.lastSentAt.getTime() >= REMIND_AFTER_MS;
    if (isNew || force) report.notified.push(row);
  }

  if (!report.notified.length) return report;

  report.recipients = await recipientsFor(organizationId, org.stockAlertEmails);

  if (!org.stockAlertsEnabled) return report;

  const { subject, html } = lowStockEmail({
    orgName: org.name,
    threshold,
    rows: report.notified,
    dashboardUrl: process.env.WEB_APP_URL
      ? `${process.env.WEB_APP_URL.replace(/\/$/, '')}/dashboard/marketplaces`
      : undefined,
  });

  const result = await sendMail({ to: report.recipients, subject, html });
  report.emailSent = result.sent;
  if (!result.sent) report.emailError = result.reason === 'error' ? result.error : result.reason;

  // Yozuvni faqat xat haqiqatan ketgandan keyin yangilaymiz — aks holda
  // SMTP xatosi "ogohlantirildi" deb qayd etilib, xabar butunlay yo'qoladi
  if (result.sent) {
    await Promise.all(
      report.notified.map((row) =>
        prisma.stockAlert.upsert({
          where: {
            organizationId_marketplace_sku: {
              organizationId,
              marketplace: row.marketplace as PrismaMarketplace,
              sku: row.sku,
            },
          },
          create: {
            organizationId,
            marketplace: row.marketplace as PrismaMarketplace,
            sku: row.sku,
            name: row.name,
            lastAmount: row.amount,
            lastThreshold: threshold,
          },
          update: {
            name: row.name,
            lastAmount: row.amount,
            lastThreshold: threshold,
            lastSentAt: new Date(),
          },
        }),
      ),
    );

    // Qoldig'i tiklangan mahsulotlar — yozuvni o'chiramiz, keyin yana kamaysa
    // bu "yangi ogohlantirish" sifatida ketadi
    const stillLow = new Set(report.low.map((r) => `${r.marketplace}|${r.sku}`));
    const restocked = previous.filter((a) => !stillLow.has(`${a.marketplace}|${a.sku}`));
    if (restocked.length) {
      await prisma.stockAlert.deleteMany({ where: { id: { in: restocked.map((a) => a.id) } } });
    }
  }

  return report;
}

/** Barcha faol tashkilotlarni ketma-ket tekshirish (cron uchun) */
export async function checkAllOrganizations(): Promise<LowStockReport[]> {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true, stockAlertsEnabled: true, userMarketplaces: { some: { isActive: true } } },
    select: { id: true },
  });

  const reports: LowStockReport[] = [];
  for (const org of orgs) {
    try {
      // Ketma-ket — marketplace limitlari umumiy, parallel ketsa 429 boshlanadi
      reports.push(await checkOrganization(org.id));
    } catch (err: any) {
      console.error(`Qoldiq tekshiruvi (${org.id}) xato: ${err?.message}`);
    }
  }
  return reports;
}
