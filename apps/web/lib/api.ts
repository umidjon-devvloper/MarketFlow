import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Har so'rovga token va org ID qo'shish
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const state = useAuthStore.getState();

  if (config.headers) {
    if (state.accessToken) {
      config.headers.Authorization = `Bearer ${state.accessToken}`;
    }
    if (state.currentOrgId) {
      config.headers['X-Organization-Id'] = state.currentOrgId;
    }
  }

  return config;
});

// Refresh token oqimi
let isRefreshing = false;
/**
 * Token yangilanayotganda kutib turgan so'rovlar.
 *
 * Avval bu yerda faqat `resolve` saqlanardi: yangilash MUVAFFAQIYATSIZ
 * bo'lsa navbat hech qachon bo'shatilmasdi va kutayotgan so'rovlar abadiy
 * osilib qolardi. Sahifada bir vaqtda 10+ so'rov ketadi, shuning uchun
 * natija "hech narsa yuklanmayapti" bo'lib ko'rinardi.
 */
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function flushQueue(token: string | null, error?: unknown) {
  const queue = refreshQueue;
  refreshQueue = [];
  for (const item of queue) {
    if (token) item.resolve(token);
    else item.reject(error);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        isRefreshing = false;
        flushQueue(null, error);
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
          refreshToken,
        });
        useAuthStore.getState().setAccessToken(data.accessToken);
        flushQueue(data.accessToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Kutayotganlarni ham bo'shatamiz — aks holda sahifa "yuklanmoqda"
        // holatida qotib qoladi
        flushQueue(null, refreshError);
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
