import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  LogOut,
  Building2,
  Users,
  ChevronRight,
  Crown,
  Shield,
  Settings,
  HelpCircle,
} from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const ROLE_INFO = {
  OWNER: { label: 'Rahbar', icon: Crown, color: '#eab308' },
  ADMIN: { label: 'Admin', icon: Shield, color: Colors.primary },
  STAFF: { label: 'Xodim', icon: User, color: Colors.slate500 },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, organizations, currentOrgId, setCurrentOrg, logout } = useAuthStore();

  const current = organizations.find((o) => o.id === currentOrgId);

  const handleLogout = () => {
    Alert.alert('Chiqish', 'Chindan chiqmoqchimisiz?', [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'Chiqish',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleSwitchOrg = () => {
    if (organizations.length <= 1) {
      Alert.alert('Ma\'lumot', 'Sizda boshqa tashkilot yo\'q');
      return;
    }

    const buttons = organizations.map((org) => ({
      text: `${org.name} (${ROLE_INFO[org.role].label})`,
      onPress: () => {
        setCurrentOrg(org.id);
      },
    }));

    Alert.alert('Tashkilotni tanlang', '', [
      ...buttons,
      { text: 'Bekor', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        {/* User Card */}
        <View
          style={{
            backgroundColor: Colors.white,
            padding: Spacing.lg,
            borderRadius: Radius.lg,
            alignItems: 'center',
            marginBottom: Spacing.lg,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: Radius.full,
              backgroundColor: Colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.md,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: Colors.primary }}>
              {user?.fullName?.charAt(0)}
            </Text>
          </View>
          <Text style={{ fontSize: FontSize.lg, fontWeight: '600' }}>{user?.fullName}</Text>
          <Text style={{ color: Colors.slate500, fontSize: FontSize.sm, marginTop: 2 }}>
            {user?.email}
          </Text>
        </View>

        {/* Current Org */}
        {current && (
          <TouchableOpacity
            onPress={handleSwitchOrg}
            style={{
              backgroundColor: Colors.white,
              padding: Spacing.md,
              borderRadius: Radius.lg,
              marginBottom: Spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.md,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: Radius.md,
                backgroundColor: Colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 color={Colors.primary} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.xs, color: Colors.slate500 }}>Tashkilot</Text>
              <Text style={{ fontSize: FontSize.base, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                {current.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                {(() => {
                  const info = ROLE_INFO[current.role];
                  const Icon = info.icon;
                  return (
                    <>
                      <Icon color={info.color} size={12} />
                      <Text style={{ fontSize: FontSize.xs, color: info.color, fontWeight: '500' }}>
                        {info.label}
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>
            {organizations.length > 1 && <ChevronRight color={Colors.slate400} size={20} />}
          </TouchableOpacity>
        )}

        {/* Menu */}
        <View style={{ backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden' }}>
          <MenuItem
            icon={Users}
            label="Jamoa"
            onPress={() => Alert.alert('Info', 'Team boshqaruvi web versiyada mavjud')}
          />
          <Divider />
          <MenuItem
            icon={Settings}
            label="Sozlamalar"
            onPress={() => Alert.alert('Info', 'Sozlamalar tez orada')}
          />
          <Divider />
          <MenuItem
            icon={HelpCircle}
            label="Yordam"
            onPress={() => Alert.alert('Yordam', 'Support: support@marketflow.uz')}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            marginTop: Spacing.xl,
            backgroundColor: Colors.dangerLight,
            padding: Spacing.md,
            borderRadius: Radius.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
          }}
        >
          <LogOut color={Colors.danger} size={18} />
          <Text style={{ color: Colors.danger, fontWeight: '600', fontSize: FontSize.base }}>
            Chiqish
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            textAlign: 'center',
            color: Colors.slate400,
            fontSize: FontSize.xs,
            marginTop: Spacing.xxxl,
          }}
        >
          MarketFlow v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon: Icon, label, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.md,
      }}
    >
      <Icon color={Colors.slate600} size={20} />
      <Text style={{ flex: 1, fontSize: FontSize.base, fontWeight: '500' }}>{label}</Text>
      <ChevronRight color={Colors.slate400} size={18} />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.slate100, marginLeft: Spacing.md + 20 + Spacing.md }} />;
}
