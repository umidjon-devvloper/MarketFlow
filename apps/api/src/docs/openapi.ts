/**
 * MarketFlow API — OpenAPI 3.0 spetsifikatsiyasi
 *
 * Swagger UI: GET /api/docs
 * Xom JSON:   GET /api/docs.json
 *
 * Yangi endpoint qo'shsangiz — mos `paths` bo'limini shu yerga qo'shing.
 */

const bearerAuth = [{ bearerAuth: [] as string[] }];
const orgHeader = {
  name: 'X-Organization-Id',
  in: 'header',
  required: false,
  schema: { type: 'string' },
  description:
    "Tashkilot ID'si. Berilmasa foydalanuvchining birinchi faol tashkiloti ishlatiladi.",
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MarketFlow API',
    version: '4.3',
    description:
      "Marketplace (Uzum, Wildberries, Ozon, Yandex) mahsulotlarini boshqarish, AI kontent generatsiyasi, analitika va ommaviy import uchun REST API.\n\n" +
      "**Autentifikatsiya:** `POST /api/auth/login` orqali `accessToken` oling va uni `Authorization: Bearer <token>` sarlavhasida yuboring.\n\n" +
      "**Tashkilot konteksti:** Ko'p endpointlar tashkilot (organization) talab qiladi. Kerakli tashkilotni `X-Organization-Id` sarlavhasi bilan tanlang.",
  },
  servers: [
    { url: 'http://localhost:4000', description: 'Lokal ishlab chiqish' },
    { url: '/', description: 'Joriy host' },
  ],
  tags: [
    { name: 'Auth', description: "Autentifikatsiya va foydalanuvchi" },
    { name: 'Organizations', description: "Tashkilotlar va a'zolar" },
    { name: 'Invitations', description: 'Takliflar' },
    { name: 'Products', description: 'Mahsulotlar' },
    { name: 'Listings', description: 'Marketplace listinglari' },
    { name: 'AI', description: 'Rasm va matn AI xizmatlari' },
    { name: 'Marketplaces', description: 'Marketplace integratsiyalari' },
    { name: 'Analytics', description: 'Analitika' },
    { name: 'Import', description: 'Ommaviy import (Excel)' },
    { name: 'Cards', description: "Marketplace kartochkalari: spetsifikatsiya, kategoriya, joylash, Excel" },
    { name: 'Orders', description: "Buyurtmalar — to'rttala marketplace bitta ro'yxatda" },
    { name: 'Sync', description: 'Marketplace sinxronizatsiyasi' },
    { name: 'Alerts', description: 'Qoldiq xabarnomalari' },
    { name: 'System', description: 'Tizim' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "Login javobidagi `accessToken`ni kiriting.",
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Ruxsat yo\'q' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 137 },
          totalPages: { type: 'integer', example: 7 },
        },
      },
      OrganizationRef: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          logo: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'STAFF'] },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          phone: { type: 'string', nullable: true },
          avatar: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          organizations: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrganizationRef' },
          },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6, example: 'parol123' },
          fullName: { type: 'string', minLength: 2, example: 'Ali Valiyev' },
          phone: { type: 'string', example: '+998901234567' },
          inviteToken: { type: 'string', description: 'Taklif orqali kelsa' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'seller@example.com' },
          password: { type: 'string', example: 'parol123' },
        },
      },
      ProductImage: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          isPrimary: { type: 'boolean' },
          order: { type: 'integer' },
          variant: { type: 'string', example: 'ORIGINAL' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          brand: { type: 'string', nullable: true },
          sku: { type: 'string', nullable: true },
          barcode: { type: 'string', nullable: true },
          basePrice: { type: 'number' },
          currency: { type: 'string', enum: ['UZS', 'RUB', 'USD'] },
          stock: { type: 'integer' },
          status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
          attributes: { type: 'object', additionalProperties: true },
          images: { type: 'array', items: { $ref: '#/components/schemas/ProductImage' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['title', 'description', 'category', 'basePrice'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10, maxLength: 5000 },
          category: { type: 'string' },
          brand: { type: 'string' },
          sku: { type: 'string' },
          barcode: { type: 'string' },
          basePrice: { type: 'number', minimum: 0, example: 149000 },
          currency: { type: 'string', enum: ['UZS', 'RUB', 'USD'], default: 'UZS' },
          stock: { type: 'integer', minimum: 0, default: 0 },
          attributes: { type: 'object', additionalProperties: true },
        },
      },
      AddImageInput: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
          fileKey: { type: 'string' },
          isPrimary: { type: 'boolean', default: false },
          order: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  },
  paths: {
    // ─── Kartochkalar (v4.3) ───────────────────────────────
    '/api/cards/specs': {
      get: {
        tags: ['Cards'],
        summary: "Marketplace ro'yxati va rasm talablari",
        security: bearerAuth,
        responses: { 200: { description: "Spetsifikatsiya qisqacha ma'lumoti" } },
      },
    },
    '/api/cards/specs/{marketplace}': {
      get: {
        tags: ['Cards'],
        summary: "Bitta marketplace'ning to'liq maydonlari",
        security: bearerAuth,
        parameters: [
          {
            name: 'marketplace',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['uzum', 'ozon', 'wb', 'yandex'] },
          },
        ],
        responses: { 200: { description: 'Maydonlar, guruhlar, rasm talablari' }, 404: { description: "Marketplace yo'q" } },
      },
    },
    '/api/cards/categories/{marketplace}': {
      get: {
        tags: ['Cards'],
        summary: 'Kategoriya katalogidan qidirish',
        description:
          "Ozon, WB va Yandex kartochka yaratishda raqamli kategoriya ID talab qiladi. " +
          "Ro'yxat marketplace katalogidan olinadi, ya'ni ulanish faol bo'lishi shart. " +
          "Uzum'da kategoriyani Excel shablonidagi makros to'ldiradi — bu yerda katalog yo'q.",
        security: bearerAuth,
        parameters: [
          {
            name: 'marketplace',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['ozon', 'wb', 'yandex'] },
          },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Qidiruv matni' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } },
          orgHeader,
        ],
        responses: {
          200: { description: "id, name, path va (Ozon uchun) typeId bo'lgan ro'yxat" },
          400: { description: "Marketplace ulanmagan yoki Uzum so'ralgan" },
          502: { description: 'Marketplace katalogini ochib bo\'lmadi' },
        },
      },
    },
    '/api/cards/{productId}/publish/{marketplace}': {
      post: {
        tags: ['Cards'],
        summary: "Kartochkani API orqali joylash",
        description:
          "Uzum qo'llab-quvvatlamaydi (Seller API'da kartochka yaratish yo'q). " +
          "Ozon va WB asinxron ishlaydi — javobdagi `pending: true` bo'lsa natijani " +
          '`GET /api/cards/{productId}/publish-status/{marketplace}` bilan tekshiring.',
        security: bearerAuth,
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'marketplace',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['ozon', 'wb', 'yandex'] },
          },
          orgHeader,
        ],
        responses: {
          200: { description: 'Yuborildi (pending bo\'lishi mumkin)' },
          400: { description: "To'ldirilmagan maydon yoki ulanish yo'q" },
          502: { description: 'Marketplace rad etdi' },
        },
      },
    },
    '/api/cards/{productId}/publish-status/{marketplace}': {
      get: {
        tags: ['Cards'],
        summary: 'Joylash natijasini tekshirish',
        description:
          "Ozon uchun import vazifasi holatini, WB uchun kartochkani topib rasmlarni biriktiradi.",
        security: bearerAuth,
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'marketplace', in: 'path', required: true, schema: { type: 'string' } },
          orgHeader,
        ],
        responses: {
          200: { description: 'Natija yoki hali kutilmoqda' },
          400: { description: "Kartochka yuborilmagan yoki ulanish yo'q" },
        },
      },
    },
    '/api/cards/export': {
      post: {
        tags: ['Cards'],
        summary: 'Marketplace formatida Excel',
        description:
          "Uzum uchun rasmiy .xlsm shabloni to'ldiriladi (makros va validatsiya saqlanadi), " +
          "qolganlari uchun .xlsx yaratiladi. Ogohlantirishlar `X-Export-Warnings` sarlavhasida qaytadi.",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: {
          200: { description: 'Excel fayl' },
          400: { description: "Shablon sig'imidan oshdi" },
        },
      },
    },

    '/api/cards/quality': {
      post: {
        tags: ['Cards'],
        summary: 'Kartochka sifat bahosi (0–100)',
        description:
          "Marketplace'lar kartochkani to'ldirilganligi bo'yicha baholaydi (WB " +
          "\"рейтинг заполненности\", Ozon \"контент-рейтинг\") va bu qidiruvdagi " +
          "o'ringa ta'sir qiladi. Baho rasm soni, nom, tavsif, majburiy va qo'shimcha " +
          "xususiyatlar bo'yicha hisoblanadi. Jonli — bazaga tegmaydi, sehrgar saqlashdan " +
          "oldin ko'rsatadi. Yashirin maydonlar (kategoriya ID) bahoga kirmaydi.",
        security: bearerAuth,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  marketplace: { type: 'string', enum: ['uzum', 'ozon', 'wb', 'yandex'] },
                  values: { type: 'object' },
                  imageCount: { type: 'integer', minimum: 0 },
                },
                required: ['marketplace'],
              },
            },
          },
        },
        responses: { 200: { description: 'score, grade, factors, topSuggestion' } },
      },
    },
    '/api/cards/sync-price-stock': {
      post: {
        tags: ['Cards'],
        summary: "Narx va qoldiqni marketplace'ga yuborish",
        description:
          "Ma'lumot teskari yo'nalishda: MarketFlow → marketplace.\n\n" +
          "**Valyuta xavfsizligi:** narx FAQAT o'sha marketplace uchun kiritilgan " +
          "qiymatdan olinadi. Boshqa valyutadagi qiymatga tushish ATAYIN qilinmagan — " +
          "234 000 so'm Ozon'da 234 000 rubl bo'lib qolardi. Narx topilmasa u " +
          "yuborilmaydi, lekin qoldiq baribir ketadi (qoldiq valyutaga bog'liq emas).\n\n" +
          "**`dryRun: true`** — nima yuborilishini qaytaradi, marketplace'ga tegmaydi. " +
          "Narx qaytarib bo'lmaydigan o'zgarish bo'lgani uchun UI shu rejimni oldindan chaqiradi.\n\n" +
          "Uzum ham qo'llab-quvvatlanadi (kartochka yaratishdan farqli).",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: {
          200: { description: 'pricesUpdated, stocksUpdated, failed, skipped, warnings' },
          400: { description: "Marketplace ulanmagan yoki yuboriladigan tovar yo'q" },
          502: { description: 'Marketplace rad etdi' },
        },
      },
    },
    '/api/cards/bulk-category': {
      post: {
        tags: ['Cards'],
        summary: "Bir nechta kartochkaga bitta kategoriyani birdan qo'yish",
        description:
          "Faqat `categoryId` yozilmaydi: kartochka boshqa marketplace uchun to'ldirilgan " +
          "bo'lsa, qolgan maydonlar ham ko'chiriladi (birliklar o'girilib, ro'yxatdan " +
          "tanlanadiganlari moslashtirilib). Aks holda kategoriya qo'yish holatni " +
          "yaxshilash o'rniga buzardi — joylash paytidagi zaxira qiymatlarga tushish " +
          "mantig'i ishlamay qolardi.\n\n" +
          "Javobda `ready` (joylashga tayyor bo'lganlar) va `stillMissing` " +
          "(boshqa maydonlari yetishmayotganlar) qaytadi.",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: {
          200: { description: 'updated, ready, stillMissing' },
          400: { description: "Kategoriya tanlanmagan yoki Ozon uchun tovar turi yo'q" },
        },
      },
    },
    '/api/cards/publish-batch': {
      post: {
        tags: ['Cards'],
        summary: "Kartochkalarni joylash navbatiga qo'shish",
        description:
          "Darhol yubormaydi — cron vazifalarni ketma-ket olib boradi, chunki marketplace " +
          "limitlari sotuvchi bo'yicha hisoblanadi. Kategoriya tanlanmagan yoki majburiy " +
          "maydoni bo'sh mahsulotlar navbatga qo'shilmaydi va `skipped` da sabab bilan qaytadi.",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: {
          202: { description: "Navbatga qo'shildi" },
          400: { description: "Hech bir mahsulot o'tmadi yoki marketplace ulanmagan" },
        },
      },
    },
    '/api/cards/publish-jobs': {
      get: {
        tags: ['Cards'],
        summary: 'Navbat holati',
        description: "Vazifalar ro'yxati va holatlar bo'yicha sanoq. `active: true` bo'lsa ish davom etyapti.",
        security: bearerAuth,
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['QUEUED', 'RUNNING', 'PENDING', 'DONE', 'FAILED', 'CANCELLED'] },
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          orgHeader,
        ],
        responses: { 200: { description: 'items, counts, active' } },
      },
    },
    '/api/cards/publish-jobs/cancel': {
      post: {
        tags: ['Cards'],
        summary: 'Boshlanmagan vazifalarni bekor qilish',
        description:
          "Faqat QUEUED va PENDING vazifalar bekor qilinadi. Marketplace'ga allaqachon " +
          "yuborilganini to'xtatib bo'lmaydi.",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Bekor qilinganlar soni' } },
      },
    },

    // ─── Buyurtmalar ───────────────────────────────────────
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: "To'rttala marketplace buyurtmalari bitta ro'yxatda",
        description:
          "Ma'lumot keshdan o'qiladi (cron har 3 soatda to'ldiradi), jonli so'rov " +
          "yuborilmaydi. Sabab: WB statistikasi daqiqasiga 1 ta so'rovga ruxsat beradi. " +
          "Keshdan o'qishning yon foydasi — to'rt bozorni sana bo'yicha birga saralash, " +
          "bu jonli so'rovlarda umuman imkonsiz.",
        security: bearerAuth,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } },
          {
            name: 'marketplace',
            in: 'query',
            schema: { type: 'string', enum: ['uzum', 'ozon', 'wb', 'yandex'] },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string' },
            description: "Marketplace o'z atamasi bilan (NEW, Собран, CANCELED…)",
          },
          { name: 'days', in: 'query', schema: { type: 'integer', maximum: 180 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Buyurtma raqami yoki tovar nomi' },
          orgHeader,
        ],
        responses: { 200: { description: 'items, syncedAt, pagination' } },
      },
    },
    '/api/orders/summary': {
      get: {
        tags: ['Orders'],
        summary: "Marketplace bo'yicha kesim va mavjud holatlar",
        description:
          "Holatlar ro'yxati qattiq yozilmagan — har bir marketplace o'z atamalarini " +
          "ishlatadi, shuning uchun mavjud qiymatlar keshdan yig'iladi. Javobda oxirgi " +
          "sinxronizatsiya holati ham bor: ro'yxat to'liq emasligini shundan bilinadi.",
        security: bearerAuth,
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30, maximum: 180 } },
          orgHeader,
        ],
        responses: { 200: { description: 'marketplaces, statuses' } },
      },
    },
    '/api/orders/{id}/actions': {
      get: {
        tags: ['Orders'],
        summary: 'Bu buyurtma bilan nima qilish mumkin',
        description:
          "UI tugmalarni shu javobga qarab chizadi. Imkoniyatlar bozorga qarab farq qiladi:\n\n" +
          "| | Tasdiqlash | Bekor qilish |\n|---|---|---|\n" +
          "| Uzum | ✅ | ✅ sababsiz |\n" +
          "| Yandex | ✅ | ✅ sabab majburiy |\n" +
          "| Ozon | ❌ FBS oqimida bunday qadam yo'q | ✅ sabab ID kerak |\n" +
          "| WB | ❌ | ❌ |\n\n" +
          "**WB nega yopiq:** keshdagi ID statistika API'sidan olingan `srid`, bekor qilish esa " +
          "FBS yig'ish buyurtmasining boshqa identifikatorini talab qiladi. Taxminan " +
          "moslashtirish — boshqa buyurtmani bekor qilish xavfi.\n\n" +
          "Ozon uchun bekor qilish sabablari API'dan so'raladi (ular jo'natmaga qarab farq qiladi).",
        security: bearerAuth,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          orgHeader,
        ],
        responses: { 200: { description: 'canConfirm, canCancel, cancelNeedsReason, reasons, notes' } },
      },
    },
    '/api/orders/{id}/confirm': {
      post: {
        tags: ['Orders'],
        summary: 'Buyurtmani tasdiqlash',
        description:
          "HAQIQIY mijoz buyurtmasiga ta'sir qiladi. Faqat OWNER va ADMIN. " +
          "Qo'llab-quvvatlanmagan marketplace'da so'rov marketplace'ga UMUMAN yuborilmaydi.",
        security: bearerAuth,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          orgHeader,
        ],
        responses: {
          200: { description: 'Tasdiqlandi' },
          400: { description: "Marketplace qo'llab-quvvatlamaydi yoki ulanmagan" },
          403: { description: 'Ruxsat yetarli emas' },
        },
      },
    },
    '/api/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Buyurtmani bekor qilish',
        description:
          "QAYTARIB BO'LMAYDI va sotuvchi reytingiga yoziladi. Faqat OWNER va ADMIN.\n\n" +
          "`reasonId` — Yandex uchun substatus (SHOP_FAILED, USER_CHANGED_MIND…), " +
          "Ozon uchun raqamli `cancel_reason_id`. Ikkalasida ham majburiy. " +
          "Sabab statistikaga yoziladi: \"do'kon aybi\" va \"xaridor fikridan qaytdi\" " +
          'reytingga har xil ta\'sir qiladi.',
        security: bearerAuth,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          orgHeader,
        ],
        responses: {
          200: { description: 'Bekor qilindi' },
          400: { description: "Sabab yo'q yoki marketplace qo'llab-quvvatlamaydi" },
          403: { description: 'Ruxsat yetarli emas' },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Bitta buyurtma, pozitsiyalari bilan',
        security: bearerAuth,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          orgHeader,
        ],
        responses: { 200: { description: 'Buyurtma' }, 404: { description: 'Topilmadi' } },
      },
    },

    // ─── Sinxronizatsiya ───────────────────────────────────
    '/api/sync/run': {
      post: {
        tags: ['Sync'],
        summary: "Tashkilotning barcha ulanishlarini hozir sinxronlash",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Har bir marketplace bo\'yicha natija' } },
      },
    },
    '/api/sync/status': {
      get: {
        tags: ['Sync'],
        summary: "Oxirgi sinxronizatsiya holati",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: "Marketplace bo'yicha oxirgi urinishlar" } },
      },
    },
    '/api/sync/trend': {
      get: {
        tags: ['Sync'],
        summary: "Kunlik kesimlar tarixi",
        description: "MarketplaceSnapshot jadvalidan — buyurtma, daromad va qoldiq dinamikasi.",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Kunlik qatorlar' } },
      },
    },

    // ─── Qoldiq xabarnomalari ──────────────────────────────
    '/api/alerts/settings': {
      get: {
        tags: ['Alerts'],
        summary: 'Qoldiq xabarnomasi sozlamalari',
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Chegara, qabul qiluvchilar, pochta holati' } },
      },
      patch: {
        tags: ['Alerts'],
        summary: 'Sozlamalarni yangilash',
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Yangilandi' } },
      },
    },
    '/api/alerts/test': {
      post: {
        tags: ['Alerts'],
        summary: 'Sinov xati yuborish',
        description: "Gmail sozlamalari to'g'riligini tekshirish uchun.",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Yuborildi' }, 400: { description: 'Pochta sozlanmagan' } },
      },
    },
    '/api/alerts/run': {
      post: {
        tags: ['Alerts'],
        summary: 'Qoldiq tekshiruvini hozir ishga tushirish',
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'Tekshiruv natijasi' } },
      },
    },

    '/health': {
      get: {
        tags: ['System'],
        summary: 'Servis holati',
        security: [],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'marketflow-api' },
                    version: { type: 'string', example: '4.2' },
                    time: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ---------- Auth ----------
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: "Ro'yxatdan o'tish",
        description: "Yangi foydalanuvchi yaratadi. Taklif token bo'lmasa avtomatik tashkilot yaratiladi.",
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } },
        },
        responses: {
          201: { description: 'Yaratildi', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validatsiya xatosi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Email band', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Tizimga kirish',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Email yoki parol xato', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Access tokenni yangilash',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } },
          },
          401: { description: 'Refresh token yaroqsiz', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Joriy foydalanuvchi',
        security: bearerAuth,
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    organizations: { type: 'array', items: { $ref: '#/components/schemas/OrganizationRef' } },
                  },
                },
              },
            },
          },
          401: { description: 'Avtorizatsiya yo\'q', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ---------- Products ----------
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: "Mahsulotlar ro'yxati",
        security: bearerAuth,
        parameters: [
          orgHeader,
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Sarlavha, SKU yoki brend bo\'yicha' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
          401: { description: 'Avtorizatsiya yo\'q', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Mahsulot yaratish',
        security: bearerAuth,
        parameters: [orgHeader],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } },
        },
        responses: {
          201: { description: 'Yaratildi', content: { 'application/json': { schema: { type: 'object', properties: { product: { $ref: '#/components/schemas/Product' } } } } } },
          400: { description: 'Validatsiya xatosi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Bitta mahsulot',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { product: { $ref: '#/components/schemas/Product' } } } } } },
          404: { description: 'Topilmadi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Mahsulotni yangilash',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { product: { $ref: '#/components/schemas/Product' } } } } } },
          404: { description: 'Topilmadi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        tags: ['Products'],
        summary: "Mahsulotni o'chirish (ADMIN/OWNER)",
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: "O'chirildi" },
          403: { description: 'Ruxsat yo\'q', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Topilmadi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/products/{id}/images': {
      post: {
        tags: ['Products'],
        summary: "Mahsulotga rasm qo'shish",
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddImageInput' } } },
        },
        responses: {
          201: { description: 'Yaratildi', content: { 'application/json': { schema: { type: 'object', properties: { image: { $ref: '#/components/schemas/ProductImage' } } } } } },
          404: { description: 'Topilmadi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/products/{id}/images/{imageId}': {
      delete: {
        tags: ['Products'],
        summary: "Rasmni o'chirish (ADMIN/OWNER)",
        security: bearerAuth,
        parameters: [
          orgHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'imageId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { description: "O'chirildi" },
          404: { description: 'Topilmadi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ---------- Listings ----------
    '/api/listings/product/{productId}': {
      get: {
        tags: ['Listings'],
        summary: "Mahsulot listinglari",
        security: bearerAuth,
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 401: { description: 'Avtorizatsiya yo\'q' } },
      },
    },
    '/api/listings/{id}': {
      patch: {
        tags: ['Listings'],
        summary: 'Listingni yangilash',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' }, 404: { description: 'Topilmadi' } },
      },
      delete: {
        tags: ['Listings'],
        summary: "Listingni o'chirish",
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: "O'chirildi" }, 404: { description: 'Topilmadi' } },
      },
    },
    '/api/listings/{id}/export': {
      get: {
        tags: ['Listings'],
        summary: 'Listingni eksport qilish',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Topilmadi' } },
      },
    },
    '/api/listings/scrape/uzum': {
      post: {
        tags: ['Listings'],
        summary: "Uzum'dan ma'lumot yig'ish (scrape)",
        security: bearerAuth,
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { url: { type: 'string', format: 'uri' } } },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Xato' } },
      },
    },

    // ---------- AI ----------
    '/api/ai/remove-background': {
      post: {
        tags: ['AI'],
        summary: 'Rasm fonini olib tashlash',
        security: bearerAuth,
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { imageUrl: { type: 'string', format: 'uri' } } } } },
        },
        responses: { 200: { description: 'Job yaratildi' }, 401: { description: 'Avtorizatsiya yo\'q' } },
      },
    },
    '/api/ai/upscale': {
      post: {
        tags: ['AI'],
        summary: 'Rasmni yaxshilash (upscale)',
        security: bearerAuth,
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { imageUrl: { type: 'string', format: 'uri' } } } } },
        },
        responses: { 200: { description: 'Job yaratildi' }, 401: { description: 'Avtorizatsiya yo\'q' } },
      },
    },
    '/api/ai/jobs/{id}': {
      get: {
        tags: ['AI'],
        summary: 'AI job holati',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Topilmadi' } },
      },
    },
    '/api/ai/generate-listings': {
      post: {
        tags: ['AI'],
        summary: 'AI orqali listing matnini generatsiya qilish',
        security: bearerAuth,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  marketplaces: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 401: { description: 'Avtorizatsiya yo\'q' } },
      },
    },

    // ---------- Marketplaces ----------
    '/api/marketplaces': {
      get: {
        tags: ['Marketplaces'],
        summary: "Ulangan marketplace'lar ro'yxati",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'OK' }, 401: { description: 'Avtorizatsiya yo\'q' } },
      },
      post: {
        tags: ['Marketplaces'],
        summary: "Marketplace API kalitlarini saqlash (ADMIN/OWNER)",
        security: bearerAuth,
        parameters: [orgHeader],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  marketplace: { type: 'string', enum: ['UZUM', 'WILDBERRIES', 'OZON', 'YANDEX'] },
                  apiKey: { type: 'string' },
                  apiSecret: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Saqlandi' }, 403: { description: 'Ruxsat yo\'q' } },
      },
    },
    '/api/marketplaces/{id}': {
      delete: {
        tags: ['Marketplaces'],
        summary: "Kalitlarni o'chirish (ADMIN/OWNER)",
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: "O'chirildi" }, 403: { description: 'Ruxsat yo\'q' } },
      },
    },
    '/api/marketplaces/{id}/test': {
      post: {
        tags: ['Marketplaces'],
        summary: 'Ulanishni tekshirish',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/products': {
      get: {
        tags: ['Marketplaces'],
        summary: "Marketplace mahsulotlari",
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/orders': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Marketplace buyurtmalari',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/stocks': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Marketplace qoldiqlari',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/summary': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Marketplace umumiy ko\'rsatkichlari',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/shops': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: do\'konlar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/products': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: mahsulotlar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/orders': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: buyurtmalar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/finance/orders': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: moliyaviy buyurtmalar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/finance/expenses': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: xarajatlar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/stocks': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: qoldiqlar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/marketplaces/{id}/uzum/invoices': {
      get: {
        tags: ['Marketplaces'],
        summary: 'Uzum: hisob-fakturalar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },

    // ---------- Analytics ----------
    '/api/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Umumiy ko\'rsatkichlar',
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'OK' }, 401: { description: 'Avtorizatsiya yo\'q' } },
      },
    },
    '/api/analytics/timeseries': {
      get: {
        tags: ['Analytics'],
        summary: 'Vaqt bo\'yicha grafik',
        security: bearerAuth,
        parameters: [
          orgHeader,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/analytics/top-products': {
      get: {
        tags: ['Analytics'],
        summary: 'Eng ko\'p sotilgan mahsulotlar',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
        responses: { 200: { description: 'OK' } },
      },
    },

    // ---------- Organizations ----------
    '/api/orgs': {
      get: {
        tags: ['Organizations'],
        summary: "Mening tashkilotlarim",
        security: bearerAuth,
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Tashkilot yaratish',
        security: bearerAuth,
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Yaratildi' } },
      },
    },
    '/api/orgs/current': {
      get: {
        tags: ['Organizations'],
        summary: 'Joriy tashkilot',
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'OK' } },
      },
      patch: {
        tags: ['Organizations'],
        summary: 'Tashkilotni yangilash (OWNER)',
        security: bearerAuth,
        parameters: [orgHeader],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' }, 403: { description: 'Ruxsat yo\'q' } },
      },
    },
    '/api/orgs/current/members': {
      get: {
        tags: ['Organizations'],
        summary: "A'zolar ro'yxati",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/orgs/current/members/{id}': {
      patch: {
        tags: ['Organizations'],
        summary: "A'zo rolini yangilash (ADMIN/OWNER)",
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string', enum: ['OWNER', 'ADMIN', 'STAFF'] } } } } } },
        responses: { 200: { description: 'OK' } },
      },
      delete: {
        tags: ['Organizations'],
        summary: "A'zoni chiqarish (OWNER)",
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Chiqarildi' } },
      },
    },
    '/api/orgs/current/invitations': {
      get: {
        tags: ['Organizations'],
        summary: "Takliflar ro'yxati (ADMIN/OWNER)",
        security: bearerAuth,
        parameters: [orgHeader],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Taklif yaratish (ADMIN/OWNER)',
        security: bearerAuth,
        parameters: [orgHeader],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['ADMIN', 'STAFF'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Yaratildi' } },
      },
    },
    '/api/orgs/current/invitations/{id}': {
      delete: {
        tags: ['Organizations'],
        summary: 'Taklifni bekor qilish (ADMIN/OWNER)',
        security: bearerAuth,
        parameters: [orgHeader, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Bekor qilindi' } },
      },
    },

    // ---------- Invitations (public) ----------
    '/api/invitations/{token}': {
      get: {
        tags: ['Invitations'],
        summary: "Taklif ma'lumoti (public)",
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Topilmadi' } },
      },
    },
    '/api/invitations/{token}/accept': {
      post: {
        tags: ['Invitations'],
        summary: 'Taklifni qabul qilish',
        security: bearerAuth,
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Yaroqsiz taklif' } },
      },
    },

    // ---------- Import ----------
    '/api/import/template': {
      get: {
        tags: ['Import'],
        summary: 'Excel shablonini yuklab olish',
        security: bearerAuth,
        parameters: [orgHeader],
        responses: {
          200: {
            description: 'XLSX fayl',
            content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
    '/api/import/preview': {
      post: {
        tags: ['Import'],
        summary: 'Import faylini oldindan tekshirish',
        security: bearerAuth,
        parameters: [orgHeader],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Validatsiya natijasi' }, 400: { description: 'Xato fayl' } },
      },
    },
    '/api/import/execute': {
      post: {
        tags: ['Import'],
        summary: 'Importni bajarish',
        security: bearerAuth,
        parameters: [orgHeader],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Import natijasi' } },
      },
    },
  },
};

export default openapiSpec;
