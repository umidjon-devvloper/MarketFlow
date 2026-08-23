'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, Check, X, Mail, Shield, CalendarClock, UserRound } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { AppBackground } from '@/components/AppBackground';
import { RemoteImage } from '@/components/RemoteImage';

interface InvitationData {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  organization: { name: string; logo?: string };
  sender: { fullName: string };
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const token = params.token as string;

  const { isAuthenticated, user } = useAuthStore();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadInvitation() {
    try {
      // Public endpoint, auth header shart emas
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/invitations/${token}`,
      );
      setInvitation(data.invitation);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Taklif topilmadi');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!isAuthenticated) {
      // Login sahifasiga yuborish, keyin qaytish
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    if (user?.email.toLowerCase() !== invitation?.email.toLowerCase()) {
      toast(
        'error',
        `Bu taklif ${invitation?.email} uchun yuborilgan, siz esa ${user?.email} bilan kirgansiz. Kerakli akkaunt bilan qayta kiring.`,
      );
      return;
    }

    setAccepting(true);
    try {
      await api.post(`/invitations/${token}/accept`);
      toast('success', "Tashkilotga qo'shildingiz");
      // Tashkilotlar ro'yxati auth store'da keshlangan — to'liq qayta yuklash kerak
      router.push('/dashboard');
      setTimeout(() => window.location.reload(), 400);
    } catch (err: any) {
      toast('error', err.response?.data?.error || "Taklifni qabul qilib bo'lmadi");
      setAccepting(false);
    }
  }

  // ── Yuklanmoqda ─────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="card p-8 w-full max-w-md">
          <div className="w-16 h-16 rounded-full bg-panel mx-auto mb-5 animate-pulse" />
          <div className="h-5 w-2/3 bg-panel rounded mx-auto mb-2.5 animate-pulse" />
          <div className="h-4 w-1/3 bg-panel rounded mx-auto mb-7 animate-pulse" />
          <div className="h-32 bg-panel rounded-[18px] mb-6 animate-pulse" />
          <div className="h-12 bg-panel rounded-full animate-pulse" />
        </div>
      </Shell>
    );
  }

  // ── Xato ────────────────────────────────────────────────
  if (error || !invitation) {
    return (
      <Shell>
        <div className="card p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Taklif topilmadi</h1>
          {/* Server ham "Taklif topilmadi" qaytaradi — sarlavhani takrorlamaymiz,
              o'rniga foydalanuvchi nima qilishi mumkinligini aytamiz */}
          <p className="text-ink-soft text-sm mb-6">
            {error && error !== 'Taklif topilmadi'
              ? error
              : "Havola noto'g'ri, muddati tugagan yoki taklif bekor qilingan. Tashkilot egasidan yangi havola so'rang."}
          </p>
          <Link href="/" className="btn-ghost btn-sm">
            Bosh sahifaga qaytish
          </Link>
        </div>
      </Shell>
    );
  }

  const expired = new Date(invitation.expiresAt).getTime() < Date.now();

  return (
    <Shell>
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-4 overflow-hidden">
            {invitation.organization.logo ? (
              <RemoteImage
                src={invitation.organization.logo}
                alt=""
                sizes="64px"
                className="w-full h-full"
              />
            ) : (
              <Building2 className="w-8 h-8 text-accent" />
            )}
          </div>
          <h1 className="text-xl font-bold mb-1">{invitation.organization.name}</h1>
          <p className="text-ink-soft text-sm">tashkilotiga taklif</p>
        </div>

        <dl className="rounded-[18px] border border-line bg-panel p-4 mb-6 space-y-2.5 text-sm">
          <Row icon={UserRound} label="Sizni taklif etgan" value={invitation.sender.fullName} />
          <Row icon={Mail} label="Email" value={invitation.email} />
          <Row
            icon={Shield}
            label="Rol"
            value={invitation.role === 'ADMIN' ? 'Admin' : 'Xodim'}
          />
          <Row
            icon={CalendarClock}
            label="Amal qiladi"
            value={`${new Date(invitation.expiresAt).toLocaleDateString('uz-UZ')} gacha`}
            warn={expired}
          />
        </dl>

        {expired && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-4 text-center">
            Havola muddati tugagan — tashkilot egasidan yangisini so'rang.
          </p>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleAccept}
            disabled={accepting || expired}
            className="btn-primary w-full disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Taklifni qabul qilish
          </button>
        ) : (
          <div className="space-y-2.5">
            <Link
              href={`/register?invite=${token}&email=${encodeURIComponent(invitation.email)}`}
              className="btn-primary w-full"
            >
              Ro&apos;yxatdan o&apos;tish (yangi)
            </Link>
            <Link href={`/login?redirect=/invite/${token}`} className="btn-ghost w-full">
              Kirish (akkauntim bor)
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

/** Taklif sahifasining umumiy karkasi — dashboard bilan bir xil fon */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-ink">
      <AppBackground />
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted min-w-0">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{label}:</span>
      </dt>
      <dd
        className={`font-medium text-right truncate ${
          warn ? 'text-amber-700 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
