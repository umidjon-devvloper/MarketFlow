import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
}

interface AuthState {
  user: User | null;
  organizations: Organization[];
  currentOrgId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  setAuth: (user: User, organizations: Organization[], accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setCurrentOrg: (orgId: string) => void;
  setOrganizations: (organizations: Organization[]) => void;
  setHydrated: () => void;
  logout: () => void;

  currentOrg: () => Organization | null;
  hasRole: (...roles: Array<'OWNER' | 'ADMIN' | 'STAFF'>) => boolean;
}

// SecureStore adapter for zustand
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organizations: [],
      currentOrgId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,

      setAuth: (user, organizations, accessToken, refreshToken) =>
        set({
          user,
          organizations,
          currentOrgId: organizations[0]?.id || null,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setCurrentOrg: (orgId) => set({ currentOrgId: orgId }),

      setOrganizations: (organizations) => {
        const current = get().currentOrgId;
        const stillExists = organizations.some((o) => o.id === current);
        set({
          organizations,
          currentOrgId: stillExists ? current : organizations[0]?.id || null,
        });
      },

      setHydrated: () => set({ isHydrated: true }),

      logout: () =>
        set({
          user: null,
          organizations: [],
          currentOrgId: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      currentOrg: () => {
        const s = get();
        return s.organizations.find((o) => o.id === s.currentOrgId) || null;
      },

      hasRole: (...roles) => {
        const org = get().currentOrg();
        return org ? roles.includes(org.role) : false;
      },
    }),
    {
      name: 'marketflow-auth',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
