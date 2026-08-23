import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { isMailConfigured, sendMail, verifyMail } from '../services/mail/mailer';
import { lowStockEmail } from '../services/mail/templates';
import { checkOrganization } from '../services/mail/low-stock.service';

const settingsSchema = z.object({
  stockAlertsEnabled: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  stockAlertEmails: z.array(z.string().email('Email manzil noto\'g\'ri')).max(10).optional(),
});

/** GET /api/alerts/settings */
export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        stockAlertsEnabled: true,
        lowStockThreshold: true,
        stockAlertEmails: true,
        owner: { select: { email: true } },
      },
    });
    if (!org) throw new HttpError(404, 'Tashkilot topilmadi');

    const [pending, mail] = await Promise.all([
      prisma.stockAlert.count({ where: { organizationId } }),
      verifyMail(),
    ]);

    res.json({
      stockAlertsEnabled: org.stockAlertsEnabled,
      lowStockThreshold: org.lowStockThreshold,
      stockAlertEmails: org.stockAlertEmails,
      /// Sozlamada manzil bo'lmasa xat shu yerga ketadi
      defaultRecipient: org.owner.email,
      /// Serverda Gmail sozlanganmi — UI shunga qarab ogohlantiradi
      mailConfigured: isMailConfigured(),
      mailError: mail.ok ? undefined : mail.error,
      /// Hozir "kam qoldi" holatida turgan mahsulotlar soni
      activeAlerts: pending,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/alerts/settings */
export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = settingsSchema.parse(req.body);
    const organizationId = req.organization!.id;

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(data.stockAlertsEnabled !== undefined && { stockAlertsEnabled: data.stockAlertsEnabled }),
        ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
        ...(data.stockAlertEmails && {
          stockAlertEmails: [
            ...new Set(data.stockAlertEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
          ],
        }),
      },
      select: { stockAlertsEnabled: true, lowStockThreshold: true, stockAlertEmails: true },
    });

    // Chegara o'zgarsa eski yozuvlar ma'nosini yo'qotadi — tozalab, keyingi
    // tekshiruvda yangi chegara bo'yicha qaytadan ogohlantiramiz
    if (data.lowStockThreshold !== undefined) {
      await prisma.stockAlert.deleteMany({ where: { organizationId } });
    }

    res.json({ success: true, ...org });
  } catch (err) {
    next(err);
  }
}

/** POST /api/alerts/test — sinov xati */
export async function sendTestEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, lowStockThreshold: true, stockAlertEmails: true, owner: { select: { email: true } } },
    });
    if (!org) throw new HttpError(404, 'Tashkilot topilmadi');

    const to = org.stockAlertEmails.length ? org.stockAlertEmails : [org.owner.email];
    const { subject, html } = lowStockEmail({
      orgName: org.name,
      threshold: org.lowStockThreshold,
      rows: [
        { marketplace: 'WB', sku: 'DEMO-001', name: 'Sinov mahsuloti', amount: 2, warehouse: 'Sinov ombori' },
        { marketplace: 'UZUM', sku: 'DEMO-002', name: 'Ikkinchi sinov mahsuloti', amount: 0 },
      ],
      dashboardUrl: process.env.WEB_APP_URL
        ? `${process.env.WEB_APP_URL.replace(/\/$/, '')}/dashboard/marketplaces`
        : undefined,
    });

    const result = await sendMail({ to, subject: `[SINOV] ${subject}`, html });
    if (!result.sent) {
      throw new HttpError(
        result.reason === 'not_configured' ? 409 : 502,
        result.reason === 'not_configured'
          ? "Serverda Gmail sozlanmagan — .env ga GMAIL_USER va GMAIL_APP_PASSWORD qo'shing"
          : result.error || 'Xat yuborilmadi',
      );
    }
    res.json({ success: true, recipients: to });
  } catch (err) {
    next(err);
  }
}

/** POST /api/alerts/run — qoldiqni hozir tekshirish */
export async function runNow(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await checkOrganization(req.organization!.id, { force: true });
    res.json({
      success: true,
      checked: report.checked,
      lowCount: report.low.length,
      low: report.low,
      recipients: report.recipients,
      emailSent: report.emailSent,
      emailError: report.emailError,
      errors: report.errors,
    });
  } catch (err) {
    next(err);
  }
}
