'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Building2, Plus, Check, Crown, Shield, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const ROLE_ICONS = {
  OWNER: <Crown className="w-3 h-3" />,
  ADMIN: <Shield className="w-3 h-3" />,
  STAFF: <User className="w-3 h-3" />,
};

const ROLE_LABELS = {
  OWNER: 'Rahbar',
  ADMIN: 'Admin',
  STAFF: 'Xodim',
};

export function OrgSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organizations, currentOrgId, setCurrentOrg } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = organizations.find((o) => o.id === currentOrgId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!current) return null;

  const handleSwitch = (orgId: string) => {
    setCurrentOrg(orgId);
    setOpen(false);
    // To'liq reload o'rniga eski tashkilot keshini tozalaymiz —
    // query key'larda orgId bor, ma'lumotlar o'zi qayta yuklanadi.
    queryClient.clear();
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50 text-left"
      >
        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
          {current.logo ? (
            <img src={current.logo} alt="" className="w-full h-full rounded object-cover" />
          ) : (
            <Building2 className="w-4 h-4 text-blue-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{current.name}</p>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {ROLE_ICONS[current.role]}
            <span>{ROLE_LABELS[current.role]}</span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg py-1 z-50 max-h-80 overflow-auto">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
            >
              <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                {org.logo ? (
                  <img src={org.logo} alt="" className="w-full h-full rounded object-cover" />
                ) : (
                  <Building2 className="w-3 h-3 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{org.name}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  {ROLE_ICONS[org.role]}
                  <span>{ROLE_LABELS[org.role]}</span>
                </div>
              </div>
              {org.id === currentOrgId && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}

          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                router.push('/dashboard/organizations/new');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-blue-600 text-sm"
            >
              <Plus className="w-4 h-4" />
              Yangi tashkilot yaratish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
