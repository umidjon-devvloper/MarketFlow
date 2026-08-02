import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'MarketFlow',
  slug: 'marketflow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'marketflow',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2563eb',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'uz.marketflow.app',
    infoPlist: {
      NSCameraUsageDescription: 'Mahsulot rasmini olish uchun kamera kerak',
      NSPhotoLibraryUsageDescription: 'Mahsulot rasmini yuklash uchun kirish kerak',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563eb',
    },
    package: 'uz.marketflow.app',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'NOTIFICATIONS',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-image-picker',
      {
        photosPermission: 'Mahsulot rasmini yuklash uchun ruxsat kerak',
        cameraPermission: 'Rasm olish uchun kamera kerak',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#2563eb',
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api',
    router: {
      origin: false,
    },
  },
};

export default config;
