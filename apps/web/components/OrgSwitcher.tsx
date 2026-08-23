'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Building2, Plus, Check, Crown, Shield, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { RemoteImage } from '@/components/RemoteImage';

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
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-line bg-paper hover:bg-panel transition text-left"
      >
        <div className="w-8 h-8 bg-accent-soft rounded-lg flex items-center justify-center flex-shrink-0">
          {current.logo ? (
            <RemoteImage src={current.logo} alt="" sizes="32px" className="w-full h-full rounded" />
          ) : (
            <Building2 className="w-4 h-4 text-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{current.name}</p>
          <div className="flex items-center gap-1 text-[11px] text-muted">
            {ROLE_ICONS[current.role]}
            <span>{ROLE_LABELS[current.role]}</span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-paper border border-line rounded-xl shadow-card py-1.5 z-50 max-h-80 overflow-auto">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-panel transition text-left"
            >
              <div className="w-6 h-6 bg-panel rounded-md flex items-center justify-center flex-shrink-0">
                {org.logo ? (
                  <RemoteImage src={org.logo} alt="" sizes="24px" className="w-full h-full rounded" />
                ) : (
                  <Building2 className="w-3 h-3 text-ink-soft" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{org.name}</p>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  {ROLE_ICONS[org.role]}
                  <span>{ROLE_LABELS[org.role]}</span>
                </div>
              </div>
              {org.id === currentOrgId && <Check className="w-4 h-4 text-accent" />}
            </button>
          ))}

          <div className="border-t border-line mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                router.push('/dashboard/organizations/new');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-panel transition text-accent text-sm"
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
