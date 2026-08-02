# 🚀 MarketFlow — 4.1 bosqich: Multi-user + Organization

Bu bosqich **eng katta struktura o'zgarishi**. Baza sxemasi to'liq qayta ishlangan.

## ✨ Nima o'zgardi

### Baza tuzilishi (asosiy o'zgarish!)
- ✅ Yangi model: **Organization** (tashkilot/kompaniya)
- ✅ Yangi model: **Membership** (user + org + rol)
- ✅ Yangi model: **Invitation** (email orqali taklif)
- ⚠️ **Product va UserMarketplace endi `organizationId` ga bog'langan**, `userId` emas

### Rollar tizimi
| Rol | Ruxsatlar |
|-----|-----------|
| **OWNER** | Hammasi: o'chirish, xodim qo'shish/chiqarish, sozlamalar |
| **ADMIN** | Mahsulot boshqaruvi, kalitlar, xodim taklifi |
| **STAFF** | Faqat mahsulot yaratish/tahrirlash (o'chirish yo'q) |

### Yangi funksiyalar
- ✅ Har bir foydalanuvchi bir necha tashkilotga a'zo bo'la oladi
- ✅ Sidebar'da tashkilot tanlash (switcher)
- ✅ Email orqali xodim taklif qilish (7 kunlik link)
- ✅ Rol o'zgartirish
- ✅ Xodimni chiqarish (faqat OWNER)
- ✅ Register vaqtida taklif token bilan avtomatik qo'shilish

## 🛠 O'rnatish

### 1. Prisma sxemasini yangilash

```bash
cd apps/api

# Yangi sxemani applying
npx prisma db push

# Type generate
npx prisma generate
```

### 2. Migratsiya (agar eski ma'lumot bo'lsa)

**MUHIM:** agar sen 3-bosqichdan foydalanib, bazaga foydalanuvchi va mahsulot qo'shgan bo'lsang, ular yangi tuzilishga migratsiya kerak.

```bash
# Backup avval (Neon'da avtomatik snapshot bor)

# Migratsiya skriptini ishga tushirish
npx tsx prisma/migrate-v41.ts
```

Bu skript:
- Har bir foydalanuvchi uchun avtomatik Organization yaratadi
- Foydalanuvchini OWNER qiladi
- Uning barcha mahsulot va marketplace kalitlarini yangi org ga bog'laydi

### 3. Frontend

Yangi paket kerak emas, faqat fayllarni ustiga yozing.

### 4. Test qilish

```bash
# 1-terminal
cd apps/api && npm run dev

# 2-terminal
cd apps/web && npm run dev
```

## 🧪 To'liq test

### Yangi foydalanuvchi flow

1. **Register** — yangi hisob yarating
2. Avtomatik "{Ismning}ning tashkiloti" yaratiladi
3. Siz **OWNER** bo'lasiz
4. Dashboardda **Jamoa** menusiga o'ting
5. **Xodim taklif qilish** — email va rolni tanlang
6. Yaratilgan link'ni nusxa oling

### Xodim taklif flow

1. Yangi browser (yoki incognito) da taklif link'ini oching
2. **Ro'yxatdan o'ting** (email pre-fill bo'ladi)
3. Avtomatik tashkilotga qo'shilasiz
4. Dashboardga tushasiz — endi 2 ta tashkilotdan biri sifatida ko'rinadi

### Tashkilot almashish

1. Sidebar'da tashkilot nomiga bosing
2. Boshqa tashkilotni tanlang
3. Sahifa reload bo'ladi — endi boshqa tashkilotning ma'lumotlari ko'rinadi

## 📊 Yangi API endpointlar

### Organizations
- `GET /api/orgs` — mening tashkilotlarim
- `POST /api/orgs` — yangi yaratish
- `GET /api/orgs/current` — hozirgi tashkilot
- `PATCH /api/orgs/current` — tahrirlash (OWNER)

### Members
- `GET /api/orgs/current/members` — a'zolar
- `PATCH /api/orgs/current/members/:id` — rol o'zgartirish (ADMIN+)
- `DELETE /api/orgs/current/members/:id` — chiqarish (OWNER)

### Invitations
- `GET /api/orgs/current/invitations` — kutilayotgan
- `POST /api/orgs/current/invitations` — yangi taklif (ADMIN+)
- `DELETE /api/orgs/current/invitations/:id` — bekor qilish

### Public
- `GET /api/invitations/:token` — taklif ma'lumoti (login shart emas)
- `POST /api/invitations/:token/accept` — qabul qilish (auth kerak)

## 🔧 Header'lar

Barcha `/api/*` (auth va invitations dan tashqari) so'rovlarga:
```
Authorization: Bearer {accessToken}
X-Organization-Id: {orgId}  ← YANGI
```

Frontend `lib/api.ts` avtomatik qo'shadi.

## ⚠️ Muhim eslatmalar

### Xato bo'lsa

**"Bu tashkilotga kirish huquqi yo'q"** — X-Organization-Id header noto'g'ri. Frontend `useAuthStore.currentOrgId` ni tekshiring.

**"Kerakli rol: OWNER"** — bu operatsiya faqat rahbar uchun. Rolingizni tekshiring.

**Migratsiya xato bersa** — Prisma Studio ochib qo'lda tekshiring: `npx prisma studio`

## 🔜 Keyingi 4.2 bosqich

**Bulk Import (CSV/Excel):**
- 100+ mahsulotni bir vaqtda import
- Excel shablon
- Xato tekshiruv va tuzatish
- Progress indicator
