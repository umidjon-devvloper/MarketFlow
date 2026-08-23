import { describe, it, expect } from 'vitest';
import {
  getOrderCapabilities,
  cancelOrder,
  confirmOrder,
  OrderActionError,
} from '../services/marketplace/order-actions.service';

/**
 * Bu amallar HAQIQIY mijoz buyurtmasiga ta'sir qiladi va qaytarib bo'lmaydi.
 * Shuning uchun eng muhim tekshiruv — qo'llab-quvvatlanmagan joyda umuman
 * chaqiruv ketmasligi. Ilgari bunday kod "urinib ko'ramiz, xato kelsa
 * ko'rsatamiz" tarzida yozilardi; bu yerda esa xato = noto'g'ri buyurtmani
 * bekor qilish xavfi.
 */
describe('buyurtma amallari — imkoniyatlar', () => {
  it("WB'da bekor qilish YOPIQ va sababi aytilgan", () => {
    // Keshdagi ID statistikadan olingan `srid`, bekor qilish esa FBS
    // yig'ish buyurtmasining boshqa ID sini talab qiladi
    const caps = getOrderCapabilities('WB' as any);
    expect(caps.canCancel).toBe(false);
    expect(caps.canConfirm).toBe(false);
    expect(caps.notes[0]).toContain('srid');
  });

  it("Ozon'da tasdiqlash yo'q, bekor qilish bor", () => {
    const caps = getOrderCapabilities('OZON' as any);
    expect(caps.canConfirm).toBe(false);
    expect(caps.canCancel).toBe(true);
    expect(caps.cancelNeedsReason).toBe(true);
    expect(caps.notes[0]).toContain('yig');
  });

  it('Uzum ikkalasini ham qo\'llab-quvvatlaydi, sababsiz', () => {
    const caps = getOrderCapabilities('UZUM' as any);
    expect(caps.canConfirm).toBe(true);
    expect(caps.canCancel).toBe(true);
    expect(caps.cancelNeedsReason).toBe(false);
  });

  it('Yandex bekor qilishda sabab talab qiladi', () => {
    const caps = getOrderCapabilities('YANDEX' as any);
    expect(caps.canCancel).toBe(true);
    expect(caps.cancelNeedsReason).toBe(true);
  });
});

describe('buyurtma amallari — himoya', () => {
  const creds = { apiKey: 'test', apiSecret: 'test', shopId: '1' };

  it("WB'ni bekor qilishga urinish tarmoqqa CHIQMAYDI", async () => {
    // Agar bu tekshiruv bo'lmasa, so'rov ketib boshqa buyurtmani bekor qilardi
    await expect(cancelOrder('WB' as any, creds, 'srid-123')).rejects.toThrow(OrderActionError);
  });

  it("Ozon'ni tasdiqlashga urinish tarmoqqa CHIQMAYDI", async () => {
    await expect(confirmOrder('OZON' as any, creds, 'posting-1')).rejects.toThrow(OrderActionError);
  });

  it("sabab majburiy bo'lgan joyda sababsiz bekor qilib bo'lmaydi", async () => {
    await expect(cancelOrder('YANDEX' as any, creds, '123')).rejects.toThrow(/sabab/i);
    await expect(cancelOrder('OZON' as any, creds, 'p-1')).rejects.toThrow(/sabab/i);
  });

  it("Ozon sababi raqamli bo'lmasa to'xtatadi", async () => {
    // `cancel_reason_id` raqam bo'lishi shart — matn yuborilsa Ozon
    // tushunarsiz xato beradi yoki noto'g'ri sababni qo'llaydi
    await expect(
      cancelOrder('OZON' as any, creds, 'p-1', { reasonId: 'SHOP_FAILED' }),
    ).rejects.toThrow(/raqamli/i);
  });

  it("Yandex uchun kampaniya ID bo'lmasa to'xtatadi", async () => {
    await expect(
      confirmOrder('YANDEX' as any, { apiKey: 'x', shopId: null }, '123'),
    ).rejects.toThrow(/kampaniya/i);
  });
});
