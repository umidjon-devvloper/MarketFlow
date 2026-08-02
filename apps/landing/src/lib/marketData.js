export const marketOrder = ["uzum", "ozon", "wb", "yandex"];

export const marketData = {
  uzum: {
    label: "Uzum Market",
    lang: "O'zbekcha",
    ar: "1 / 1",
    frameNote:
      "Oq fon, mahsulot markazda — 1:1 kvadrat kadr tavsiya etiladi.",
    price: "245 000 — 268 000 so'm",
    priceNote:
      "Shu toifadagi mahsulotlar Uzumda ko'pincha shu narx oralig'ida faol sotiladi.",
    title:
      "Erkaklar krossovkasi, mesh material, oq-kulrang — yengil sport poyabzal 40-45",
    category: "Poyabzal → Erkaklar poyabzali → Krossovkalar",
    keywords: "krossovka, sport poyabzal, mesh, yengil, erkaklar oyoq kiyimi",
    description:
      "Mesh matodan tikilgan, yengil va nafas oluvchi erkaklar krossovkasi. Kunlik kiyish va yengil yurish uchun qulay, amortizatsiyalangan taglik bilan.",
    specs: [
      ["Material", "Mesh + EVA taglik"],
      ["Rang", "Oq-kulrang"],
      ["O'lcham", "40 — 45"],
      ["Mavsum", "Bahor / Yoz"],
    ],
  },
  ozon: {
    label: "Ozon",
    lang: "Ruscha",
    ar: "1 / 1",
    frameNote:
      "Oq fon + 3 burchakdan rakurs — Ozon talabiga mos kadr tavsiya etiladi.",
    price: "238 000 — 256 000 so'm",
    priceNote:
      "Ozonda shu segmentda raqobat yuqori — narx biroz pastroq tavsiya etiladi.",
    title: "Кроссовки мужские сетка, лёгкие спортивные, 40–45 размер",
    category: "Обувь → Мужская обувь → Кроссовки",
    keywords: "кроссовки мужские, сетка, спортивная обувь, лёгкие кроссовки",
    description:
      "Мужские кроссовки из дышащей сетки. Лёгкая подошва подходит для повседневной носки и активного отдыха.",
    specs: [
      ["Материал", "Сетка + EVA подошва"],
      ["Цвет", "Бело-серый"],
      ["Размеры", "40 — 45"],
      ["Сезон", "Весна / Лето"],
    ],
  },
  wb: {
    label: "Wildberries",
    lang: "Ruscha",
    ar: "3 / 4",
    frameNote:
      "Vertikal 3:4 kadr — WB algoritmi shunday rasmlarni ko'proq ko'rsatadi.",
    price: "252 000 — 279 000 so'm",
    priceNote:
      "WB komissiyasi yuqoriroq — narx shu hisobga ko'ra moslashtirildi.",
    title: "Кроссовки мужские сетка дышащая, спортивная обувь 40-45",
    category: "Мужская обувь / Кроссовки и кеды",
    keywords: "кроссовки, кеды мужские, сетка, повседневная обувь",
    description:
      "Дышащие мужские кроссовки на лёгкой подошве. Подходят для города и активного дня.",
    specs: [
      ["Материал", "Сетка"],
      ["Цвет", "Бело-серый"],
      ["Размеры", "40 — 45"],
      ["Сезон", "Демисезон"],
    ],
  },
  yandex: {
    label: "Yandex Market",
    lang: "Ruscha",
    ar: "1 / 1",
    frameNote:
      "Oq fon, soyasiz, mahsulot to'liq ko'rinishda — narx-taqqoslagich uchun qulay.",
    price: "241 000 — 263 000 so'm",
    priceNote:
      "Yandex narx-taqqoslagichidagi o'rtacha bozor narxiga moslandi.",
    title: "Кроссовки мужские текстиль/сетка, спортивный стиль 40-45",
    category: "Обувь → Кроссовки",
    keywords: "мужские кроссовки, сетка, спорт",
    description:
      "Лёгкие текстильные кроссовки для повседневной носки. Хорошая воздухопроницаемость и удобная посадка.",
    specs: [
      ["Материал", "Текстиль/сетка"],
      ["Цвет", "Бело-серый"],
      ["Размеры", "40 — 45"],
      ["Сезон", "Лето"],
    ],
  },
};

// Marketplace logos. Files live in /public/logos — replace these SVGs with the
// real brand logos (keep the same filenames) and they update everywhere.
export const marketLogos = {
  uzum: "/logos/uzum.jpg",
  ozon: "/logos/ozon.jpg",
  wb: "/logos/wildberries.jpg",
  yandex: "/logos/yandex.jpg",
};

// Explicit class strings so Tailwind's content scanner can detect them
// (dynamic template interpolation like `bg-${market}` would not be detected).
export const marketColorClasses = {
  uzum: { bg: "bg-uzum", text: "text-uzum", border: "border-uzum" },
  ozon: { bg: "bg-ozon", text: "text-ozon", border: "border-ozon" },
  wb: { bg: "bg-wb", text: "text-wb", border: "border-wb" },
  yandex: { bg: "bg-yandex", text: "text-yandex", border: "border-yandex" },
};
