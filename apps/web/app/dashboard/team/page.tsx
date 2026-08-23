'use client';

import { useEffect, useState } from 'react';
import {
  Crown,
  Shield,
  User,
  UserPlus,
  Trash2,
  Mail,
  Copy,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { SkeletonRows } from '@/components/Skeleton';
import { Avatar } from '@/components/RemoteImage';

interface Member {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatar?: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  sender: { fullName: string; email: string };
}

const ROLE_INFO = {
  OWNER: { label: 'Rahbar', icon: Crown, color: 'yellow' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'blue' },
  STAFF: { label: 'Xodim', icon: User, color: 'slate' },
};

export default function TeamPage() {
  const { hasRole } = useAuthStore();
  const canManage = hasRole('OWNER', 'ADMIN');
  const isOwner = hasRole('OWNER');

  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        api.get('/orgs/current/members'),
        canManage
          ? api.get('/orgs/current/invitations').catch(() => ({ data: { items: [] } }))
          : Promise.resolve({ data: { items: [] } }),
      ]);
      setMembers(mRes.data.items);
      setInvitations(iRes.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: 'ADMIN' | 'STAFF') {
    try {
      await api.patch(`/orgs/current/members/${memberId}`, { role: newRole });
      loadAll();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Xato yuz berdi');
    }
  }

  async function handleRemove(memberId: string, name: string) {
    const ok = await confirm({
      title: `${name} tashkilotdan chiqarilsinmi?`,
      description: "U endi tashkilot mahsulotlarini ko'ra olmaydi. Keyinroq qayta taklif qilish mumkin.",
      confirmLabel: 'Ha, chiqarilsin',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/orgs/current/members/${memberId}`);
      loadAll();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Xato yuz berdi');
    }
  }

  async function handleRevokeInvite(id: string) {
    const ok = await confirm({
      title: 'Taklif bekor qilinsinmi?',
      description: "Yuborilgan havola ishlamay qoladi. Kerak bo'lsa yangi taklif yuborasiz.",
      confirmLabel: 'Ha, bekor qilinsin',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/orgs/current/invitations/${id}`);
      loadAll();
    } catch (err) {
      toast('error', 'Xato yuz berdi');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Jamoa</h1>
          <p className="text-ink-soft mt-1">Tashkilot a'zolarini boshqaring</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Xodim taklif qilish
          </button>
        )}
      </div>

      {loading ? (
        <div className="card"><SkeletonRows rows={3} /></div>
      ) : (
        <div className="space-y-6">
          {/* A'zolar */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b bg-panel">
              <h2 className="font-semibold">A'zolar ({members.length})</h2>
            </div>
            <div className="divide-y">
              {members.map((m) => {
                const info = ROLE_INFO[m.role];
                const Icon = info.icon;
                return (
                  <div key={m.id} className="p-4 flex items-center gap-3">
                    <Avatar
                      src={m.user.avatar}
                      name={m.user.fullName}
                      className="w-10 h-10 bg-panel rounded-full flex-shrink-0 font-semibold text-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{m.user.fullName}</p>
                      <p className="text-sm text-muted truncate">{m.user.email}</p>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium bg-${info.color}-50 text-${info.color}-700 flex items-center gap-1`}
                    >
                      <Icon className="w-3 h-3" />
                      {info.label}
                    </div>

                    {canManage && m.role !== 'OWNER' && (
                      <div className="flex gap-1">
                        <select
                          value={m.role}
                          onChange={(e) =>
                            handleRoleChange(m.id, e.target.value as 'ADMIN' | 'STAFF')
                          }
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="STAFF">Xodim</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        {isOwner && (
                          <button
                            onClick={() => handleRemove(m.id, m.user.fullName)}
                            aria-label={`${m.user.fullName} ni tashkilotdan chiqarish`}
                            className="p-1.5 hover:bg-red-500/10 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kutilayotgan takliflar */}
          {canManage && invitations.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b bg-panel">
                <h2 className="font-semibold">Kutilayotgan takliflar ({invitations.length})</h2>
              </div>
              <div className="divide-y">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-xs text-muted">
                        {new Date(inv.createdAt).toLocaleDateString('uz-UZ')} da yuborilgan •{' '}
                        {inv.sender.fullName}
                      </p>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                      Kutilmoqda
                    </span>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      aria-label={`${inv.email} ga yuborilgan taklifni bekor qilish`}
                      className="p-1.5 hover:bg-red-500/10 rounded text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => {
            setShowInvite(false);
            setNewInviteUrl(null);
          }}
          onCreated={(url) => {
            setNewInviteUrl(url);
            loadAll();
          }}
          newInviteUrl={newInviteUrl}
        />
      )}
    </div>
  );
}

// ==================== INVITE MODAL ====================
function InviteModal({
  onClose,
  onCreated,
  newInviteUrl,
}: {
  onClose: () => void;
  onCreated: (url: string) => void;
  newInviteUrl: string | null;
}) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'STAFF'>('STAFF');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/orgs/current/invitations', { email, role });
      onCreated(data.inviteUrl);
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!newInviteUrl) return;
    navigator.clipboard.writeText(newInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-paper rounded-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Xodim taklif qilish</h2>
          <p className="text-sm text-ink-soft">Yangi jamoa a'zosini email orqali chaqiring</p>
        </div>

        {!newInviteUrl ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="employee@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'ADMIN' | 'STAFF')}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="STAFF">Xodim — mahsulot yaratish/tahrirlash</option>
                <option value="ADMIN">Admin — to'liq boshqaruv (o'chirishdan tashqari)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-line py-2 rounded-lg font-medium hover:bg-panel"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-accent text-white py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Taklif jo'natish
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">✅ Taklif yaratildi!</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Quyidagi havolani xodimga jo'nating. U 7 kun amal qiladi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-ink-soft">
                Taklif havolasi
              </label>
              <div className="flex gap-2">
                <input
                  value={newInviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg text-xs bg-panel font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 border rounded-lg hover:bg-panel"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-accent text-white py-2 rounded-lg font-medium hover:opacity-90"
            >
              Yopish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
