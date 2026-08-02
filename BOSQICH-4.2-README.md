# 📊 MarketFlow 4.2 — Bulk Import (CSV/Excel)

Ushbu bosqichda ommaviy import funksiyasi qo'shildi: Excel yoki CSV faylda 1000 tagacha mahsulotni bir vaqtda import qilish.

## ✨ Yangi funksiyalar

### Backend
- ✅ Excel/CSV parsing (SheetJS `xlsx` paketi)
- ✅ Multer bilan fayl yuklash (memory storage)
- ✅ Ustun nomlari normalizatsiyasi (uz/ru/eng)
- ✅ Row-by-row validatsiya (Zod)
- ✅ Batch import (50 tadan)
- ✅ Excel shablon generatsiya (bo'sh yoki namuna bilan)
- ✅ Yo'riqnoma sahifasi shablon ichida

### Frontend
- ✅ Drag-and-drop fayl yuklash sahifasi
- ✅ Shablon yuklab olish (namuna bilan/siz)
- ✅ Preview jadval (xato satrlar qizil)
- ✅ Xato details har bir maydon bo'yicha
- ✅ Import natija ekrani (successful/failed)
- ✅ Products ro'yxatida "Ommaviy import" tugmasi

## 📋 Fayl formati

Excel/CSV ustunlari (bir necha tilda qabul qilinadi):

| Ustun | Zarur | Tavsif |
|-------|-------|--------|
| `title` / `nomi` / `название` | ✅ | Nomi (3-200 belgi) |
| `description` / `tavsif` / `описание` | ✅ | Tavsif (10+ belgi) |
| `category` / `kategoriya` / `категория` | ✅ | Kategoriya |
| `basePrice` / `price` / `narx` / `цена` | ✅ | Narx (musbat son) |
| `brand` / `brend` / `бренд` | | Brend |
| `sku` | | Ichki artikul |
| `barcode` / `barkod` | | Shtrix kod |
| `currency` / `valyuta` | | UZS/RUB/USD (default: UZS) |
| `stock` / `zaxira` / `остаток` | | Zaxira (default: 0) |
| `imageUrl1..5` / `rasm1..5` | | Rasm URL manzillari |

## 🛠 O'rnatish

### 1. Yangi paketlar (Backend)

```bash
cd apps/api
npm install xlsx multer
npm install -D @types/multer
```

### 2. Fayllarni oldingi loyihaga qo'ying

```
apps/api/src/
├── services/import.service.ts     ← YANGI
├── controllers/import.controller.ts ← YANGI
├── routes/import.routes.ts         ← YANGI
└── index.ts                        ← YANGILANDI (import routes qo'shildi)

apps/web/app/dashboard/products/
├── import/page.tsx                 ← YANGI
└── page.tsx                        ← YANGILANDI (Import tugmasi)
```

### 3. Ishga tushirish

```bash
cd apps/api && npm run dev
cd apps/web && npm run dev
```

## 🧪 To'liq test

### 1. Shablon yuklab olish

1. Dashboard → **Mahsulotlar** → **Ommaviy import**
2. O'ng panelda **"Namuna bilan shablon"** ni bosing
3. `marketflow-shablon-namuna.xlsx` yuklanadi

### 2. Namunani ko'rish

Faylni Excel/LibreOffice'da oching:
- Sheet 1 (**Mahsulotlar**) — 2 ta namuna satr
- Sheet 2 (**Yo'riqnoma**) — har bir ustun tushuntirilgan

### 3. O'zingizning ma'lumotlaringizni qo'shing

Namunani o'chirmasdan, keyingi satrlarga o'z mahsulotlaringizni yozing.

### 4. Yuklash va tekshirish

1. Faylni **drag-drop** yoki tanlash bilan yuklang
2. Preview ekranida:
   - Yashil = valid satr
   - Qizil = xato bor (o'ngda tushuntirish)
3. Xato satrlarni Excel'da tuzatib qayta yuklash mumkin

### 5. Import qilish

**"N ta valid satrni import qilish"** tugmasini bosing → tasdiqlash → 50 tadan batch bo'lib import bo'ladi.

## 📊 API endpointlar

- `GET /api/import/template?examples=true|false` — Excel shablon
- `POST /api/import/preview` — fayl parse + validatsiya (multipart)
- `POST /api/import/execute` — validated satrlarni import qilish

## ⚠️ Cheklovlar

- Fayl hajmi: max **20MB**
- Satrlar soni: max **1000 ta**
- Rasmlar: **avvaldan URL bo'lishi kerak** (UploadThing yoki boshqa CDN'da)
- SKU takrorlanmasligi kerak (unique)

## 💡 Foydali maslahatlar

**Rasm URL'lari qanday olish?**
- Agar sizda oldingi WordPress/OpenCart sayti bor bo'lsa — o'sha URL'lar
- Aks holda, alohida rasm CDN xizmatiga yuklang (Cloudinary, ImageKit)
- Yoki avval boshqa mahsulotlarni oddiy usulda yaratib, ularning rasm URL'larini nusxa oling

**Kategoriya nomlari:**
- Bir hil yozing (masalan "Kiyim-kechak", "kiyim-kechak" emas)
- Marketplace kategoriyalariga mos kelishi shart emas — bu ichki tasnif

**Zaxira 0 bo'lishi mumkinmi?**
- Ha, DRAFT holatda import qilinadi, keyin zaxira qo'shasiz

## 🔜 Keyingi 4.3 bosqich

**Real deploy (Vercel + Neon):**
- Production database (Neon PostgreSQL)
- Vercel'ga deploy (web + API)
- Environment variables sozlash
- Custom domain
- CI/CD (GitHub Actions)
