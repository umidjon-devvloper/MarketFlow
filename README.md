# 🚀 MarketFlow — To'liq loyiha (v4.4)

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
- Uzum Business API kalitlar (shifrlangan)
- Ozon, WB, Yandex uchun ma'lumot eksport (JSON)
- Uzum'dan mahsulot ma'lumotini olish (skreping)

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

## 🔮 Kelajak

- [ ] **4.3** — Real deploy (Vercel + Neon)
- [ ] Email jo'natish (Resend)
- [ ] Uzum profile analytics
- [ ] Ozon/WB API integratsiyasi
- [ ] Barcode scanner (mobile)

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
