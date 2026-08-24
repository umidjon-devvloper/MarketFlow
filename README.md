# 🚀 MarketFlow — To'liq loyiha (v5.0)

**Uzum, Ozon, Wildberries, Yandex Market uchun yagona mahsulot boshqaruv platformasi.**

## 📦 Tarkib

Bu monorepo — 3 ilova + 1 shared package:


```
marketflow/
├── apps/
│   ├── api/         # Backend: Express + Prisma + PostgreSQL
│   ├── web/         # Frontend: Next.js 14 + Tailwind
│   └── mobile/      # Mobile: React Native + Expo SDK 51
└── packages/
    └── shared/      # Umumiy tiplar
```

## ✨ Xususiyatlar

### 🏢 Multi-user + Organization
- Har foydalanuvchi bir nechta tashkilotga a'zo bo'lishi mumkin
- 3 rol: **OWNER**, **ADMIN**, **STAFF**
- Email orqali xodim taklif qilish (7 kunlik link)

### 📦 Mahsulot boshqaruvi
- Universal kartochka yaratish
- 4 marketplace uchun optimallashtirilgan matn
- UploadThing bilan rasm xosting
- Bulk import (Excel/CSV, 1000 tagacha)

### 🤖 AI integratsiyalari
- **OpenAI GPT-4o mini** — matn generatsiya
- **Google Gemini** — fallback
- **Higgsfield** — rasm AI (fon o'chirish, upscale)

### 🏪 Marketplace ulash
- Barcha kalitlar AES-256-GCM bilan shifrlangan holda saqlanadi
- **Kategoriya katalogi** — Ozon, WB va Yandex katalogidan qidirib tanlash
  (kartochka yaratish uchun raqamli ID majburiy, uni faqat shu yerdan olish mumkin)
- **To'g'ridan-to'g'ri joylash:**

  | Marketplace | Usul | Endpoint |
  |---|---|---|
  | Uzum | Excel (.xlsm) | API'da kartochka yaratish yo'q |
  | Ozon | API | `POST /v3/product/import` |
  | Wildberries | API | `POST /content/v2/cards/upload` + `content/v3/media/save` |
  | Yandex | API | `POST /v2/businesses/{id}/offer-mappings/update` |

- **Ommaviy joylash** — mahsulotlarni tanlab navbatga qo'yasiz, server ketma-ket
  yuboradi (limitlar sotuvchi bo'yicha hisoblanadi). Sahifani yopsangiz ham davom etadi
- Ozon va WB asinxron ishlaydi — natija avtomatik tekshiriladi va holat ko'rsatiladi
- **Narx va qoldiqni orqaga yuborish** — MarketFlow'da o'zgartirasiz, to'rttala
  platformaga ketadi. Valyuta qat'iy tekshiriladi: UZS narx RUB bozoriga yuborilmaydi
- Qoldiq/buyurtma sinxronizatsiyasi (cron, har 3 soatda)
- Kam qolgan mahsulot haqida email xabarnoma

### 🧾 Buyurtmalar
- To'rttala marketplace buyurtmasi **bitta ro'yxatda**, sana bo'yicha saralangan
- Marketplace, holat, davr va matn bo'yicha filtr
- Pozitsiyalari bilan (tovar, artikul, soni, narx)
- Keshdan o'qiladi — sahifa darhol ochiladi. Jonli so'rov mumkin emas:
  WB statistikasi daqiqasiga 1 ta so'rovga ruxsat beradi
- **Tasdiqlash va bekor qilish** (OWNER/ADMIN):

  | | Tasdiqlash | Bekor qilish |
  |---|---|---|
  | Uzum | ✅ | ✅ sababsiz |
  | Yandex | ✅ | ✅ sabab majburiy |
  | Ozon | ❌ FBS oqimida bunday qadam yo'q | ✅ sabab ID kerak |
  | WB | ❌ | ❌ ID mos kelmaydi |

  Tugmalar server javobiga qarab chiziladi — imkoniyat yo'q joyda tugma
  ko'rsatilmaydi va sababi aytiladi

### ⭐ Kartochka sifat bahosi
- Har kartochkaga 0–100 ball: rasm soni, nom, tavsif, majburiy va qo'shimcha
  xususiyatlar bo'yicha (marketplace'lar ham xuddi shunga qarab reyting beradi)
- Ro'yxatda halqa ko'rsatkichi, sehrgarda omillar taqsimoti va maslahatlar
- Jonli hisoblanadi — saqlashdan oldin ko'rinadi

### 📊 Analytics
- Recharts bilan grafiklar
- Marketplace bo'yicha statistika
- Top mahsulotlar, timeseries

### 📱 Mobile ilova (Expo)
- iOS + Android
- Kameradan rasm olish → AI fon o'chirish
- Push notifications
- Auth + SecureStore

## 🛠 Tez o'rnatish

### 1. Prerequisites
- Node.js 18+
- PostgreSQL (yoki Neon.tech bepul)

### 2. Install
```bash
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
cd apps/mobile && npm install && cd ../..
```

### 3. `.env` fayllari

**`apps/api/.env`:**
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
PORT=4000
JWT_SECRET="min-32-belgi-secret"
JWT_REFRESH_SECRET="boshqa-32-belgi-secret"
CORS_ORIGIN="http://localhost:3000"
ENCRYPTION_KEY="32-byte-key-here-must-be-exactly-32"

UPLOADTHING_TOKEN=""
UPLOADTHING_SECRET=""

OPENAI_API_KEY="sk-proj-..."
GEMINI_API_KEY="AIza..."
HIGGSFIELD_API_KEY="hf_..."
HIGGSFIELD_API_URL="https://api.higgsfield.ai/v1"

WEB_URL="http://localhost:3000"
```

**`apps/web/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
UPLOADTHING_TOKEN=<backend bilan bir xil>
```

**`apps/mobile/.env.local`:**
```env
EXPO_PUBLIC_API_URL=http://192.168.1.XX:4000/api
```
⚠️ Mobile uchun **LAN IP** kerak, `localhost` ishlamaydi!

### 4. Baza
```bash
cd apps/api
npx prisma db push
npx prisma generate
```

### 5. Ishga tushirish
3 terminal:
```bash
cd apps/api && npm run dev       # :4000
cd apps/web && npm run dev       # :3000
cd apps/mobile && npm start      # Expo QR
```

## 📚 Har bosqich hujjati

- `BOSQICH-2-README.md` — Product CRUD + UploadThing
- `BOSQICH-3-README.md` — AI (OpenAI + Gemini + Higgsfield)
- `BOSQICH-4.1-README.md` — Multi-user + Organization
- `BOSQICH-4.2-README.md` — Bulk import Excel/CSV
- `apps/mobile/README.md` — Mobile (4.4)

## 🌐 Asosiy API endpointlari

### Auth
- `POST /api/auth/register` (auto org yaratadi)
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Organizations
- `GET/POST /api/orgs`
- `GET /api/orgs/current`
- `GET /api/orgs/current/members`
- `POST /api/orgs/current/invitations` (ADMIN+)

### Products
- `GET/POST /api/products`
- `GET/PATCH /api/products/:id`
- `DELETE /api/products/:id` (ADMIN+)
- `POST /api/products/:id/images`

### AI
- `POST /api/ai/remove-background`
- `POST /api/ai/upscale`
- `POST /api/ai/generate-listings` (4 marketplace)
- `GET /api/ai/jobs/:id`

### Import
- `GET /api/import/template?examples=true`
- `POST /api/import/preview` (multipart)
- `POST /api/import/execute`

### Kartochkalar (v4.3+)
- `GET /api/cards/specs` — marketplace ro'yxati va rasm talablari
- `GET /api/cards/specs/:marketplace` — to'liq maydonlar
- `GET /api/cards/categories/:marketplace?q=` — kategoriya katalogidan qidirish
- `POST /api/cards/:productId/publish/:marketplace` — API orqali joylash
- `GET /api/cards/:productId/publish-status/:marketplace` — natijani tekshirish
- `POST /api/cards/quality` — kartochka sifat bahosi (jonli)
- `POST /api/cards/sync-price-stock` — narx/qoldiqni yuborish (`dryRun` bilan oldindan ko'rish)
- `POST /api/cards/bulk-category` — bir nechta kartochkaga bitta kategoriya
- `POST /api/cards/publish-batch` — ommaviy joylash navbatiga qo'shish
- `GET /api/cards/publish-jobs` — navbat holati
- `POST /api/cards/publish-jobs/cancel` — boshlanmaganlarini bekor qilish
- `POST /api/cards/export` — marketplace formatida Excel

### Buyurtmalar
- `GET /api/orders?marketplace=&status=&days=&search=` — yagona ro'yxat
- `GET /api/orders/summary?days=30` — marketplace kesimi va mavjud holatlar
- `GET /api/orders/:id` — bitta buyurtma
- `GET /api/orders/:id/actions` — imkoniyatlar va bekor qilish sabablari
- `POST /api/orders/:id/confirm` · `POST /api/orders/:id/cancel` (OWNER/ADMIN)

### Sinxronizatsiya va xabarnomalar
- `GET /api/sync/status` · `POST /api/sync/run` · `GET /api/sync/trend`
- `GET/PATCH /api/alerts/settings` · `POST /api/alerts/test`

To'liq hujjat: **`GET /api/docs`** (Swagger UI)

### Analytics
- `GET /api/analytics/overview`
- `GET /api/analytics/timeseries?days=30`
- `GET /api/analytics/top-products`

## 💰 AI xarajatlar (taxminiy)

| Servis | Narx |
|--------|------|
| OpenAI GPT-4o mini | ~$0.001/kartochka |
| Gemini 1.5 Flash | Bepul (1500/kun) |
| Higgsfield | 25 credit bepul |
| UploadThing | 2GB bepul |
| Neon | 512MB bepul |
| Vercel | 100GB traffic bepul |

**Xulosa:** kichik hajmda **bepul ishlashi mumkin**.

## 🔒 Xavfsizlik

- JWT + Refresh (15min + 7 kun)
- API kalitlar AES-256-GCM shifrlash
- Rate limit (200/15min)
- Helmet + CORS
- Rol asosidagi ruxsatlar (OWNER/ADMIN/STAFF)

## 🎯 Bajarilgan bosqichlar

- [x] **1** — Monorepo + Prisma + Auth
- [x] **2** — Product CRUD + UploadThing
- [x] **3** — AI (OpenAI + Gemini + Higgsfield)
- [x] **4.1** — Multi-user + Organization + Team
- [x] **4.2** — Bulk import (Excel/CSV)
- [x] **4.4** — Mobile ilova (Expo)
- [x] **4.5** — Marketplace kartochkalari: kategoriya katalogi, to'g'ridan-to'g'ri
      joylash (Ozon/WB/Yandex), Uzum .xlsm shabloni, qoldiq sinxronizatsiyasi
- [x] **4.6** — Ommaviy joylash navbati, rasm optimizatsiyasi (next/image),
      umumiy dizayn token'lari (`packages/shared`)
- [x] **4.7** — Narx va qoldiqni orqaga yuborish, ommaviy kategoriya tanlash
- [x] **4.8** — Buyurtmalar bo'limi (4 bozor bitta ro'yxatda, keshdan)
- [x] **4.9** — Buyurtmani tasdiqlash va bekor qilish
- [x] **5.0** — Kartochka sifat bahosi (0–100)

## 🔮 Kelajak

- [ ] Barcode scanner (mobile)
- [ ] Real deploy (Vercel + Neon)

## 🚢 Deploy

### Vercel (Web + API)
```bash
npm i -g vercel
cd apps/web && vercel
cd apps/api && vercel
```

Environment variables Vercel Dashboard'ga qo'shing.

### Mobile
```bash
cd apps/mobile
npx eas login
npx eas build:configure
npx eas build --platform android --profile preview
npx eas build --platform ios
```

## 📄 Litsenziya
Private — MarketFlow

## 🤝 Yordam
- Har bosqich uchun README fayllar
- Contact: support@marketflow.uz
