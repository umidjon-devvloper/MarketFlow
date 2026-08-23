/**
 * Email yuborish — Gmail SMTP orqali.
 *
 * Sozlash (bir marta):
 *   1. Gmail akkauntida 2-bosqichli tasdiqni yoqing
 *   2. https://myaccount.google.com/apppasswords → "App password" yarating
 *   3. .env ga: GMAIL_USER=siz@gmail.com, GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 *
 * Oddiy Gmail parol ishlamaydi — Google 2022-yildan beri uni SMTP uchun bloklaydi.
 *
 * Sozlama bo'lmasa ilova yiqilmaydi: xat konsolga yoziladi va `skipped` qaytadi.
 * Shu tufayli lokal ishlashda hech narsa sozlash shart emas.
 */

import nodemailer, { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export type MailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: 'not_configured' | 'no_recipients' | 'error'; error?: string };

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      // App password probelli ko'chiriladi — Google uni e'tiborsiz qoldiradi
      pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    },
  });
  return transporter;
}

/** Yuboruvchi nomi: "MarketFlow <siz@gmail.com>" */
function from(): string {
  const name = process.env.MAIL_FROM_NAME || 'MarketFlow';
  return `"${name}" <${process.env.GMAIL_USER}>`;
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const to = [...new Set(msg.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return { sent: false, reason: 'no_recipients' };

  if (!isMailConfigured()) {
    console.warn(
      `📭 GMAIL_USER/GMAIL_APP_PASSWORD sozlanmagan — xat yuborilmadi.\n` +
        `   Kimga: ${to.join(', ')}\n   Mavzu: ${msg.subject}`,
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: from(),
      to: to.join(', '),
      subject: msg.subject,
      html: msg.html,
      text: msg.text || stripHtml(msg.html),
    });
    return { sent: true, messageId: info.messageId };
  } catch (err: any) {
    // Eng ko'p uchraydigan sabab — app password o'rniga oddiy parol
    const hint =
      /invalid login|username and password not accepted|BadCredentials/i.test(err?.message || '')
        ? " (Gmail kirishni rad etdi — GMAIL_APP_PASSWORD haqiqiy \"App password\" ekaniga ishonch hosil qiling)"
        : '';
    console.error(`📭 Email yuborilmadi: ${err?.message}${hint}`);
    return { sent: false, reason: 'error', error: `${err?.message ?? 'xato'}${hint}` };
  }
}

/** SMTP ulanishini tekshirish — sozlamalar sahifasidagi "Tekshirish" tugmasi uchun */
export async function verifyMail(): Promise<{ ok: boolean; error?: string }> {
  if (!isMailConfigured()) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD sozlanmagan' };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'ulanib bo\'lmadi' };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|h1|h2|h3|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
