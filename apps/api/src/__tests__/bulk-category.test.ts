import { describe, it, expect } from 'vitest';
import { MARKETPLACE_SPECS, validateValues, allFields } from '../services/marketplace/specs';
import { prefillForMarketplace } from '../services/marketplace/prefill';

/**
 * Ommaviy kategoriya tanlashning asosiy shartlari.
 *
 * Eng katta tuzoq shu yerda edi: agar `byMarketplace.OZON` ga faqat
 * `{ categoryId }` yozib qo'ysak, joylash paytidagi "Uzum qiymatlariga
 * tushish" mantig'i ishlamay qoladi va endi BARCHA maydonlar yetishmay
 * qoladi — ya'ni holatni yaxshilash o'rniga buzgan bo'lardik.
 *
 * Shuning uchun avval to'liq qiymatlar to'plami quriladi (prefill), keyin
 * ustiga kategoriya qo'yiladi. Quyidagi testlar aynan shuni qulflaydi.
 */
describe('ommaviy kategoriya — to\'liq qiymatlar to\'plami', () => {
  /** Uzum uchun to'ldirilgan namunaviy kartochka */
  const uzumValues: Record<string, string> = {
    category: "Uzum katalogi/kiyim/erkaklar kiyimlari",
    title: "Erkaklar ko'ylagi",
    titleUz: "Erkaklar ko'ylagi",
    skuGroup: 'KOYLAK',
    brand: 'No name',
    description: 'Sifatli paxta',
    descriptionUz: 'Sifatli paxta',
    shortRu: 'qisqa',
    shortUz: 'qisqa',
    mxik: '0100100100100000',
    sku: 'SHIRT-001',
    price: '120000',
    oldPrice: '150000',
    stock: '10',
    vat: '0%',
    color: 'Oq',
    material: '100% paxta',
    country: "O'zbekiston",
    weight: '400',        // gramm
    packLength: '300',    // millimetr
    packWidth: '200',
    packHeight: '50',
  };

  const productFields = {
    title: "Erkaklar ko'ylagi",
    description: 'Sifatli paxta',
    category: 'kiyim',
    brand: 'No name',
    sku: 'SHIRT-001',
    barcode: '4780000000001',
    basePrice: '120000',
    currency: 'UZS',
    stock: 10,
  };

  it("faqat categoryId yozish YETARLI EMAS — bu asosiy tuzoq", () => {
    const spec = MARKETPLACE_SPECS.OZON;
    const onlyCategory = { categoryId: '200000933', typeId: '93209', category: 'Рубашка' };

    const issues = validateValues(spec, onlyCategory, { forPublish: true });
    // Nom, narx, zaxira — hammasi yo'q. Shuning uchun prefill shart.
    expect(issues.length).toBeGreaterThan(5);
  });

  it("prefill + kategoriya = joylashga tayyor", () => {
    const target = MARKETPLACE_SPECS.OZON;
    const prefilled = prefillForMarketplace(
      uzumValues,
      MARKETPLACE_SPECS.UZUM,
      productFields,
      target,
    );

    const withCategory = {
      ...prefilled.values,
      category: 'Рубашка',
      categoryId: '200000933',
      typeId: '93209',
    };

    expect(validateValues(target, withCategory, { forPublish: true })).toEqual([]);
  });

  it("birliklar o'girilib ko'chadi — Uzum mm, WB sm", () => {
    const prefilled = prefillForMarketplace(
      uzumValues,
      MARKETPLACE_SPECS.UZUM,
      productFields,
      MARKETPLACE_SPECS.WB,
    );
    // 300 mm → 30 sm. O'girilmasa WB tovarni 300 sm deb hisoblardi
    expect(prefilled.values.packLength).toBe('30');
  });

  it('WB va Yandex uchun ham ishlaydi', () => {
    for (const id of ['WB', 'YANDEX'] as const) {
      const target = MARKETPLACE_SPECS[id];
      const prefilled = prefillForMarketplace(
        uzumValues,
        MARKETPLACE_SPECS.UZUM,
        productFields,
        target,
      );
      const withCategory = { ...prefilled.values, category: 'Рубашки', categoryId: '184' };

      const issues = validateValues(target, withCategory, { forPublish: true });
      expect(issues.map((i) => i.label), `${id} da yetishmayapti`).toEqual([]);
    }
  });

  it("yashirin maydonlar sehrgardagi formadan chiqarilgan bo'lsa ham publishda so'raladi", () => {
    for (const id of ['OZON', 'WB', 'YANDEX'] as const) {
      const hidden = allFields(MARKETPLACE_SPECS[id]).filter((f) => f.hidden);
      expect(hidden.length, `${id}`).toBeGreaterThan(0);
      expect(hidden.every((f) => f.publishRequired)).toBe(true);
    }
  });
});

describe('prefill — boshqacha nomlangan, bir xil ma\'noli maydonlar', () => {
  it("Uzum 'material' → WB 'composition' ga ko'chadi", () => {
    // Bu haqiqiy kamchilik edi: WB tarkibni "Состав" deb ataydi, Uzum
    // "Material". Kalitlar mos kelmagani uchun sotuvchi allaqachon yozgan
    // qiymat ko'chmasdi va WB kartochkasi har doim to'liq bo'lmasdi.
    const out = prefillForMarketplace(
      { material: '100% paxta' },
      MARKETPLACE_SPECS.UZUM,
      {},
      MARKETPLACE_SPECS.WB,
    );
    expect(out.values.composition).toBe('100% paxta');
  });

  it("teskari yo'nalish ham ishlaydi: WB 'composition' → Ozon 'material'", () => {
    const out = prefillForMarketplace(
      { composition: 'хлопок 95%, эластан 5%' },
      MARKETPLACE_SPECS.WB,
      {},
      MARKETPLACE_SPECS.OZON,
    );
    expect(out.values.material).toBe('хлопок 95%, эластан 5%');
  });

  it("asl maydon to'ldirilgan bo'lsa sinonim uni bosib ketmaydi", () => {
    const out = prefillForMarketplace(
      { composition: 'asl qiymat', material: 'sinonim qiymat' },
      MARKETPLACE_SPECS.OZON,
      {},
      MARKETPLACE_SPECS.WB,
    );
    expect(out.values.composition).toBe('asl qiymat');
  });
});
