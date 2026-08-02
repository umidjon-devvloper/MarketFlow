'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Trash2, Plus, Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';

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
  icon: string;
  hint: string;
  fields: FieldConfig[];
}> = [
  {
    id: 'UZUM',
    name: 'Uzum Market',
    icon: '🛒',
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
    icon: '📦',
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
    icon: '🛍️',
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
    icon: '🏪',
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
  const queryClient = useQueryClient();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [showModal, setShowModal] = useState<Credential['marketplace'] | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['marketplaces', currentOrgId],
    queryFn: async () => (await api.get('/marketplaces')).data.items as Credential[],
    enabled: !!currentOrgId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['marketplaces', currentOrgId] });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} ulanishini o'chirmoqchimisiz?`)) return;
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
        <h1 className="text-3xl font-bold">Marketplace'lar</h1>
        <p className="text-slate-600 mt-1">
          Har bir marketplace uchun API kalit yoki hisob ma'lumotlarini kiriting
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MARKETPLACES.map((mp) => (
            <div key={mp.id} className="bg-white p-6 rounded-xl border animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MARKETPLACES.map((mp) => {
            const cred = getCred(mp.id);
            return (
              <div key={mp.id} className="bg-white p-6 rounded-xl border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{mp.icon}</span>
                    <div>
                      <h3 className="font-semibold">{mp.name}</h3>
                      {cred?.shopName ? (
                        <p className="text-sm text-slate-600">{cred.shopName}</p>
                      ) : (
                        <p className="text-xs text-slate-400">{mp.hint}</p>
                      )}
                    </div>
                  </div>
                  {cred ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  )}
                </div>

                {cred ? (
                  <div className="space-y-2">
                    <Link
                      href={`/dashboard/marketplaces/${cred.id}`}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ma'lumotlarni ko'rish
                    </Link>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(cred.id)}
                        disabled={testing === cred.id}
                        className="flex-1 border border-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {testing === cred.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        Test qilish
                      </button>
                      <button
                        onClick={() => setShowModal(mp.id)}
                        className="flex-1 border border-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                      >
                        Yangilash
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id, mp.name)}
                        className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowModal(mp.id)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{mp.icon}</span>
            <div>
              <h2 className="text-lg font-semibold">{mp.name} ulash</h2>
              <p className="text-sm text-slate-600">{mp.hint}</p>
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
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={field.placeholder}
                required={field.required}
              />
              {field.hint && <p className="text-xs text-slate-500 mt-1">{field.hint}</p>}
              {field.secret && (
                <p className="text-xs text-slate-500 mt-1">Shifrlanadi va xavfsiz saqlanadi</p>
              )}
            </div>
          ))}

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
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
