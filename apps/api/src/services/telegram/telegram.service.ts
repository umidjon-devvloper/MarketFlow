/**
 * Telegram bildirishnomalari.
 *
 * Bitta server boti (TELEGRAM_BOT_TOKEN, .env) barcha tashkilotlarga xizmat
 * qiladi. Har tashkilot o'z chat/kanal ID sini kiritadi (botni o'z kanaliga
 * qo'shib). Bot faqat matn yuboradi — mijoz ma'lumoti so'ralmaydi.
 */

const TELEGRAM_API = 'https://api.telegram.org';

/** Server boti sozlanganmi — sozlamada Telegram'ni yoqish shunga bog'liq */
export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export interface TelegramResult {
  ok: boolean;
  error?: string;
}

/** Chat/kanalga matn yuborish. Hech qachon exception otmaydi. */
export async function sendTelegram(chatId: string, text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  if (!chatId) return { ok: false, error: 'chat ID kiritilmagan' };

  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err: any) {
    return { ok: false, error: `Telegram'ga ulanib bo'lmadi: ${err?.message || 'tarmoq xatosi'}` };
  }

  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    // Telegram xatoni description'да beradi ("chat not found", "bot was blocked"...)
    const desc = data?.description || `HTTP ${res.status}`;
    return { ok: false, error: `Telegram: ${desc}` };
  }
  return { ok: true };
}

/** Kam qoldiq xabarini HTML matnга yig'ish */
export function lowStockTelegramText(params: {
  orgName: string;
  threshold: number;
  rows: Array<{ marketplace: string; sku: string; name?: string; amount: number; warehouse?: string }>;
  stopped?: Array<{ marketplace: string; sku: string; name?: string }>;
}): string {
  const esc = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines: string[] = [];
  lines.push(`⚠️ <b>Kam qoldiq</b> — ${esc(params.orgName)}`);
  lines.push(`${params.threshold} donadан kam qolgan mahsulotlar:`);
  lines.push('');
  for (const r of params.rows.slice(0, 30)) {
    const name = r.name ? ` — ${esc(r.name.slice(0, 40))}` : '';
    const wh = r.warehouse ? ` · ${esc(r.warehouse)}` : '';
    lines.push(`• <b>${esc(r.marketplace)}</b> <code>${esc(r.sku)}</code>${name}: <b>${r.amount}</b> dona${wh}`);
  }
  if (params.rows.length > 30) lines.push(`… va yana ${params.rows.length - 30} ta`);

  if (params.stopped?.length) {
    lines.push('');
    lines.push(`🛑 <b>Savdodан olindi (stop-list):</b>`);
    for (const s of params.stopped.slice(0, 20)) {
      lines.push(`• ${esc(s.marketplace)} <code>${esc(s.sku)}</code>${s.name ? ' — ' + esc(s.name.slice(0, 40)) : ''}`);
    }
  }
  return lines.join('\n');
}
