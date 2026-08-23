import { describe, it, expect } from 'vitest';
import { __internal } from '../services/marketplace/categories.service';

const { stem, stems, rank, flattenOzon, flattenYandex } = __internal;

/**
 * Bu testlar haqiqiy marketplace javoblariga qarab yozilgan:
 * WB va Yandex kataloglarida kategoriyalar KO'PLIK shaklda saqlanadi
 * ("Рубашки"), sotuvchi esa birlikda qidiradi ("рубашка"). Oddiy substring
 * taqqoslash bunda 0 natija beradi — tekshirilgan.
 */
describe("kategoriya qidiruvi — ruscha o'zak", () => {
  it("ko'plik qo'shimchasini kesadi", () => {
    expect(stem('рубашка')).toBe('рубашк');
    expect(stem('футболки')).toBe('футболк');
    expect(stem('кроссовки')).toBe('кроссовк');
    // "платье" va "платья" bir xil o'zakka tushadi — shuning uchun
    // birlikda yozilgan so'rov ko'plikdagi kategoriyani topadi
    expect(stem('платье')).toBe('плат');
    expect(stem('платья')).toBe('плат');
  });

  it("o'zakni 4 belgidan qisqartirmaydi", () => {
    // "мяч" → "мя" bo'lib ketsa qidiruv butunlay boshqa narsani topardi
    expect(stem('мяч')).toBe('мяч');
    expect(stem('обувь')).toBe('обув');
    expect(stem('обуви')).toBe('обув');
    // 5 harfli so'zdan 1 harf kesiladi — 4 qoladi, bu chegara
    expect(stem('сумка')).toBe('сумк');
  });

  it("sifat qo'shimchalarini ham kesadi", () => {
    // Bular kategoriya nomlarida eng ko'p uchraydigan shakllar
    expect(stem('мужские')).toBe('мужск');
    expect(stem('женские')).toBe('женск');
    expect(stem('детские')).toBe('детск');
  });

  it("bir nechta so'zni alohida o'zaklaydi", () => {
    expect(stems('мужская рубашка')).toEqual(['мужск', 'рубашк']);
    expect(stems('  ЖЕНСКИЕ   Платья ')).toEqual(['женск', 'плат']);
  });
});

describe('kategoriya qidiruvi — tartiblash', () => {
  const options = [
    { id: '184', name: 'Рубашки', path: 'Одежда › Рубашки' },
    { id: '3003', name: 'Рубашки для животных', path: 'Товары для животных › Рубашки для животных' },
    { id: '4414', name: 'Рубашки велосипедные', path: 'Спортивный товар › Рубашки велосипедные' },
    { id: '105', name: 'Кроссовки', path: 'Обувь › Кроссовки' },
  ];

  it("birlikda yozilgan so'rov ko'plikdagi kategoriyani topadi", () => {
    const found = rank(options, 'рубашка', 10);
    expect(found.length).toBe(3);
    expect(found[0].name).toBe('Рубашки');
  });

  it("mos kelmaydigan kategoriyani qaytarmaydi", () => {
    expect(rank(options, 'кроссовки', 10).map((o) => o.id)).toEqual(['105']);
  });

  it("o'xshash o'zakli, lekin boshqa so'zni pastga tushiradi", () => {
    // Bu haqiqiy regressiya edi: "платье" o'zagi "плат" bo'lgani uchun
    // "Платки" va "Платежные браслеты" birinchi o'ringa chiqib ketardi.
    // Taqqoslash to'liq so'z bilan bo'lgani uchun endi "Платья" ustun.
    const items = [
      { id: '1', name: 'Платежные браслеты', path: 'Электроника › Платежные браслеты' },
      { id: '2', name: 'Платки', path: 'Аксессуары › Платки' },
      { id: '3', name: 'Платья', path: 'Одежда › Платья' },
    ];
    expect(rank(items, 'платье', 3)[0].name).toBe('Платья');
  });

  it("ko'p so'zli so'rovda OXIRGI so'z asosiy hisoblanadi", () => {
    // Rus tilida ot oxirida turadi. Eng uzun so'zni tanlasak
    // "женские платья" → "Прокладки женские" ni topardi (haqiqiy xato edi).
    const items = [
      { id: '1', name: 'Прокладки женские', path: 'Гигиена › Прокладки женские' },
      { id: '2', name: 'Платья', path: 'Одежда › Платья' },
    ];
    expect(rank(items, 'женские платья', 2)[0].name).toBe('Платья');
  });

  it("ko'p so'zli so'rovda asosiy so'z yetarli", () => {
    // "мужская" hech bir kategoriya nomida yo'q — qattiq VA mantiq 0 berardi
    const found = rank(options, 'мужская рубашка', 10);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].name).toBe('Рубашки');
  });

  it("bo'sh so'rovda ro'yxatning boshi qaytadi", () => {
    expect(rank(options, '', 2).length).toBe(2);
  });

  it('limitdan oshmaydi', () => {
    expect(rank(options, 'рубашка', 2).length).toBe(2);
  });
});

describe('Ozon daraxtini yoyish', () => {
  // Haqiqiy javob shakli: kategoriyalar nestlangan, barglarda type_id
  const tree = [
    {
      description_category_id: 200000933,
      category_name: 'Одежда',
      children: [
        {
          description_category_id: 200000933,
          category_name: 'Одежда',
          children: [
            { type_name: 'Рубашка', type_id: 93209, children: [] },
            { type_name: 'Футболка', type_id: 93244, children: [] },
            { type_name: 'Устаревшее', type_id: 111, disabled: true, children: [] },
          ],
        },
      ],
    },
  ];

  it('kategoriya + tur juftligini beradi', () => {
    const out = flattenOzon(tree);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: '200000933', typeId: '93209', name: 'Рубашка' });
  });

  it("o'chirilgan turlarni tashlab ketadi", () => {
    expect(flattenOzon(tree).some((o) => o.name === 'Устаревшее')).toBe(false);
  });

  it("to'liq yo'lni yig'adi — bir xil nomlarni ajratish uchun", () => {
    expect(flattenOzon(tree)[0].path).toBe('Одежда › Одежда › Рубашка');
  });
});

describe('Yandex daraxtini yoyish', () => {
  const tree = [
    {
      id: 1,
      name: 'Одежда',
      children: [
        {
          id: 2,
          name: 'Блузы и рубашки',
          children: [{ id: 65993786, name: 'Рубашки для взрослых', children: [] }],
        },
      ],
    },
  ];

  it('faqat barglarni oladi — oraliq tugunga tovar joylab bo\'lmaydi', () => {
    const out = flattenYandex(tree);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: '65993786', name: 'Рубашки для взрослых' });
    expect(out[0].path).toBe('Одежда › Блузы и рубашки › Рубашки для взрослых');
  });
});
