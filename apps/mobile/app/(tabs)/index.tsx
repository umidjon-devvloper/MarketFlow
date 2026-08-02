import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Package, TrendingUp, ShoppingCart, Sparkles, ArrowRight } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/utils';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentOrg = useAuthStore((s) => s.currentOrg());
  const [stats, setStats] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [overview, top] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/top-products?limit=3'),
      ]);
      setStats(overview.data);
      setTopProducts(top.data.products);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: Spacing.lg }}
      >
        {/* Header */}
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{ fontSize: FontSize.sm, color: Colors.slate500 }}>
            {currentOrg?.name}
          </Text>
          <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', marginTop: Spacing.xs }}>
            Salom, {user?.fullName?.split(' ')[0]}!
          </Text>
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl }}>
          <StatCard
            icon={Package}
            label="Mahsulotlar"
            value={stats?.totals?.products || 0}
            color={Colors.primary}
            bgColor={Colors.primaryLight}
          />
          <StatCard
            icon={TrendingUp}
            label="Faol kartochkalar"
            value={stats?.totals?.activeListings || 0}
            color={Colors.success}
            bgColor={Colors.successLight}
          />
          <StatCard
            icon={ShoppingCart}
            label="Qoralamalar"
            value={stats?.totals?.draftListings || 0}
            color="#ea580c"
            bgColor="#fed7aa"
          />
          <StatCard
            icon={Sparkles}
            label="AI ishlar"
            value={stats?.totals?.aiJobs || 0}
            color={Colors.purple}
            bgColor={Colors.purpleLight}
          />
        </View>

        {/* Quick actions */}
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{ fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.md }}>
            Tez amallar
          </Text>
          <View style={{ gap: Spacing.sm }}>
            <ActionButton
              icon={Package}
              label="Yangi mahsulot qo'shish"
              onPress={() => router.push('/products/new')}
            />
            <ActionButton
              icon={Sparkles}
              label="AI bilan rasm ishlash"
              onPress={() => router.push('/(tabs)/ai')}
            />
          </View>
        </View>

        {/* Top products */}
        {topProducts.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: FontSize.lg, fontWeight: '600' }}>Top mahsulotlar</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/products')}>
                <Text style={{ color: Colors.primary, fontSize: FontSize.sm }}>Hammasi</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: Spacing.sm }}>
              {topProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => router.push(`/products/${p.id}`)}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: Colors.white,
                    padding: Spacing.md,
                    borderRadius: Radius.lg,
                    alignItems: 'center',
                    gap: Spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      backgroundColor: Colors.slate100,
                      borderRadius: Radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Package color={Colors.slate400} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '500', fontSize: FontSize.base }}>
                      {p.title}
                    </Text>
                    <Text style={{ color: Colors.slate500, fontSize: FontSize.xs, marginTop: 2 }}>
                      {p.sales} sotildi
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '600', color: Colors.primary }}>
                    {formatPrice(p.revenue)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor }: any) {
  return (
    <View
      style={{
        backgroundColor: Colors.white,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        flex: 1,
        minWidth: '45%',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: Radius.md,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.sm,
        }}
      >
        <Icon color={color} size={16} />
      </View>
      <Text style={{ fontSize: FontSize.xs, color: Colors.slate600 }}>{label}</Text>
      <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon: Icon, label, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        gap: Spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.md,
          backgroundColor: Colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon color={Colors.primary} size={20} />
      </View>
      <Text style={{ flex: 1, fontWeight: '500', fontSize: FontSize.base }}>{label}</Text>
      <ArrowRight color={Colors.slate400} size={20} />
    </TouchableOpacity>
  );
}
