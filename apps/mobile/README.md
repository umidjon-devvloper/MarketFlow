# 📱 MarketFlow Mobile — 4.4 bosqich

React Native + Expo bilan qurilgan MarketFlow mobil ilovasi.

## ✨ Xususiyatlar

### Auth
- ✅ Login/Register (form validation)
- ✅ JWT + Secure Store (shifrlangan)
- ✅ Auto-refresh token
- ✅ Auth guard (routing)

### Asosiy funksiyalar
- ✅ Bottom tab navigation (Home, Products, AI Studio, Profile)
- ✅ Mahsulotlar ro'yxati (qidiruv, refresh)
- ✅ Product detail (rasm, ma'lumot, marketplace status)
- ✅ Yangi mahsulot yaratish (kameradan/galereyadan)
- ✅ AI fon o'chirish (rasmma-rasm)

### AI Studio 🎨
- ✅ Kameradan tez rasm olish
- ✅ Galereyadan tanlash
- ✅ Higgsfield AI fon o'chirish
- ✅ URL nusxa olish clipboard'ga

### Push Notifications
- ✅ Expo Notifications
- ✅ Token registratsiya
- ✅ Local + remote notification

### Multi-org
- ✅ Tashkilotlarni tanlash
- ✅ Rollarga qarab UI (OWNER/ADMIN/STAFF)

## 🛠 O'rnatish

### 1. Dependencies

```bash
cd apps/mobile
npm install
```

### 2. .env.local

```env
EXPO_PUBLIC_API_URL=http://192.168.1.XX:4000/api
```

⚠️ **Muhim**: `localhost` ishlamaydi telefon uchun — kompyuteringizning **local IP**'sini yozing (masalan `192.168.1.100`).

Terminaldan olish:
```bash
# Windows
ipconfig | findstr IPv4

# Mac/Linux
ifconfig | grep "inet "
```

### 3. Expo Dev Client sozlash

```bash
npx expo install expo-dev-client
```

### 4. Ishga tushirish

**Development (Expo Go):**
```bash
npm start
```

QR kodni telefondagi Expo Go ilovasi bilan skanerlang.

**Real qurilma (native modules bilan):**
```bash
# Android
npm run android

# iOS (Mac kerak)
npm run ios
```

### 5. Production build

```bash
# EAS'ga login
npx eas login

# Konfiguratsiya
npx eas build:configure

# Android APK
npx eas build --platform android --profile preview

# iOS
npx eas build --platform ios
```

## 📁 Struktura

```
apps/mobile/
├── app/                          # Expo Router
│   ├── _layout.tsx              # Root layout (auth guard)
│   ├── (auth)/                  # Auth stack
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                  # Bottom tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Home
│   │   ├── products.tsx         # Products list
│   │   ├── ai.tsx               # AI Studio
│   │   └── profile.tsx
│   └── products/
│       ├── [id].tsx             # Product detail
│       └── new.tsx              # New product (kameradan)
├── components/
├── lib/
│   ├── api.ts                   # Axios klient
│   ├── images.ts                # Kamera/galereya/upload
│   ├── notifications.ts         # Push notifications
│   └── utils.ts
├── store/
│   └── auth.store.ts            # Zustand + SecureStore
├── constants/
│   └── theme.ts                 # Ranglar, spacing
└── app.config.ts                # Expo config
```

## 🧪 Test qilish

### 1. Register/Login
1. Ilovani oching
2. **Ro'yxatdan o'ting** — yangi hisob
3. Avtomatik login va Home tabga tushasiz

### 2. Yangi mahsulot (kameradan)
1. **Mahsulotlar** tabga o'ting
2. **+** tugmasini bosing
3. **Kameradan olish** — rasm oling
4. Ma'lumotlarni to'ldiring (nomi, tavsif, narx)
5. Kategoriya chip'larini tanlang
6. **Saqlash**

### 3. AI Studio (Higgsfield credit tekshirish)
1. **AI Studio** tabga o'ting
2. **Kameradan olish** yoki galereya
3. AI foni tozalab beradi
4. URL nusxa olib boshqa joyda ishlatasiz

### 4. Push notifications
- Real qurilmada test qiling (simulator'da ishlamaydi)
- Yangi mahsulot qo'shganingizda notification kelishi kerak (backend'da webhook kerak)

## ⚠️ Muhim eslatmalar

**IP adres muammosi:**
- Localhost ishlamaydi — LAN IP kerak
- Backend'ni ham `0.0.0.0` da tinglash kerak (nafaqat localhost)
- Backend'da: `app.listen(4000, '0.0.0.0', ...)`

**Kamera Simulatorda:**
- iOS Simulator kamerani qo'llab-quvvatlamaydi
- Faqat real qurilmada test qiling

**Push Notifications:**
- Expo Go bilan bo'ladi
- EAS Build bilan production'da to'liq ishlaydi

**HTTPS:**
- Production'da backend HTTPS bo'lishi kerak
- HTTP faqat development'da

## 🔜 Keyingi qadamlar

- App Store va Google Play deploy
- Deep linking (masalan `marketflow://products/123`)
- Offline mode
- Barcode scanner (mahsulot qidirish uchun)
