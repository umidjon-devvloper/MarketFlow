import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Camera, ImageIcon, Trash2 } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { takePhotoFromCamera, pickFromGallery, uploadImage } from '@/lib/images';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const schema = z.object({
  title: z.string().min(3, 'Nom kamida 3 harf'),
  description: z.string().min(10, 'Ta\'rif kamida 10 harf'),
  category: z.string().min(1, 'Kategoriya tanlang'),
  brand: z.string().optional(),
  basePrice: z.coerce.number().positive('Narx musbat'),
  stock: z.coerce.number().int().min(0),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  'Kiyim-kechak',
  'Poyabzal',
  'Elektronika',
  'Uy-ro\'zg\'or',
  'Kosmetika',
  'Sport',
  'Boshqa',
];

interface UploadedImage {
  url: string;
  fileKey: string;
  localUri?: string;
  uploading?: boolean;
}

export default function NewProduct() {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { stock: 0 },
  });

  const selectedCategory = watch('category');

  const handleAddImage = async (source: 'camera' | 'gallery') => {
    if (images.length >= 5) {
      Alert.alert('Maksimum', 'Maksimum 5 ta rasm');
      return;
    }

    const pickedImages =
      source === 'camera'
        ? [(await takePhotoFromCamera())].filter(Boolean)
        : await pickFromGallery(5 - images.length);

    if (pickedImages.length === 0) return;

    // Har birini uploadga qo'yamiz
    for (const pic of pickedImages) {
      if (!pic) continue;
      // Vaqtincha placeholder
      const tempKey = Math.random().toString(36);
      setImages((prev) => [
        ...prev,
        { url: pic.uri, fileKey: tempKey, localUri: pic.uri, uploading: true },
      ]);

      // Backend'ga yuklash
      const uploaded = await uploadImage(pic.uri);
      if (uploaded) {
        setImages((prev) =>
          prev.map((img) =>
            img.fileKey === tempKey ? { ...uploaded, localUri: pic.uri, uploading: false } : img,
          ),
        );
      } else {
        setImages((prev) => prev.filter((img) => img.fileKey !== tempKey));
        Alert.alert('Xato', `${pic.fileName || 'rasm'} yuklanmadi`);
      }
    }
  };

  const removeImage = (fileKey: string) => {
    setImages((prev) => prev.filter((i) => i.fileKey !== fileKey));
  };

  const onSubmit = async (data: FormData) => {
    const uploadedImages = images.filter((i) => !i.uploading);
    if (uploadedImages.length === 0) {
      Alert.alert('Rasm', 'Kamida bitta rasm yuklang');
      return;
    }

    setSaving(true);
    try {
      // 1. Mahsulot yaratish
      const { data: productRes } = await api.post('/products', {
        ...data,
        currency: 'UZS',
      });
      const productId = productRes.product.id;

      // 2. Rasmlarni bog'lash
      for (let i = 0; i < uploadedImages.length; i++) {
        await api.post(`/products/${productId}/images`, {
          url: uploadedImages[i].url,
          fileKey: uploadedImages[i].fileKey,
          isPrimary: i === 0,
          order: i,
        });
      }

      router.replace(`/products/${productId}`);
    } catch (err: any) {
      Alert.alert('Xato', err.response?.data?.error || 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: Colors.slate300,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    backgroundColor: Colors.white,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: Spacing.md,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.slate200,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <X color={Colors.slate700} size={22} />
        </TouchableOpacity>
        <Text style={{ fontSize: FontSize.lg, fontWeight: '600' }}>Yangi mahsulot</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
          {/* Images */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.sm }}>
              Rasmlar {images.length}/5
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {images.map((img, i) => (
                <View key={img.fileKey} style={{ width: '31%', aspectRatio: 1 }}>
                  <Image
                    source={{ uri: img.localUri || img.url }}
                    style={{ width: '100%', height: '100%', borderRadius: Radius.md, backgroundColor: Colors.slate100 }}
                  />
                  {img.uploading && (
                    <View
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: Radius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator color={Colors.white} />
                    </View>
                  )}
                  {i === 0 && !img.uploading && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        backgroundColor: '#eab308',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ color: Colors.white, fontSize: 10, fontWeight: '600' }}>
                        Asosiy
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removeImage(img.fileKey)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: Colors.danger,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X color={Colors.white} size={12} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <>
                  <TouchableOpacity
                    onPress={() => handleAddImage('camera')}
                    style={{
                      width: '31%',
                      aspectRatio: 1,
                      backgroundColor: Colors.primaryLight,
                      borderRadius: Radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Camera color={Colors.primary} size={22} />
                    <Text style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: '500', marginTop: 4 }}>
                      Kamera
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAddImage('gallery')}
                    style={{
                      width: '31%',
                      aspectRatio: 1,
                      backgroundColor: Colors.slate100,
                      borderRadius: Radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ImageIcon color={Colors.slate600} size={22} />
                    <Text style={{ color: Colors.slate600, fontSize: FontSize.xs, fontWeight: '500', marginTop: 4 }}>
                      Galereya
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Form fields */}
          <View style={{ gap: Spacing.md }}>
            <View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                Nomi <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Masalan: Erkaklar ko'ylagi"
                    style={inputStyle}
                  />
                )}
              />
              {errors.title && (
                <Text style={{ color: Colors.danger, fontSize: FontSize.xs, marginTop: 2 }}>
                  {errors.title.message}
                </Text>
              )}
            </View>

            <View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                Ta'rif <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    multiline
                    numberOfLines={4}
                    placeholder="Mahsulot haqida..."
                    style={{ ...inputStyle, minHeight: 100, textAlignVertical: 'top' }}
                  />
                )}
              />
              {errors.description && (
                <Text style={{ color: Colors.danger, fontSize: FontSize.xs, marginTop: 2 }}>
                  {errors.description.message}
                </Text>
              )}
            </View>

            <View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                Kategoriya <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setValue('category', cat)}
                    style={{
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.sm,
                      borderRadius: Radius.full,
                      backgroundColor: selectedCategory === cat ? Colors.primary : Colors.white,
                      borderWidth: 1,
                      borderColor: selectedCategory === cat ? Colors.primary : Colors.slate300,
                    }}
                  >
                    <Text
                      style={{
                        color: selectedCategory === cat ? Colors.white : Colors.slate700,
                        fontSize: FontSize.sm,
                        fontWeight: '500',
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.category && (
                <Text style={{ color: Colors.danger, fontSize: FontSize.xs, marginTop: 2 }}>
                  {errors.category.message}
                </Text>
              )}
            </View>

            <View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                Brend
              </Text>
              <Controller
                control={control}
                name="brand"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Nike, Samsung..."
                    style={inputStyle}
                  />
                )}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                  Narx (UZS) <Text style={{ color: Colors.danger }}>*</Text>
                </Text>
                <Controller
                  control={control}
                  name="basePrice"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value?.toString() || ''}
                      onChangeText={(v) => onChange(v ? parseInt(v) : 0)}
                      keyboardType="numeric"
                      placeholder="150000"
                      style={inputStyle}
                    />
                  )}
                />
                {errors.basePrice && (
                  <Text style={{ color: Colors.danger, fontSize: FontSize.xs, marginTop: 2 }}>
                    {errors.basePrice.message}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs }}>
                  Zaxira
                </Text>
                <Controller
                  control={control}
                  name="stock"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value?.toString() || '0'}
                      onChangeText={(v) => onChange(v ? parseInt(v) : 0)}
                      keyboardType="numeric"
                      placeholder="0"
                      style={inputStyle}
                    />
                  )}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={saving}
            style={{
              backgroundColor: Colors.primary,
              paddingVertical: Spacing.md,
              borderRadius: Radius.md,
              alignItems: 'center',
              marginTop: Spacing.xl,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={{ color: Colors.white, fontSize: FontSize.base, fontWeight: '600' }}>
                Saqlash
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
