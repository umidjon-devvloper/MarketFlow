import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, Package } from 'lucide-react-native';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/utils';

interface Product {
  id: string;
  title: string;
  category: string;
  brand?: string;
  basePrice: string;
  currency: string;
  stock: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  images: Array<{ url: string; isPrimary: boolean }>;
  listings: Array<{ marketplace: string; status: string }>;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: Colors.slate100, text: Colors.slate700 },
  ACTIVE: { bg: Colors.successLight, text: '#166534' },
  ARCHIVED: { bg: Colors.dangerLight, text: '#991b1b' },
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Qoralama',
  ACTIVE: 'Faol',
  ARCHIVED: 'Arxiv',
};

export default function ProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = async (query = search) => {
    try {
      const { data } = await api.get('/products', {
        params: { limit: 50, search: query || undefined },
      });
      setProducts(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      {/* Header */}
      <View
        style={{
          padding: Spacing.lg,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.slate200,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold' }}>Mahsulotlar</Text>
          <TouchableOpacity
            onPress={() => router.push('/products/new')}
            style={{
              backgroundColor: Colors.primary,
              width: 40,
              height: 40,
              borderRadius: Radius.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus color={Colors.white} size={20} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.slate100,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
          }}
        >
          <Search color={Colors.slate400} size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Qidirish..."
            style={{ flex: 1, paddingVertical: 10, paddingLeft: Spacing.sm, fontSize: FontSize.sm }}
          />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
          <Package color={Colors.slate300} size={48} />
          <Text style={{ color: Colors.slate500, marginTop: Spacing.md, textAlign: 'center' }}>
            {search ? 'Hech narsa topilmadi' : 'Hozircha mahsulot yo\'q'}
          </Text>
          {!search && (
            <TouchableOpacity
              onPress={() => router.push('/products/new')}
              style={{
                marginTop: Spacing.lg,
                backgroundColor: Colors.primary,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                borderRadius: Radius.md,
              }}
            >
              <Text style={{ color: Colors.white, fontWeight: '600' }}>Birinchi mahsulot qo'shish</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          renderItem={({ item }) => {
            const primary = item.images.find((i) => i.isPrimary) || item.images[0];
            const status = statusColors[item.status];
            return (
              <TouchableOpacity
                onPress={() => router.push(`/products/${item.id}`)}
                style={{
                  flexDirection: 'row',
                  backgroundColor: Colors.white,
                  padding: Spacing.md,
                  borderRadius: Radius.lg,
                  gap: Spacing.md,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    backgroundColor: Colors.slate100,
                    borderRadius: Radius.md,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {primary ? (
                    <Image source={{ uri: primary.url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Package color={Colors.slate400} size={22} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '500', fontSize: FontSize.base }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: Colors.slate500, fontSize: FontSize.xs, marginTop: 2 }} numberOfLines={1}>
                    {item.category}
                    {item.brand ? ` · ${item.brand}` : ''} · {item.stock} dona
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: Spacing.sm }}>
                    <Text style={{ fontWeight: '600', fontSize: FontSize.sm }}>
                      {formatPrice(item.basePrice, item.currency)}
                    </Text>
                    <View
                      style={{
                        backgroundColor: status.bg,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, color: status.text, fontWeight: '600' }}>
                        {statusLabels[item.status]}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
