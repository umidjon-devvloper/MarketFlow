/**
 * Email shablonlari.
 *
 * Email mijozlari (ayniqsa Gmail) tashqi CSS va flex/grid'ni tashlab yuboradi —
 * shuning uchun jadval + inline style, boshqa yo'l yo'q.
 */

export interface LowStockRow {
  marketplace: string;
  sku: string;
  name?: string;
  amount: number;
  warehouse?: string;
}

const MP_LABELS: Record<string, string> = {
  UZUM: 'Uzum Market',
  OZON: 'Ozon',
  WB: 'Wildberries',
  YANDEX: 'Yandex Market',
};

const INK = '#0f172a';
const SOFT = '#64748b';
const LINE = '#e2e8f0';

function badge(amount: number): string {
  const [bg, fg] = amount === 0 ? ['#fee2e2', '#b91c1c'] : ['#fef3c7', '#b45309'];
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${bg};color:${fg};font-weight:600;font-size:13px">${amount} ta</span>`;
}

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function lowStockEmail(params: {
  orgName: string;
  threshold: number;
  rows: LowStockRow[];
  dashboardUrl?: string;
}): { subject: string; html: string } {
  const { orgName, threshold, rows, dashboardUrl } = params;
  const outOfStock = rows.filter((r) => r.amount === 0).length;

  const subject =
    outOfStock > 0
      ? `⚠️ ${orgName}: ${outOfStock} ta mahsulot tugadi, jami ${rows.length} tasi kam qoldi`
      : `⚠️ ${orgName}: ${rows.length} ta mahsulot kam qoldi`;

  // Marketplace bo'yicha guruhlaymiz — bitta xatda hammasi ko'rinadi
  const groups = new Map<string, LowStockRow[]>();
  for (const row of rows) {
    const list = groups.get(row.marketplace) ?? [];
    list.push(row);
    groups.set(row.marketplace, list);
  }

  const sections = [...groups.entries()]
    .map(([mp, list]) => {
      const body = list
        .sort((a, b) => a.amount - b.amount)
        .map(
          (r) => `
          <tr>
            <td style="padding:10px 12px;border-top:1px solid ${LINE};color:${INK}">
              ${escape(r.name || r.sku)}
              ${r.name ? `<div style="color:${SOFT};font-size:12px;margin-top:2px">${escape(r.sku)}</div>` : ''}
            </td>
            <td style="padding:10px 12px;border-top:1px solid ${LINE};color:${SOFT};font-size:13px">${escape(r.warehouse || '—')}</td>
            <td style="padding:10px 12px;border-top:1px solid ${LINE};text-align:right;white-space:nowrap">${badge(r.amount)}</td>
          </tr>`,
        )
        .join('');

      return `
        <h3 style="margin:28px 0 8px;font-size:15px;color:${INK}">${escape(MP_LABELS[mp] || mp)}</h3>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;border-collapse:separate;border-spacing:0;overflow:hidden">
          <tr style="background:#f8fafc">
            <th align="left" style="padding:9px 12px;font-size:12px;font-weight:600;color:${SOFT}">Mahsulot</th>
            <th align="left" style="padding:9px 12px;font-size:12px;font-weight:600;color:${SOFT}">Ombor</th>
            <th align="right" style="padding:9px 12px;font-size:12px;font-weight:600;color:${SOFT}">Qoldiq</th>
          </tr>
          ${body}
        </table>`;
    })
    .join('');

  const button = dashboardUrl
    ? `<a href="${dashboardUrl}" style="display:inline-block;margin-top:28px;padding:11px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:9px;font-weight:600;font-size:14px">Marketplace'larni ochish</a>`
    : '';

  const html = `
<div style="background:#f1f5f9;padding:28px 12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;padding:30px 28px">
    <p style="margin:0;font-size:13px;color:${SOFT};letter-spacing:.04em;text-transform:uppercase">MarketFlow</p>
    <h1 style="margin:6px 0 4px;font-size:21px;color:${INK}">Qoldiq kamayib qoldi</h1>
    <p style="margin:0;color:${SOFT};font-size:14px">
      <b style="color:${INK}">${escape(orgName)}</b> — quyidagi mahsulotlar ${threshold} tadan kam qoldi.
    </p>
    ${sections}
    ${button}
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${LINE};color:${SOFT};font-size:12px;line-height:1.6">
      Bu xat MarketFlow'dagi qoldiq nazorati tomonidan avtomatik yuborildi.
      Chegarani o'zgartirish yoki xabarnomani o'chirish — Sozlamalar → Qoldiq xabarnomasi.
    </p>
  </div>
</div>`;

  return { subject, html };
}
