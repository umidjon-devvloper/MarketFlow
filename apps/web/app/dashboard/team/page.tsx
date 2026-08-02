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
      alert(err.response?.data?.error || 'Xato');
    }
  }

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`${name} ni tashkilotdan chiqarmoqchimisiz?`)) return;
    try {
      await api.delete(`/orgs/current/members/${memberId}`);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Xato');
    }
  }

  async function handleRevokeInvite(id: string) {
    if (!confirm('Taklifni bekor qilmoqchimisiz?')) return;
    try {
      await api.delete(`/orgs/current/invitations/${id}`);
      loadAll();
    } catch (err) {
      alert('Xato');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Jamoa</h1>
          <p className="text-slate-600 mt-1">Tashkilot a'zolarini boshqaring</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Xodim taklif qilish
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-500">Yuklanmoqda...</div>
      ) : (
        <div className="space-y-6">
          {/* A'zolar */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h2 className="font-semibold">A'zolar ({members.length})</h2>
            </div>
            <div className="divide-y">
              {members.map((m) => {
                const info = ROLE_INFO[m.role];
                const Icon = info.icon;
                return (
                  <div key={m.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {m.user.avatar ? (
                        <img
                          src={m.user.avatar}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="font-semibold text-sm">
                          {m.user.fullName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{m.user.fullName}</p>
                      <p className="text-sm text-slate-500 truncate">{m.user.email}</p>
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
                            className="p-1.5 hover:bg-red-50 rounded text-red-600"
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
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-slate-50">
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
                      <p className="text-xs text-slate-500">
                        {new Date(inv.createdAt).toLocaleDateString('uz-UZ')} da yuborilgan •{' '}
                        {inv.sender.fullName}
                      </p>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                      Kutilmoqda
                    </span>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="p-1.5 hover:bg-red-50 rounded text-red-600"
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
      alert(err.response?.data?.error || 'Xato');
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
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Xodim taklif qilish</h2>
          <p className="text-sm text-slate-600">Yangi jamoa a'zosini email orqali chaqiring</p>
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
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="employee@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'ADMIN' | 'STAFF')}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="STAFF">Xodim — mahsulot yaratish/tahrirlash</option>
                <option value="ADMIN">Admin — to'liq boshqaruv (o'chirishdan tashqari)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-slate-300 py-2 rounded-lg font-medium hover:bg-slate-50"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Taklif jo'natish
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">✅ Taklif yaratildi!</p>
              <p className="text-xs text-green-700">
                Quyidagi havolani xodimga jo'nating. U 7 kun amal qiladi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">
                Taklif havolasi
              </label>
              <div className="flex gap-2">
                <input
                  value={newInviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg text-xs bg-slate-50 font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 border rounded-lg hover:bg-slate-50"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Yopish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
