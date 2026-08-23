'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Trash2, Plus, Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { QueryError } from '@/components/QueryError';
import { RemoteImage } from '@/components/RemoteImage';

interface Credential {
  id: string;
  marketplace: 'UZUM' | 'OZON' | 'WB' | 'YANDEX';
  shopId?: string;
  shopName?: string;
  isActive: boolean;
  createdAt: string;
}

interface FieldConfig {
  key: 'apiKey' | 'apiSecret' | 'shopId' | 'shopName';
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  secret?: boolean;
}

// Har bir marketplace'ning autentifikatsiyasi har xil — maydonlar shunga mos
const MARKETPLACES: Array<{
  id: Credential['marketplace'];
  name: string;
  logo: string;
  color: string;
  hint: string;
  fields: FieldConfig[];
}> = [
  {
    id: 'UZUM',
    name: 'Uzum Market',
    logo: '/logos/uzum.jpg',
    color: '#7000FF',
    hint: "Kalit: business.uzum.uz → Sozlamalar → API kalitlari",
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'eyJhbGciOi...',
        required: true,
        secret: true,
        hint: "Do'kon ID/nomi testda avtomatik aniqlanadi",
      },
    ],
  },
  {
    id: 'OZON',
    name: 'Ozon',
    logo: '/logos/ozon.jpg',
    color: '#005BFF',
    hint: 'Kalit: seller.ozon.ru → Настройки → API-ключи',
    fields: [
      { key: 'apiKey', label: 'Api-Key', required: true, secret: true },
      {
        key: 'apiSecret',
        label: 'Client-Id',
        placeholder: '123456',
        required: true,
        hint: 'Kabinet raqami (API-ключи sahifasida ko\'rsatiladi)',
      },
    ],
  },
  {
    id: 'WB',
    name: 'Wildberries',
    logo: '/logos/wildberries.jpg',
    color: '#CB11AB',
    hint: 'Kalit: seller.wildberries.ru → Настройки → Доступ к API',
    fields: [
      {
        key: 'apiKey',
        label: 'API Token',
        required: true,
        secret: true,
        hint: "Token'ga Контент + Статистика ruxsatlarini bering",
      },
    ],
  },
  {
    id: 'YANDEX',
    name: 'Yandex Market',
    logo: '/logos/yandex.jpg',
    color: '#FC3F1D',
    hint: 'Kalit: partner.market.yandex.ru → Настройки → API-ключи',
    fields: [
      { key: 'apiKey', label: 'Api-Key', required: true, secret: true },
      {
        key: 'shopId',
        label: 'Campaign ID (ixtiyoriy)',
        placeholder: '21234567',
        hint: "Bo'sh qoldirsangiz testda avtomatik aniqlanadi",
      },
    ],
  },
];

export default function MarketplacesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [showModal, setShowModal] = useState<Credential['marketplace'] | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const {
    data: credentials = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['marketplaces', currentOrgId],
    queryFn: async () => (await api.get('/marketplaces')).data.items as Credential[],
    enabled: !!currentOrgId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['marketplaces', currentOrgId] });

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `${name} ulanishi uzilsinmi?`,
      description:
        "Saqlangan API kalit o'chadi va bu marketplace bo'yicha sinxronizatsiya to'xtaydi. Kartochkalaringiz joyida qoladi.",
      confirmLabel: 'Ha, uzilsin',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/marketplaces/${id}`);
      refresh();
      toast('success', `${name} ulanishi o'chirildi`);
    } catch {
      toast('error', "O'chirishda xato yuz berdi");
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const { data } = await api.post(`/marketplaces/${id}/test`);
      toast(data.success ? 'success' : 'error', data.message);
      if (data.success) refresh();
    } catch (err: any) {
      toast('error', 'Test xatosi: ' + (err.response?.data?.error || err.message));
    } finally {
      setTesting(null);
    }
  }

  const getCred = (mp: string) => credentials.find((c) => c.marketplace === mp);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[30px] font-bold tracking-tight">Marketplace'lar</h1>
        <p className="text-muted mt-1">
          Har bir marketplace uchun API kalit yoki hisob ma'lumotlarini kiriting
        </p>
      </div>

      {/* Xato bo'lsa kartalar "ulanmagan" bo'lib ko'rinadi — sababini aytamiz */}
      {isError && <QueryError error={error} onRetry={() => refetch()} className="mb-4" />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MARKETPLACES.map((mp) => (
            <div key={mp.id} className="card p-6 animate-pulse h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MARKETPLACES.map((mp) => {
            const cred = getCred(mp.id);
            return (
              <div key={mp.id} className="card p-6 hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-12 h-12 rounded-full overflow-hidden border border-line flex-shrink-0 flex items-center justify-center bg-paper"
                      style={{ boxShadow: `inset 0 0 0 2px ${mp.color}1a` }}
                    >
                      <RemoteImage src={mp.logo} alt={mp.name} fit="contain" sizes="48px" className="w-full h-full" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{mp.name}</h3>
                      {cred?.shopName ? (
                        <p className="text-sm text-ink-soft">{cred.shopName}</p>
                      ) : (
                        <p className="text-xs text-muted">{mp.hint}</p>
                      )}
                    </div>
                  </div>
                  {cred ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted/50 flex-shrink-0" />
                  )}
                </div>

                {cred ? (
                  <div className="space-y-2">
                    <Link
                      href={`/dashboard/marketplaces/${cred.id}`}
                      className="btn-primary btn-sm w-full"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ma'lumotlarni ko'rish
                    </Link>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(cred.id)}
                        disabled={testing === cred.id}
                        className="btn-ghost btn-sm flex-1 disabled:opacity-50"
                      >
                        {testing === cred.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        Test qilish
                      </button>
                      <button
                        onClick={() => setShowModal(mp.id)}
                        className="btn-ghost btn-sm flex-1"
                      >
                        Yangilash
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id, mp.name)}
                        aria-label={`${mp.name} ulanishini uzish`}
                        className="px-4 border border-red-500/30 text-red-600 rounded-full transition hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowModal(mp.id)}
                    className="btn-primary btn-sm w-full"
                  >
                    <Plus className="w-4 h-4" />
                    Ulash
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CredentialsModal
          marketplace={showModal}
          onClose={() => setShowModal(null)}
          onSaved={() => {
            setShowModal(null);
            refresh();
            toast('success', "Saqlandi — endi 'Test qilish' bilan tekshiring");
          }}
        />
      )}
    </div>
  );
}

// ==================== MODAL ====================
function CredentialsModal({
  marketplace,
  onClose,
  onSaved,
}: {
  marketplace: Credential['marketplace'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const mp = MARKETPLACES.find((m) => m.id === marketplace)!;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    apiKey: '',
    apiSecret: '',
    shopId: '',
    shopName: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/marketplaces', {
        marketplace,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret || undefined,
        shopId: form.shopId || undefined,
        shopName: form.shopName || undefined,
      });
      onSaved();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <div className="p-6 border-b border-line">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full overflow-hidden border border-line flex-shrink-0 flex items-center justify-center bg-paper">
              <RemoteImage src={mp.logo} alt={mp.name} fit="contain" sizes="48px" className="w-full h-full" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{mp.name} ulash</h2>
              <p className="text-sm text-muted">{mp.hint}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mp.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <input
                type={field.secret ? 'password' : 'text'}
                value={form[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-[14px] border border-line bg-paper/70 text-sm transition focus:outline-none focus:border-accent/50"
                placeholder={field.placeholder}
                required={field.required}
              />
              {field.hint && <p className="text-xs text-muted mt-1">{field.hint}</p>}
              {field.secret && (
                <p className="text-xs text-muted mt-1">Shifrlanadi va xavfsiz saqlanadi</p>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost btn-sm flex-1"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary btn-sm flex-1 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
