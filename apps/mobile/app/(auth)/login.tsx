import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const schema = z.object({
  email: z.string().email('Email noto\'g\'ri'),
  password: z.string().min(6, 'Parol kamida 6 belgi'),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.organizations || [], res.data.accessToken, res.data.refreshToken);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Xato', err.response?.data?.error || 'Kirish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' }}
        >
          <View style={{ alignItems: 'center', marginBottom: Spacing.xxxl }}>
            <Text style={{ fontSize: 36, fontWeight: 'bold' }}>
              Market<Text style={{ color: Colors.primary }}>Flow</Text>
            </Text>
            <Text style={{ fontSize: FontSize.lg, marginTop: Spacing.md, fontWeight: '600' }}>
              Kirish
            </Text>
            <Text style={{ fontSize: FontSize.sm, color: Colors.slate500, marginTop: Spacing.xs }}>
              Hisobingizga kiring
            </Text>
          </View>

          <View style={{ gap: Spacing.lg }}>
            <View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                Email
              </Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    style={{
                      borderWidth: 1,
                      borderColor: Colors.slate300,
                      borderRadius: Radius.md,
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.md,
                      fontSize: FontSize.base,
                    }}
                  />
                )}
              />
              {errors.email && (
                <Text style={{ color: Colors.danger, fontSize: FontSize.xs, marginTop: Spacing.xs }}>
                  {errors.email.message}
                </Text>
              )}
            </View>

            <View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                Parol
              </Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry
                    placeholder="••••••"
                    style={{
                      borderWidth: 1,
                      borderColor: Colors.slate300,
                      borderRadius: Radius.md,
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.md,
                      fontSize: FontSize.base,
                    }}
                  />
                )}
              />
              {errors.password && (
                <Text style={{ color: Colors.danger, fontSize: FontSize.xs, marginTop: Spacing.xs }}>
                  {errors.password.message}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
              style={{
                backgroundColor: Colors.primary,
                paddingVertical: Spacing.md,
                borderRadius: Radius.md,
                alignItems: 'center',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={{ color: Colors.white, fontSize: FontSize.base, fontWeight: '600' }}>
                  Kirish
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs }}>
              <Text style={{ color: Colors.slate600, fontSize: FontSize.sm }}>
                Hisobingiz yo'qmi?
              </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm }}>
                    Ro'yxatdan o'ting
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
