import * as ImagePicker from 'expo-image-picker';
import { API_URL } from './api';
import { useAuthStore } from '@/store/auth.store';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  type?: string;
  fileName?: string;
}

/**
 * Kameradan rasm olish
 */
export async function takePhotoFromCamera(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Kameraga ruxsat berilmagan');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0];
}

/**
 * Galereyadan rasm(lar) tanlash
 */
export async function pickFromGallery(maxCount = 5): Promise<PickedImage[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Galereyaga ruxsat berilmagan');
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: maxCount,
    quality: 0.8,
  });

  if (result.canceled) return [];
  return result.assets;
}

/**
 * Rasm URI'sini backend'dagi upload proxy orqali UploadThing'ga yuklash
 */
export async function uploadImage(
  imageUri: string,
): Promise<{ url: string; fileKey: string } | null> {
  const token = useAuthStore.getState().accessToken;

  const formData = new FormData();
  const filename = imageUri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  // React Native FormData file
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  const res = await fetch(`${API_URL.replace('/api', '')}/api/uploadthing/mobile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    console.error('Upload failed:', await res.text());
    return null;
  }

  const data = await res.json();
  return { url: data.url, fileKey: data.fileKey };
}
