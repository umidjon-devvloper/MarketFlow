'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function NewOrganizationPage() {
  const router = useRouter();
  const { organizations, setOrganizations, setCurrentOrg } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/orgs', { name, description });
      const newOrg = {
        id: data.organization.id,
        name: data.organization.name,
        slug: data.organization.slug,
        logo: data.organization.logo,
        role: 'OWNER' as const,
      };
      setOrganizations([...organizations, newOrg]);
      setCurrentOrg(newOrg.id);
      router.push('/dashboard');
      setTimeout(() => window.location.reload(), 100);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Xato');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {organizations.length > 0 && (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Ortga
          </Link>
        )}

        <div className="bg-white p-8 rounded-xl border">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold mb-1">Yangi tashkilot</h1>
            <p className="text-slate-600 text-sm">
              Kompaniya yoki jamoangiz uchun ish maydonini yarating
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tashkilot nomi <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Masalan: Bukhara Fashion LLC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tavsif (ixtiyoriy)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Biznes haqida qisqacha..."
              />
            </div>

            <button
              type="submit"
              disabled={saving || !name}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Yaratish
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
