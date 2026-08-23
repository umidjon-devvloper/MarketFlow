/**
 * Buyurtmani tasdiqlash va bekor qilish
 *
 * Bu modul boshqalardan farq qiladi: bu yerdagi har bir chaqiruv HAQIQIY
 * MIJOZ BUYURTMASIGA ta'sir qiladi va qaytarib bo'lmaydi. Bekor qilingan
 * buyurtmani tiklab bo'lmaydi, ustiga u sotuvchi reytingiga yoziladi.
 *
 * Shuning uchun ikkita qoida:
 *
 * 1. YO'Q NARSANI BOR QILIB KO'RSATMAYMIZ. "Tasdiqlash" tushunchasi hamma
 *    bozorda yo'q: Ozon va WB'da FBS oqimi boshqacha (jo'natmani yig'ish,
 *    postavkaga qo'shish), "tasdiqlash" degan qadam umuman mavjud emas.
 *    Ularga soxta tugma qo'yish sotuvchini chalg'itadi.
 *
 * 2. IDENTIFIKATOR MOS KELISHI SHART. WB'da keshdagi ID — statistikadan
 *    olingan `srid`, bekor qilish esa FBS yig'ish buyurtmasining raqamli
 *    ID sini talab qiladi. Bular ikki xil identifikator maydoni. Taxminan
 *    moslashtirish — boshqa buyurtmani bekor qilish xavfi, shuning uchun
 *    WB uchun bekor qilish ochilmagan va sababi aytilgan.
 */

import { Marketplace } from '@prisma/client';
import * as uzum from './uzum-api.service';
import * as ozon from './ozon-api.service';
import * as yandex from './yandex-api.service';
import { getSpec } from './specs';

export interface ActionCreds {
  apiKey: string;
  apiSecret?: string | null;
  shopId?: string | null;
}

export interface CancelReason {
  id: string;
  title: string;
  /** Ozon ba'zi sabablar uchun izoh ham talab qiladi */
  needsComment?: boolean;
}

export interface OrderCapabilities {
  canConfirm: boolean;
  canCancel: boolean;
  /** Bekor qilishda sabab tanlash majburiymi */
  cancelNeedsReason: boolean;
  /** Nima uchun imkoniyat yo'q — sotuvchi tushunsin */
  notes: string[];
}

const CAPABILITIES: Record<Marketplace, OrderCapabilities> = {
  UZUM: {
    canConfirm: true,
    canCancel: true,
    cancelNeedsReason: false,
    notes: [],
  },
  YANDEX: {
    canConfirm: true,
    canCancel: true,
    cancelNeedsReason: true,
    notes: [
      "Bekor qilishda sabab majburiy: Yandex \"do'kon aybi\" va \"xaridor fikridan qaytdi\" ni " +
        'boshqacha hisoblaydi va reytingga har xil ta\'sir qiladi.',
    ],
  },
  OZON: {
    canConfirm: false,
    canCancel: true,
    cancelNeedsReason: true,
    notes: [
      'Ozon FBS oqimida "tasdiqlash" qadami yo\'q — jo\'natma yig\'iladi va jo\'natiladi. ' +
        'Buni seller kabinetida bajaring.',
    ],
  },
  WB: {
    canConfirm: false,
    canCancel: false,
    cancelNeedsReason: false,
    notes: [
      'Wildberries buyurtmalari statistika API\'sidan o\'qiladi va u yerda buyurtma ' +
        '`srid` bilan belgilanadi. Bekor qilish esa FBS yig\'ish buyurtmasining boshqa ' +
        'identifikatorini talab qiladi — ular mos kelmaydi. Noto\'g\'ri buyurtmani bekor ' +
        'qilib qo\'ymaslik uchun bu amal ochilmagan: WB kabinetida bajaring.',
    ],
  },
};

export function getOrderCapabilities(marketplace: Marketplace): OrderCapabilities {
  return CAPABILITIES[marketplace];
}

export class OrderActionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'OrderActionError';
  }
}

function assertSupported(marketplace: Marketplace, action: 'confirm' | 'cancel') {
  const spec = getSpec(marketplace);
  const caps = CAPABILITIES[marketplace];
  const allowed = action === 'confirm' ? caps.canConfirm : caps.canCancel;

  if (!allowed) {
    throw new OrderActionError(
      caps.notes[0] ||
        `${spec?.name ?? marketplace} bu amalni qo'llab-quvvatlamaydi — seller kabinetida bajaring`,
    );
  }
}

// ─── BEKOR QILISH SABABLARI ──────────────────────────────

/**
 * Bekor qilish sabablari ro'yxati.
 *
 * Ozon'da sabab jo'natmaga qarab farq qiladi (yig'ishdan oldinmi yoki keyinmi),
 * shuning uchun har safar API'dan so'raladi. Yandex'da ro'yxat qat'iy.
 */
export async function getCancelReasons(
  marketplace: Marketplace,
  creds: ActionCreds,
  externalId: string,
): Promise<CancelReason[]> {
  switch (marketplace) {
    case 'YANDEX':
      return yandex.YANDEX_CANCEL_REASONS.map((r) => ({ id: r.id, title: r.title }));

    case 'OZON': {
      if (!creds.apiSecret) throw new OrderActionError('Ozon uchun Client-Id kerak');
      const reasons = await ozon.getCancelReasons(
        { apiKey: creds.apiKey, clientId: creds.apiSecret },
        externalId,
      );
      if (!reasons.length) {
        throw new OrderActionError(
          "Ozon bu jo'natma uchun bekor qilish sabablarini qaytarmadi — " +
            'jo\'natma allaqachon yopilgan bo\'lishi mumkin',
          409,
        );
      }
      return reasons.map((r) => ({ id: String(r.id), title: r.title }));
    }

    default:
      return [];
  }
}

// ─── TASDIQLASH ──────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
  /** Marketplace'dagi yangi holat (bilsak) */
  status?: string;
  raw?: unknown;
}

export async function confirmOrder(
  marketplace: Marketplace,
  creds: ActionCreds,
  externalId: string,
): Promise<ActionResult> {
  assertSupported(marketplace, 'confirm');
  const spec = getSpec(marketplace);

  switch (marketplace) {
    case 'UZUM': {
      const raw = await uzum.confirmFbsOrder(creds.apiKey, externalId);
      return {
        success: true,
        status: 'CONFIRMED',
        message: `Buyurtma ${spec?.name} da tasdiqlandi`,
        raw,
      };
    }

    case 'YANDEX': {
      if (!creds.shopId) {
        throw new OrderActionError("Yandex kampaniya ID topilmadi — avval \"Test qilish\" ni bosing");
      }
      const raw = await yandex.updateOrderStatus(
        creds.apiKey,
        creds.shopId,
        externalId,
        'PROCESSING',
        'STARTED',
      );
      return {
        success: true,
        status: 'PROCESSING',
        message: 'Buyurtma tasdiqlandi — endi uni yig\'ishni boshlash mumkin',
        raw,
      };
    }

    default:
      throw new OrderActionError(`${spec?.name ?? marketplace} tasdiqlashni qo'llab-quvvatlamaydi`);
  }
}

// ─── BEKOR QILISH ────────────────────────────────────────

export async function cancelOrder(
  marketplace: Marketplace,
  creds: ActionCreds,
  externalId: string,
  { reasonId, comment }: { reasonId?: string; comment?: string } = {},
): Promise<ActionResult> {
  assertSupported(marketplace, 'cancel');
  const spec = getSpec(marketplace);
  const caps = CAPABILITIES[marketplace];

  if (caps.cancelNeedsReason && !reasonId) {
    throw new OrderActionError(`${spec?.name} bekor qilish sababini talab qiladi`);
  }

  switch (marketplace) {
    case 'UZUM': {
      const raw = await uzum.cancelFbsOrder(
        creds.apiKey,
        externalId,
        comment ? { reason: comment } : {},
      );
      return { success: true, status: 'CANCELED', message: 'Buyurtma bekor qilindi', raw };
    }

    case 'YANDEX': {
      if (!creds.shopId) {
        throw new OrderActionError("Yandex kampaniya ID topilmadi");
      }
      const raw = await yandex.updateOrderStatus(
        creds.apiKey,
        creds.shopId,
        externalId,
        'CANCELLED',
        reasonId!,
      );
      return { success: true, status: 'CANCELLED', message: 'Buyurtma bekor qilindi', raw };
    }

    case 'OZON': {
      if (!creds.apiSecret) throw new OrderActionError('Ozon uchun Client-Id kerak');
      const id = Number(reasonId);
      if (!Number.isFinite(id)) {
        throw new OrderActionError("Ozon bekor qilish sababi raqamli bo'lishi kerak");
      }
      const raw = await ozon.cancelPosting(
        { apiKey: creds.apiKey, clientId: creds.apiSecret },
        externalId,
        id,
        comment,
      );
      return { success: true, status: 'CANCELLED', message: "Jo'natma bekor qilindi", raw };
    }

    default:
      throw new OrderActionError(`${spec?.name ?? marketplace} bekor qilishni qo'llab-quvvatlamaydi`);
  }
}

export const __internal = { CAPABILITIES, assertSupported };
