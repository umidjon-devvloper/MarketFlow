import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  Image as ImageIcon,
  Wand2,
  Zap,
  Download,
  Copy,
  RefreshCw,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '@/lib/api';
import { takePhotoFromCamera, pickFromGallery, uploadImage } from '@/lib/images';
import { scheduleLocalNotification } from '@/lib/notifications';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

/**
 * AI Studio — Higgsfield credit'ni maksimal ishlatish uchun mobile'da tez tekshirish
 *
 * Oqim:
 * 1. Kameradan rasm ol yoki galereyadan tanlash
 * 2. Backend'ga yubor (UploadThing)
 * 3. Higgsfield AI — fon o'chirish yoki upscale
 * 4. Natijani ko'rsatish — asl vs qayta ishlangan
 * 5. Download yoki URL nusxa olish
 */

interface AIResult {
  originalUrl: string;
  processedUrl?: string;
  jobId?: string;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export default function AIStudioScreen() {
  const [result, setResult] = useState<AIResult>({
    originalUrl: '',
    status: 'idle',
  });

  // ============ Rasm tanlash ============
  const handleCamera = async () => {
    const photo = await takePhotoFromCamera();
    if (photo) processImage(photo.uri);
  };

  const handleGallery = async () => {
    const photos = await pickFromGallery(1);
    if (photos[0]) processImage(photos[0].uri);
  };

  // ============ Yuklash + AI ============
  const processImage = async (localUri: string) => {
    setResult({ originalUrl: localUri, status: 'uploading' });

    try {
      // 1. UploadThing'ga yuklash
      const uploaded = await uploadImage(localUri);
      if (!uploaded) throw new Error('Rasm yuklanmadi');

      // TODO: bu yerda alohida "temp image" yaratish kerak
      // Hozircha soddalik uchun to'g'ridan-to'g'ri fon o'chirish
      // Backend'da temp image uchun endpoint kerak bo'lishi mumkin

      setResult({
        originalUrl: uploaded.url,
        status: 'processing',
      });

      // 2. AI: fon o'chirish (imageId kerak, biz standalone image yaratmadik)
      // Bu joyda backend'da yangi endpoint /api/ai/quick-remove-bg kerak
      // Hozir mock qilaman:
      Alert.alert(
        'AI Studio',
        'Bu funksiya to\'liq ishlashi uchun backend\'da /api/ai/quick-remove-bg endpoint kerak. Hozircha rasm yuklandi.',
        [{ text: 'OK' }],
      );

      setResult({
        originalUrl: uploaded.url,
        status: 'idle',
      });

    } catch (err: any) {
      setResult({
        originalUrl: localUri,
        status: 'failed',
        error: err.message,
      });
      Alert.alert('Xato', err.message);
    }
  };

  // ============ Nusxa olish ============
  const copyUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('Nusxa olindi', 'URL clipboard\'ga saqlandi');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        {/* Header */}
        <View style={{ marginBottom: Spacing.xl }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              marginBottom: Spacing.xs,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                backgroundColor: Colors.purpleLight,
                borderRadius: Radius.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wand2 color={Colors.purple} size={18} />
            </View>
            <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold' }}>AI Studio</Text>
          </View>
          <Text style={{ color: Colors.slate600, fontSize: FontSize.sm }}>
            Rasm oling — AI foni tez tozalab beradi
          </Text>
        </View>

        {/* Image Source Buttons */}
        <View style={{ gap: Spacing.md, marginBottom: Spacing.xl }}>
          <TouchableOpacity
            onPress={handleCamera}
            disabled={result.status === 'uploading' || result.status === 'processing'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.primary,
              padding: Spacing.lg,
              borderRadius: Radius.lg,
              gap: Spacing.md,
              opacity: result.status === 'uploading' || result.status === 'processing' ? 0.5 : 1,
            }}
          >
            <Camera color={Colors.white} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.white, fontSize: FontSize.base, fontWeight: '600' }}>
                Kameradan rasm olish
              </Text>
              <Text style={{ color: Colors.primaryLight, fontSize: FontSize.xs, marginTop: 2 }}>
                Tez, oq fonda tayyorlanadi
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGallery}
            disabled={result.status === 'uploading' || result.status === 'processing'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.white,
              padding: Spacing.lg,
              borderRadius: Radius.lg,
              gap: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.slate200,
              opacity: result.status === 'uploading' || result.status === 'processing' ? 0.5 : 1,
            }}
          >
            <ImageIcon color={Colors.slate700} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.base, fontWeight: '600' }}>
                Galereyadan tanlash
              </Text>
              <Text style={{ color: Colors.slate500, fontSize: FontSize.xs, marginTop: 2 }}>
                Mavjud rasmni yuklang
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Result Area */}
        {result.originalUrl ? (
          <View style={{ backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md }}>
            {/* Status */}
            {result.status === 'uploading' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={{ color: Colors.slate600 }}>Yuklanmoqda...</Text>
              </View>
            )}
            {result.status === 'processing' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                <ActivityIndicator color={Colors.purple} />
                <Text style={{ color: Colors.slate600 }}>AI qayta ishlanyapti (10-30 sek)</Text>
              </View>
            )}

            {/* Original */}
            <Text style={{ fontSize: FontSize.xs, color: Colors.slate500, marginBottom: Spacing.xs, fontWeight: '600' }}>
              ASL RASM
            </Text>
            <Image
              source={{ uri: result.originalUrl }}
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: Radius.md,
                backgroundColor: Colors.slate100,
              }}
              resizeMode="cover"
            />

            {result.originalUrl.startsWith('http') && (
              <TouchableOpacity
                onPress={() => copyUrl(result.originalUrl)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.xs,
                  marginTop: Spacing.sm,
                  padding: Spacing.sm,
                  backgroundColor: Colors.slate100,
                  borderRadius: Radius.sm,
                }}
              >
                <Copy color={Colors.slate600} size={14} />
                <Text style={{ fontSize: FontSize.xs, color: Colors.slate600, flex: 1 }} numberOfLines={1}>
                  {result.originalUrl}
                </Text>
              </TouchableOpacity>
            )}

            {/* Processed */}
            {result.processedUrl && (
              <>
                <View style={{ height: 1, backgroundColor: Colors.slate200, marginVertical: Spacing.md }} />
                <Text style={{ fontSize: FontSize.xs, color: Colors.purple, marginBottom: Spacing.xs, fontWeight: '600' }}>
                  ✨ AI QAYTA ISHLANGAN
                </Text>
                <Image
                  source={{ uri: result.processedUrl }}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: Radius.md,
                    backgroundColor: Colors.slate100,
                  }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => copyUrl(result.processedUrl!)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Spacing.xs,
                    marginTop: Spacing.md,
                    padding: Spacing.md,
                    backgroundColor: Colors.purple,
                    borderRadius: Radius.md,
                  }}
                >
                  <Copy color={Colors.white} size={16} />
                  <Text style={{ color: Colors.white, fontWeight: '600' }}>URL nusxa olish</Text>
                </TouchableOpacity>
              </>
            )}

            {result.status === 'failed' && result.error && (
              <View
                style={{
                  marginTop: Spacing.md,
                  backgroundColor: Colors.dangerLight,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                }}
              >
                <Text style={{ color: '#991b1b', fontSize: FontSize.sm }}>Xato: {result.error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setResult({ originalUrl: '', status: 'idle' })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Spacing.xs,
                marginTop: Spacing.md,
                padding: Spacing.sm,
              }}
            >
              <RefreshCw color={Colors.slate500} size={14} />
              <Text style={{ color: Colors.slate500 }}>Yangi rasm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: Radius.lg,
              padding: Spacing.xxxl,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                backgroundColor: Colors.purpleLight,
                borderRadius: Radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <Zap color={Colors.purple} size={28} />
            </View>
            <Text style={{ fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center' }}>
              AI Studio'ga xush kelibsiz
            </Text>
            <Text
              style={{
                color: Colors.slate500,
                fontSize: FontSize.sm,
                textAlign: 'center',
                marginTop: Spacing.sm,
              }}
            >
              Kameradan rasm oling yoki galereyadan tanlang.{'\n'}
              AI foni tez o'chirib, marketplace uchun{'\n'}
              tayyor holatga keltiradi.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
