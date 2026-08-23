import { describe, it, expect } from 'vitest';
import { __internal } from '../services/marketplace/publish-queue.service';

const { isTransient, backoffUntil, nextPendingCheck, classifySkip } = __internal;

/**
 * Qayta urinish siyosati eng oson jimgina noto'g'ri bo'ladigan qism:
 * agar "majburiy maydon bo'sh" ni vaqtinchalik deb hisoblasak, tizim
 * uch marta qayta urinib, marketplace limitini bekorga sarflaydi va
 * sotuvchi "hali ishlayapti" deb kutib o'tiradi.
 */
describe('publish navbati — qayta urinish siyosati', () => {
  it('limit va server xatolarini vaqtinchalik deb biladi', () => {
    expect(isTransient({ status: 429 })).toBe(true);
    expect(isTransient({ status: 500 })).toBe(true);
    expect(isTransient({ status: 503 })).toBe(true);
  });

  it('tarmoq uzilishlarini vaqtinchalik deb biladi', () => {
    expect(isTransient(new Error('fetch failed'))).toBe(true);
    expect(isTransient(new Error('connect ETIMEDOUT 1.2.3.4:443'))).toBe(true);
    expect(isTransient(new Error('socket hang up'))).toBe(true);
  });

  it("ma'lumot xatolarida qayta urinmaydi", () => {
    // Bular o'z-o'zidan tuzalmaydi — qayta urinish faqat limitni sarflaydi
    expect(isTransient({ status: 400 })).toBe(false);
    expect(isTransient({ status: 403 })).toBe(false);
    expect(isTransient({ status: 404 })).toBe(false);
    expect(isTransient(new Error("Majburiy maydon bo'sh: Kategoriya"))).toBe(false);
  });

  it('kutish vaqti har urinishda ikki barobar oshadi', () => {
    const now = Date.now();
    const first = backoffUntil(1).getTime() - now;
    const second = backoffUntil(2).getTime() - now;
    const third = backoffUntil(3).getTime() - now;

    expect(Math.round(first / 60_000)).toBe(2);
    expect(Math.round(second / 60_000)).toBe(4);
    expect(Math.round(third / 60_000)).toBe(8);
  });

  it("WB'ni boshqalardan kechroq tekshiradi", () => {
    // WB kartochkani 30 daqiqagacha sinxronlaydi — undan tez so'rash
    // faqat limitni sarflaydi va baribir "hali tayyor emas" beradi
    const wb = nextPendingCheck('WB' as any).getTime();
    const ozon = nextPendingCheck('OZON' as any).getTime();
    expect(wb).toBeGreaterThan(ozon);
  });
});

/**
 * Bu tasnif haqiqiy shikoyatdan keyin qo'shildi: sotuvchi
 * «Short + brend: Kategoriya ID, Tovar turi ID» degan xabarni ko'rib,
 * uni qayerdan olishni tushunmadi. Sabab bir xil ko'rinsa ham, ostida
 * ikki xil holat yotadi va yechimlari boshqa-boshqa.
 */
describe('publish navbati — nega tayyor emas', () => {
  const CATEGORY_ISSUES = [
    { key: 'categoryId', label: 'Kategoriya ID' },
    { key: 'typeId', label: 'Tovar turi ID' },
  ];

  it("faqat kategoriya yetishsa — kartochka boshqa bozor uchun bo'lsa ham 'category'", () => {
    // Qolgan maydonlar tekshiruvdan o'tgan (nom, narx, o'lcham — hammasi
    // Uzum kartochkasidan ko'chadi). Demak sehrgardan to'liq o'tish shart emas,
    // kategoriya tanlash kifoya.
    const out = classifySkip(CATEGORY_ISSUES, 'Ozon', {
      hasOwnValues: false,
      preparedFor: 'UZUM',
    });
    expect(out.action).toBe('category');
  });

  it("boshqa maydonlar ham yetishsa va manba ma'lum bo'lsa — 'prepare', manba nomi bilan", () => {
    const out = classifySkip(
      [...CATEGORY_ISSUES, { key: 'composition', label: 'Tarkib' }],
      'Ozon',
      { hasOwnValues: false, preparedFor: 'UZUM' },
    );
    expect(out.action).toBe('prepare');
    expect(out.reason).toContain('UZUM');
    expect(out.reason).toContain('Ozon');
  });

  it("faqat kategoriya yetishmasa 'category' deb belgilaydi", () => {
    const out = classifySkip(CATEGORY_ISSUES, 'Ozon', { hasOwnValues: true });
    expect(out.action).toBe('category');
    expect(out.reason).toContain('katalogdan');
  });

  it("qiymatlar bor, lekin ba'zi maydon yetishmasa 'other' bo'ladi", () => {
    const out = classifySkip(
      [...CATEGORY_ISSUES, { key: 'barcode', label: 'Shtrix kod' }],
      'Ozon',
      { hasOwnValues: true },
    );
    expect(out.action).toBe('other');
    expect(out.missing).toContain('Shtrix kod');
  });

  it("qiymatlar umuman bo'lmasa — 16 ta maydonni sanamay, 'prepare' deydi", () => {
    // Eski oqimda yaratilgan kartochkada `attributes.marketplace` ham bo'lmaydi.
    // Ilgari bunda "To'ldirilmagan: Tovar turi, Kategoriya ID, Nomi, Artikul…"
    // degan 16 elementli ro'yxat chiqardi — foydasiz, chunki javob bitta.
    const many = [
      { key: 'title', label: 'Nomi' },
      { key: 'sku', label: 'Artikul' },
      { key: 'categoryId', label: 'Kategoriya ID' },
      { key: 'price', label: 'Narx' },
    ];
    const out = classifySkip(many, 'Ozon', { hasOwnValues: false });
    expect(out.action).toBe('prepare');
    expect(out.reason).toContain('tayyorlang');
  });

  it("yetishmayotgan maydonlar ro'yxati har doim qaytadi", () => {
    for (const ctx of [{ hasOwnValues: true }, { hasOwnValues: false, preparedFor: 'WB' }]) {
      expect(classifySkip(CATEGORY_ISSUES, 'Ozon', ctx).missing).toEqual([
        'Kategoriya ID',
        'Tovar turi ID',
      ]);
    }
  });
});
