'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, Check, X } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

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
  const token = params.token as string;

  const { isAuthenticated, user } = useAuthStore();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadInvitation();
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
      alert(
        `Bu taklif ${invitation?.email} uchun. Sizniki: ${user?.email}. Iltimos, kerakli akkaunt bilan kiring.`,
      );
      return;
    }

    setAccepting(true);
    try {
      await api.post(`/invitations/${token}/accept`);
      alert('✅ Tashkilotga muvaffaqiyatli qo\'shildingiz!');
      // Login qaytadan qilish kerak - organizations ro'yxatini yangilash uchun
      router.push('/dashboard');
      setTimeout(() => window.location.reload(), 100);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Xato');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl border text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Taklif topilmadi</h1>
          <p className="text-slate-600 text-sm mb-6">{error || 'Havola noto\'g\'ri yoki muddati tugagan'}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            {invitation.organization.logo ? (
              <img
                src={invitation.organization.logo}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <Building2 className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h1 className="text-xl font-bold mb-1">{invitation.organization.name}</h1>
          <p className="text-slate-600 text-sm">tashkilotiga taklif</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Sizni taklif etgan:</span>
            <span className="font-medium">{invitation.sender.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Email:</span>
            <span className="font-medium">{invitation.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Rol:</span>
            <span className="font-medium">
              {invitation.role === 'ADMIN' ? 'Admin' : 'Xodim'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Amal qiladi:</span>
            <span className="font-medium">
              {new Date(invitation.expiresAt).toLocaleDateString('uz-UZ')} gacha
            </span>
          </div>
        </div>

        {isAuthenticated ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Taklifni qabul qilish
          </button>
        ) : (
          <div className="space-y-2">
            <Link
              href={`/register?invite=${token}&email=${encodeURIComponent(invitation.email)}`}
              className="block w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 text-center"
            >
              Ro'yxatdan o'tish (yangi)
            </Link>
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="block w-full border border-slate-300 py-3 rounded-lg font-medium hover:bg-slate-50 text-center"
            >
              Kirish (akkauntim bor)
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
