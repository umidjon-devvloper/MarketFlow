# 🚀 MarketFlow — 3-bosqich

Bu bosqichda quyidagi yirik funksiyalar qo'shildi.

## ✨ Yangi funksiyalar

### Backend
- ✅ **OpenAI (GPT-4o mini)** — marketplace matn generatsiyasi
- ✅ **Gemini 1.5 Flash** — fallback (OpenAI ishlamasa)
- ✅ **Higgsfield** — rasm AI (fon o'chirish, upscale)
- ✅ **Uzum export** — kartochka JSON eksport (qo'lda yuklash uchun)
- ✅ **Uzum scrape** — raqobatchi mahsulot ma'lumotlarini olish
- ✅ **Marketplace API kalit** — shifrlangan saqlash + test
- ✅ **Analytics** — overview, timeseries, top products

### Frontend
- ✅ **Marketplace ulash sahifasi** (4 platforma uchun)
- ✅ **AI generatsiya** oqimi (4 marketplace uchun matn)
- ✅ **Kartochkalarni tahrirlash** (title, desc, SEO inline edit)
- ✅ **Uzum eksport** (JSON download)
- ✅ **Rasm AI tugmalari** (fon, upscale, o'chirish)
- ✅ **Analytics dashboard** — Recharts (chiziqli, bar, pie)

## 🔧 O'rnatish

### 1. Yangi dependencylar

**Backend:** hech qanday yangi package kerak emas (fetch built-in)

**Frontend:**
```bash
cd apps/web
npm install recharts
```

### 2. Yangi API kalitlar (`.env`)

**apps/api/.env** ga qo'shing:
```env
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...
HIGGSFIELD_API_KEY=hf_...
HIGGSFIELD_API_URL=https://api.higgsfield.ai/v1
```

**Kalitlarni qayerdan olish:**
- OpenAI: https://platform.openai.com/api-keys
- Gemini: https://aistudio.google.com/apikey (bepul)
- Higgsfield: senda tayyor

### 3. Fayllarni ustiga yozing

Bu ZIP'dagi fayllarni oldingi loyihaga qo'ying:

```
apps/api/src/
├── controllers/
│   ├── ai.controller.ts          ← YANGI (AI logic)
│   ├── listing.controller.ts     ← YANGI
│   ├── marketplace.controller.ts ← YANGI
│   └── analytics.controller.ts   ← YANGI
├── routes/
│   ├── ai.routes.ts              ← YANGILANDI
│   ├── listing.routes.ts         ← YANGILANDI
│   ├── marketplace.routes.ts     ← YANGILANDI
│   └── analytics.routes.ts       ← YANGILANDI
└── services/
    ├── ai/
    │   ├── openai.service.ts     ← YANGI
    │   ├── gemini.service.ts     ← YANGI
    │   └── text-generator.service.ts  ← YANGI
    ├── higgsfield.service.ts     ← YANGI
    └── marketplace/
        └── uzum.service.ts       ← YANGI

apps/web/app/dashboard/
├── marketplaces/page.tsx         ← YANGILANDI
├── analytics/page.tsx            ← YANGILANDI
└── products/[id]/
    ├── page.tsx                  ← YANGILANDI (AI tugmalari)
    └── listings/page.tsx         ← YANGI
```

### 4. Ishga tushirish

```bash
# 1-terminal
cd apps/api && npm run dev

# 2-terminal
cd apps/web && npm run dev
```

## 🧪 To'liq test oqimi

1. **Login** qiling
2. **Marketplace'lar** sahifasiga o'ting
3. Uzum uchun API kalitni kiriting va **Test qilish** tugmasini bosing
4. **Mahsulotlar** > yangi mahsulot yarating (rasm bilan)
5. Mahsulot detail sahifasida rasmga hover qiling → **Fon o'chirish** tugmasini bosing
6. **Marketplace kartochkalari** tugmasini bosing
7. 4 marketplace tanlab **AI generatsiya** ni bosing
8. Har bir kartochkani ko'ring, tahrirlang, JSON eksport qiling
9. **Analitika** sahifasiga o'ting — grafikalarni ko'ring

## 📊 Yangi API endpointlar

### AI
- `POST /api/ai/remove-background` — rasm foni
- `POST /api/ai/upscale` — HD sifat
- `GET /api/ai/jobs/:id` — job holati
- `POST /api/ai/generate-listings` — matn generatsiya

### Listing
- `GET /api/listings/product/:productId` — kartochkalar ro'yxati
- `PATCH /api/listings/:id` — tahrirlash
- `DELETE /api/listings/:id`
- `GET /api/listings/:id/export` — Uzum uchun JSON
- `POST /api/listings/scrape/uzum` — Uzum'dan olish

### Marketplace
- `GET /api/marketplaces`
- `POST /api/marketplaces` — kalit qo'shish
- `DELETE /api/marketplaces/:id`
- `POST /api/marketplaces/:id/test` — kalitni test qilish

### Analytics
- `GET /api/analytics/overview`
- `GET /api/analytics/timeseries?days=30`
- `GET /api/analytics/top-products`

## ⚠️ Muhim eslatmalar

**Higgsfield API:** Endpoint URL va parametrlar Higgsfield hujjatiga qarab moslashtirish kerak bo'lishi mumkin. Kod umumiy REST API pattern'ga mos yozilgan, agar Higgsfield boshqacha API format ishlatsa — `services/higgsfield.service.ts` faylini moslang.

**Uzum scrape:** Uzum ToS'iga rioya qiling. Faqat o'z mahsulotlaringiz yoki ochiq narx tahlili uchun ishlating.

**AI xarajat:**
- OpenAI GPT-4o mini: taxminan **$0.15 / 1M input token** (~4 kartochka = $0.001)
- Gemini 1.5 Flash: **bepul limit** kunlik 1500 so'rov
- Higgsfield: **25 credit bepul** (rasm)

## 🔜 4-bosqich (keyingi)

- Mobile ilova (React Native + Expo)
- Bulk import (CSV/Excel)
- Real-time notifications (Socket.IO)
- Multi-language UI (uz/ru)
- Deploy (Vercel + Neon)
