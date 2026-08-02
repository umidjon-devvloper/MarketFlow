# 📦 MarketFlow — 2-bosqich

Bu bosqichda quyidagilar qo'shildi:

## ✨ Yangi funksiyalar

### Backend (apps/api)
- ✅ **Product CRUD** — mahsulot yaratish/tahrirlash/o'chirish
- ✅ **Rasm boshqaruvi** — qo'shish, o'chirish, tartibga solish
- ✅ **UploadThing servisi** — fayl o'chirish uchun

### Frontend (apps/web)
- ✅ **Login/Register** sahifalari (form validation bilan)
- ✅ **JWT refresh flow** — token avtomatik yangilanadi
- ✅ **Dashboard layout** — sidebar navigatsiya
- ✅ **Dashboard bosh sahifa** — statistika
- ✅ **Mahsulotlar ro'yxati** — qidiruv, paginatsiya
- ✅ **Yangi mahsulot forma** — rasm yuklash bilan
- ✅ **Product detail** sahifa
- ✅ **Zustand auth store** (localStorage bilan)
- ✅ **UploadThing dropzone** komponenti

## 🛠 O'rnatish

### 1. Fayllarni ustiga yozing

Bu ZIP dagi fayllarni oldingi loyihaga qo'shing (yoki almashtiring).

### 2. Yangi dependencylar

Web ilova uchun:
```bash
cd apps/web
npm install zustand react-hook-form @hookform/resolvers zod \
  lucide-react clsx tailwind-merge axios
```

### 3. UploadThing sozlash

1. https://uploadthing.com ga kiring
2. Yangi app yarating
3. API Keys > `UPLOADTHING_TOKEN` ni oling
4. Yozing:

**apps/web/.env.local**:
```env
UPLOADTHING_TOKEN=eyJhcGl...
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

**apps/api/.env**:
```env
UPLOADTHING_TOKEN=eyJhcGl...
```

### 4. Ishga tushiring

```bash
# 1-terminalda backend
cd apps/api && npm run dev

# 2-terminalda web
cd apps/web && npm run dev
```

Ochish: http://localhost:3000

## 🧪 Sinash

1. **Register** — http://localhost:3000/register
2. Yangi hisob yarating
3. Dashboard avtomatik ochiladi
4. **"Yangi mahsulot"** tugmasini bosing
5. Ma'lumotlarni to'ldiring, rasm yuklang
6. **Saqlash** — mahsulot detail sahifaga o'tadi

## 📁 Yangi fayllar

```
apps/api/src/
├── controllers/product.controller.ts   ← Product CRUD
├── routes/product.routes.ts            ← Yangilangan
├── services/uploadthing.service.ts     ← UploadThing helper
└── validators/product.validator.ts     ← Zod sxemalar

apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx              ← Login
│   │   └── register/page.tsx           ← Register
│   ├── api/uploadthing/route.ts        ← Upload proxy
│   └── dashboard/
│       ├── layout.tsx                  ← Sidebar + auth
│       ├── page.tsx                    ← Bosh sahifa
│       ├── products/
│       │   ├── page.tsx                ← Ro'yxat
│       │   ├── new/page.tsx            ← Yangi
│       │   └── [id]/page.tsx           ← Detail
│       ├── marketplaces/page.tsx
│       ├── analytics/page.tsx
│       └── settings/page.tsx
├── components/UploadDropzone.tsx
├── lib/
│   ├── api.ts                          ← Axios + refresh
│   └── utils.ts
└── store/auth.store.ts                 ← Zustand
```

## 🔜 Keyingi bosqich (3-bosqich)

- Marketplace API kalitlar sozlash
- Higgsfield AI integratsiyasi (fon o'chirish, upscale)
- Har bir marketplace uchun optimallashtirilgan kartochka generatsiyasi
- Uzum Business API'ga publish
