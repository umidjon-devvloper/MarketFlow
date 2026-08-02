import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  setAuth: (
    user: User,
    organizations: Organization[],
    accessToken: string,
    refreshToken: string,
  ) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  setCurrentOrg: (orgId: string) => void;
  setOrganizations: (organizations: Organization[]) => void;
  logout: () => void;

  // Helpers
  currentOrg: () => Organization | null;
  hasRole: (...roles: Array<'OWNER' | 'ADMIN' | 'STAFF'>) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organizations: [],
      currentOrgId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

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

      setUser: (user) => set({ user }),

      setCurrentOrg: (orgId) => set({ currentOrgId: orgId }),

      setOrganizations: (organizations) => {
        const current = get().currentOrgId;
        const stillExists = organizations.some((o) => o.id === current);
        set({
          organizations,
          currentOrgId: stillExists ? current : organizations[0]?.id || null,
        });
      },

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
      version: 1,
      // v0 da setAuth argumentlari siljigan edi — organizations o'rniga token
      // saqlanib qolgan bo'lishi mumkin. Buzilgan holatni tozalaymiz.
      migrate: (persisted: any) => {
        if (!persisted || !Array.isArray(persisted.organizations)) {
          return {
            user: null,
            organizations: [],
            currentOrgId: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          };
        }
        return persisted;
      },
    },
  ),
);
