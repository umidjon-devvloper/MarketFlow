import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Wand2,
  Trash2,
  Package,
  Sparkles,
  Loader2,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Spacing, FontSize, Radius, MARKETPLACES } from '@/constants/theme';
import { formatPrice } from '@/lib/utils';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { hasRole } = useAuthStore();
  const canDelete = hasRole('OWNER', 'ADMIN');

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data.product);
    } catch (err) {
      Alert.alert('Xato', 'Mahsulotni yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBg = async (imageId: string) => {
    setProcessing(imageId);
    try {
      await api.post('/ai/remove-background', { imageId });
      Alert.alert('AI', 'Fon o\'chirish boshlandi. Bir necha sekund kutib turing');
      setTimeout(load, 5000);
    } catch (err: any) {
      Alert.alert('Xato', err.response?.data?.error || 'AI xato');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('O\'chirish', 'Bu mahsulotni o\'chirmoqchimisiz?', [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'O\'chirish',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/products/${id}`);
            router.back();
          } catch (err: any) {
            Alert.alert('Xato', err.response?.data?.error || 'O\'chirishda xato');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!product) return null;

  const primaryImage = product.images.find((i: any) => i.isPrimary) || product.images[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: Spacing.md,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.slate200,
          gap: Spacing.sm,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing.xs }}>
          <ArrowLeft color={Colors.slate700} size={22} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: FontSize.lg, fontWeight: '600' }} numberOfLines={1}>
          {product.title}
        </Text>
        {canDelete && (
          <TouchableOpacity onPress={handleDelete} style={{ padding: Spacing.xs }}>
            <Trash2 color={Colors.danger} size={20} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg }}>
        {/* Main Image */}
        {primaryImage ? (
          <Image
            source={{ uri: primaryImage.url }}
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: Radius.lg,
              backgroundColor: Colors.slate100,
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: Radius.lg,
              backgroundColor: Colors.slate100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package color={Colors.slate400} size={48} />
          </View>
        )}

        {/* Info */}
        <View style={{ backgroundColor: Colors.white, padding: Spacing.md, borderRadius: Radius.lg }}>
          <Text style={{ color: Colors.slate500, fontSize: FontSize.xs }}>
            {product.category}
            {product.brand && ` • ${product.brand}`}
          </Text>
          <Text style={{ fontSize: FontSize.xl, fontWeight: '700', marginTop: 4 }}>
            {product.title}
          </Text>
          <Text style={{ color: Colors.primary, fontSize: FontSize.xl, fontWeight: 'bold', marginTop: Spacing.sm }}>
            {formatPrice(product.basePrice, product.currency)}
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.sm, color: Colors.slate600 }}>
              Zaxira: <Text style={{ fontWeight: '600' }}>{product.stock}</Text>
            </Text>
            {product.sku && (
              <Text style={{ fontSize: FontSize.sm, color: Colors.slate600 }}>
                SKU: <Text style={{ fontWeight: '600' }}>{product.sku}</Text>
              </Text>
            )}
          </View>
        </View>

        {/* Description */}
        <View style={{ backgroundColor: Colors.white, padding: Spacing.md, borderRadius: Radius.lg }}>
          <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: Colors.slate600, marginBottom: Spacing.sm }}>
            Ta'rif
          </Text>
          <Text style={{ fontSize: FontSize.sm, color: Colors.slate700, lineHeight: 20 }}>
            {product.description}
          </Text>
        </View>

        {/* Images grid */}
        {product.images.length > 0 && (
          <View style={{ backgroundColor: Colors.white, padding: Spacing.md, borderRadius: Radius.lg }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: Colors.slate600, marginBottom: Spacing.sm }}>
              Rasmlar ({product.images.length})
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {product.images.map((img: any) => (
                <View key={img.id} style={{ width: '31%' }}>
                  <Image
                    source={{ uri: img.url }}
                    style={{
                      width: '100%',
                      aspectRatio: 1,
                      borderRadius: Radius.md,
                      backgroundColor: Colors.slate100,
                    }}
                  />
                  {img.isAiProcessed && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: Colors.purple,
                        paddingHorizontal: 4,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Sparkles color={Colors.white} size={10} />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => handleRemoveBg(img.id)}
                    disabled={processing === img.id}
                    style={{
                      marginTop: Spacing.xs,
                      backgroundColor: Colors.purpleLight,
                      padding: Spacing.xs,
                      borderRadius: Radius.sm,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {processing === img.id ? (
                      <ActivityIndicator color={Colors.purple} size="small" />
                    ) : (
                      <>
                        <Wand2 color={Colors.purple} size={12} />
                        <Text style={{ color: Colors.purple, fontSize: 11, fontWeight: '500' }}>
                          AI fon
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Marketplaces */}
        <View style={{ backgroundColor: Colors.white, padding: Spacing.md, borderRadius: Radius.lg }}>
          <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: Colors.slate600, marginBottom: Spacing.sm }}>
            Marketplace kartochkalari
          </Text>
          <View style={{ gap: Spacing.sm }}>
            {(['UZUM', 'OZON', 'WB', 'YANDEX'] as const).map((mp) => {
              const info = MARKETPLACES[mp];
              const listing = product.listings?.find((l: any) => l.marketplace === mp);
              return (
                <View
                  key={mp}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: Spacing.sm,
                    borderWidth: 1,
                    borderColor: Colors.slate200,
                    borderRadius: Radius.md,
                    gap: Spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{info.icon}</Text>
                  <Text style={{ flex: 1, fontWeight: '500' }}>{info.name}</Text>
                  {listing ? (
                    <View
                      style={{
                        backgroundColor: Colors.successLight,
                        paddingHorizontal: Spacing.sm,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ color: '#166534', fontSize: FontSize.xs, fontWeight: '500' }}>
                        {listing.status}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: Colors.slate400, fontSize: FontSize.xs }}>
                      Yaratilmagan
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
