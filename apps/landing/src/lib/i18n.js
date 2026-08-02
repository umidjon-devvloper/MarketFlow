export const LANGS = [
  { code: "uz", label: "O'z", name: "O'zbekcha" },
  { code: "ru", label: "Ру", name: "Русский" },
  { code: "en", label: "EN", name: "English" },
];

export const DEFAULT_LANG = "uz";

export const dict = {
  uz: {
    nav: { how: "Qanday ishlaydi", features: "Imkoniyatlar", demo: "Demo", pricing: "Narxlar", login: "Kirish", try: "Sinab ko'rish" },
    hero: {
      badge: "AI yordamchisi bilan",
      titleA: "Mahsulotingiz endi",
      titleHi: "har bitta",
      titleB: "bozorda tayyor turadi",
      subtitle:
        "Rasmni yuklang — MarketFlow uni Uzum Market, Ozon, Wildberries va Yandex Market uchun alohida sarlavha, tavsif, narx va kadr tavsiyasi bilan tayyorlaydi. Sizga faqat nusxalab joylashtirish qoladi.",
      ctaTry: "Hoziroq sinab ko'ring",
      ctaHow: "Qanday ishlaydi",
      trust: "4 bozor — bitta rasmdan, 30 soniyada",
    },
    metrics: [
      { label: "Ulangan bozor", note: "Uzum · Ozon · WB · Yandex" },
      { label: "O'rtacha tahlil", note: "bitta rasm uchun" },
      { label: "Tejalgan vaqt", note: "qo'lda yozishga nisbatan" },
      { label: "Tayyorlangan e'lon", note: "va o'sib bormoqda" },
    ],
    flow: {
      eyebrow: "Jarayon", titleA: "Bir rasm —", titleHi: "uch qadamda", titleB: "to'rt bozorda",
      subtitle: "Yuklashdan e'longacha — butun jarayon ko'z oldingizda.",
      stepWord: "QADAM", analysing: "AI tahlil qilmoqda…", published: "E'lon joylandi",
      steps: [
        { title: "Rasmni yuklang", desc: "Mahsulot fotosini tashlang yoki telefondan tanlang — boshqa hech narsa yozish shart emas." },
        { title: "AI tahlil qiladi", desc: "Har bir bozor uchun kadr, narx oralig'i, sarlavha va tavsif alohida tayyorlanadi." },
        { title: "Nusxalang yoki ulang", desc: "Bir bosishda nusxalang yoki hisobni ulab e'lonlarni avtomatik joylang." },
      ],
    },
    features: {
      eyebrow: "Imkoniyatlar", titleA: "Sotuvni tezlashtiruvchi", titleHi: "AI vositalar", seeAll: "Barchasini ko'rish",
      items: [
        { title: "AI kontent", text: "Sarlavha, tavsif va xususiyatlar har bozor tilida bir zumda." },
        { title: "Aqlli narx", text: "Har bozor uchun raqobatbardosh narx oralig'i taklif qilinadi." },
        { title: "Avto joylash", text: "Hisobni ulang — e'lonlar to'rt bozorga avtomatik yuklanadi." },
      ],
    },
    testi: { eyebrow: "Mijozlar", titleA: "Sotuvchilar", titleHi: "MarketFlow", titleB: "ni shunday baholaydi" },
    cta: { title: "Bitta rasmni yuklang — to'rt bozorga tayyor e'lon oling", subtitle: "MarketFlow'ni bepul sinab ko'ring. Karta kerak emas, ro'yxatdan o'tish 30 soniya.", button: "Hoziroq boshlash" },
    footer: { tagline: "Bir mahsulot rasmidan — to'rt bozorga tayyor e'lon. AI savdo yordamchisi.", product: "Mahsulot", account: "Hisob", signup: "Ro'yxatdan o'tish", dash: "Boshqaruv paneli", rights: "Barcha huquqlar himoyalangan.", privacy: "Maxfiylik siyosati", terms: "Foydalanish shartlari" },
  },

  ru: {
    nav: { how: "Как работает", features: "Возможности", demo: "Демо", pricing: "Цены", login: "Войти", try: "Попробовать" },
    hero: {
      badge: "С AI-ассистентом",
      titleA: "Ваш товар теперь готов",
      titleHi: "на каждом",
      titleB: "маркетплейсе",
      subtitle:
        "Загрузите фото — MarketFlow подготовит отдельный заголовок, описание, цену и рекомендацию по кадру для Uzum Market, Ozon, Wildberries и Yandex Market. Вам остаётся только скопировать и разместить.",
      ctaTry: "Попробовать сейчас",
      ctaHow: "Как это работает",
      trust: "4 маркетплейса — из одного фото, за 30 секунд",
    },
    metrics: [
      { label: "Маркетплейса", note: "Uzum · Ozon · WB · Yandex" },
      { label: "Средний анализ", note: "на одно фото" },
      { label: "Экономия времени", note: "против ручного ввода" },
      { label: "Готовых объявлений", note: "и растёт" },
    ],
    flow: {
      eyebrow: "Процесс", titleA: "Одно фото —", titleHi: "за три шага", titleB: "на 4 маркетплейсах",
      subtitle: "От загрузки до публикации — весь процесс перед вами.",
      stepWord: "ШАГ", analysing: "AI анализирует…", published: "Опубликовано",
      steps: [
        { title: "Загрузите фото", desc: "Перетащите фото товара или выберите с телефона — больше ничего писать не нужно." },
        { title: "AI анализирует", desc: "Кадр, диапазон цены, заголовок и описание готовятся отдельно для каждого маркетплейса." },
        { title: "Копируйте или подключите", desc: "Скопируйте в один клик или подключите аккаунт для авто-размещения." },
      ],
    },
    features: {
      eyebrow: "Возможности", titleA: "AI-инструменты, ускоряющие", titleHi: "продажи", seeAll: "Смотреть все",
      items: [
        { title: "AI-контент", text: "Заголовок, описание и характеристики на языке каждого маркетплейса мгновенно." },
        { title: "Умная цена", text: "Для каждого маркетплейса предлагается конкурентный диапазон цены." },
        { title: "Авто-размещение", text: "Подключите аккаунт — объявления загрузятся на 4 маркетплейса автоматически." },
      ],
    },
    testi: { eyebrow: "Клиенты", titleA: "Продавцы оценивают", titleHi: "MarketFlow", titleB: " так" },
    cta: { title: "Загрузите одно фото — получите готовые объявления на 4 маркетплейса", subtitle: "Попробуйте MarketFlow бесплатно. Карта не нужна, регистрация — 30 секунд.", button: "Начать сейчас" },
    footer: { tagline: "Из одного фото товара — готовые объявления на 4 маркетплейса. AI-ассистент продаж.", product: "Продукт", account: "Аккаунт", signup: "Регистрация", dash: "Панель управления", rights: "Все права защищены.", privacy: "Политика конфиденциальности", terms: "Условия использования" },
  },

  en: {
    nav: { how: "How it works", features: "Features", demo: "Demo", pricing: "Pricing", login: "Log in", try: "Try it" },
    hero: {
      badge: "With AI assistant",
      titleA: "Your product is now ready on",
      titleHi: "every",
      titleB: "marketplace",
      subtitle:
        "Upload a photo — MarketFlow prepares a separate title, description, price and framing tip for Uzum Market, Ozon, Wildberries and Yandex Market. All you do is copy and post.",
      ctaTry: "Try it now",
      ctaHow: "How it works",
      trust: "4 marketplaces — from one photo, in 30 seconds",
    },
    metrics: [
      { label: "Marketplaces", note: "Uzum · Ozon · WB · Yandex" },
      { label: "Avg. analysis", note: "per photo" },
      { label: "Time saved", note: "vs. manual writing" },
      { label: "Listings created", note: "and growing" },
    ],
    flow: {
      eyebrow: "Process", titleA: "One photo —", titleHi: "in three steps", titleB: "on four marketplaces",
      subtitle: "From upload to publish — the whole flow in front of you.",
      stepWord: "STEP", analysing: "AI is analysing…", published: "Published",
      steps: [
        { title: "Upload a photo", desc: "Drop a product photo or pick from your phone — nothing else to write." },
        { title: "AI analyses", desc: "Framing, price range, title and description are prepared separately for each marketplace." },
        { title: "Copy or connect", desc: "Copy in one click, or connect your account to auto-publish listings." },
      ],
    },
    features: {
      eyebrow: "Features", titleA: "AI tools that speed up your", titleHi: "sales", seeAll: "See all",
      items: [
        { title: "AI content", text: "Title, description and specs in each marketplace's language, instantly." },
        { title: "Smart pricing", text: "A competitive price range is suggested for each marketplace." },
        { title: "Auto-publish", text: "Connect your account — listings upload to four marketplaces automatically." },
      ],
    },
    testi: { eyebrow: "Customers", titleA: "Sellers rate", titleHi: "MarketFlow", titleB: " like this" },
    cta: { title: "Upload one photo — get ready listings for four marketplaces", subtitle: "Try MarketFlow free. No card required, signup takes 30 seconds.", button: "Get started" },
    footer: { tagline: "From one product photo — ready listings on four marketplaces. Your AI sales assistant.", product: "Product", account: "Account", signup: "Sign up", dash: "Dashboard", rights: "All rights reserved.", privacy: "Privacy policy", terms: "Terms of use" },
  },
};
