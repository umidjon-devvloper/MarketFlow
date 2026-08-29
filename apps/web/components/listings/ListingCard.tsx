'use client';

import { useState } from 'react';
import { Copy, Check, Edit2, Save, Loader2, Download, CopyPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { RemoteImage } from '@/components/RemoteImage';
import { statusLabel, statusClass } from '@/lib/listingStatus';
import { Listing, MARKETPLACE_INFO, MarketplaceId, errorText } from './constants';

interface Props {
  listing: Listing;
  /** Shu mahsulotda hali kartochkasi yo'q marketplace'lar — "nusxalash" uchun */
  missing: MarketplaceId[];
  onUpdate: () => void;
}

export function ListingCard({ listing, missing, onUpdate }: Props) {
  const info = MARKETPLACE_INFO[listing.marketplace];
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [form, setForm] = useState({
    title: listing.title,
    description: listing.description,
    seoKeywords: listing.seoKeywords || '',
    price: listing.price,
  });

  const resetForm = () =>
    setForm({
      title: listing.title,
      description: listing.description,
      seoKeywords: listing.seoKeywords || '',
      price: listing.price,
    });

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/listings/${listing.id}`, form);
      setEditing(false);
      toast('success', 'Saqlandi');
      onUpdate();
    } catch (err) {
      toast('error', errorText(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await api.get(`/listings/${listing.id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${listing.marketplace.toLowerCase()}-${listing.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast('error', `Eksport xatosi: ${errorText(err)}`);
    } finally {
      setExporting(false);
    }
  }

  /** Shu kartochkani qolgan marketplace'larga ko'chirish — AI'siz, bir zumda */
  async function handleCopyToOthers() {
    setCopying(true);
    try {
      const { data } = await api.post(`/listings/${listing.id}/copy-to`, {
        marketplaces: missing,
      });
      const names = data.created.map((m: MarketplaceId) => MARKETPLACE_INFO[m].short).join(', ');
      toast('success', `Nusxalandi: ${names}`);
      // Chegaraga sig'magan matnlar haqida alohida ogohlantiramiz
      for (const w of data.warnings as Array<{ marketplace: MarketplaceId; message: string }>) {
        toast('info', `${MARKETPLACE_INFO[w.marketplace].short}: ${w.message}`);
      }
      onUpdate();
    } catch (err) {
      toast('error', errorText(err));
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b bg-panel flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-10 h-10 rounded-xl overflow-hidden border border-line bg-paper flex items-center justify-center flex-shrink-0">
            <RemoteImage src={info.logo} alt={info.name} fit="contain" sizes="32px" className="w-full h-full" />
          </span>
          <span className="font-semibold truncate">{info.name}</span>
          <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${statusClass(listing.status)}`}>
            {statusLabel(listing.status)}
          </span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {!editing ? (
            <>
              {missing.length > 0 && (
                <button
                  onClick={handleCopyToOthers}
                  disabled={copying}
                  className="p-1.5 hover:bg-paper rounded"
                  title={`Qolgan ${missing.length} ta marketplace'ga nusxalash`}
                >
                  {copying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CopyPlus className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 hover:bg-paper rounded"
                title="Tahrirlash"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="p-1.5 hover:bg-paper rounded"
                title="Eksport"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  resetForm();
                }}
                className="px-2 py-1 hover:bg-paper rounded text-sm"
              >
                Bekor
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1.5 hover:bg-green-100 rounded"
                title="Saqlash"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Field
          label="Sarlavha"
          value={listing.title}
          editing={editing}
          onCopy={() => handleCopy(listing.title, 'title')}
          copied={copied === 'title'}
        >
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-paper"
          />
        </Field>

        <Field
          label="Tavsif"
          value={listing.description}
          editing={editing}
          multiline
          onCopy={() => handleCopy(listing.description, 'desc')}
          copied={copied === 'desc'}
        >
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={6}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-paper"
          />
        </Field>

        <Field
          label="SEO kalit so'zlar"
          value={listing.seoKeywords || '—'}
          editing={editing}
          onCopy={listing.seoKeywords ? () => handleCopy(listing.seoKeywords!, 'seo') : undefined}
          copied={copied === 'seo'}
        >
          <textarea
            value={form.seoKeywords}
            onChange={(e) => setForm((f) => ({ ...f, seoKeywords: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-paper"
            placeholder="kalit1, kalit2, kalit3"
          />
        </Field>

        <div>
          <label className="text-xs font-medium text-muted uppercase block mb-1">Narx</label>
          {editing ? (
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-paper"
            />
          ) : (
            <p className="text-sm font-semibold">
              {parseFloat(listing.price).toLocaleString()} so'm
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sarlavha + nusxalash tugmasi + ko'rish/tahrirlash almashuvi */
function Field({
  label,
  value,
  editing,
  multiline,
  onCopy,
  copied,
  children,
}: {
  label: string;
  value: string;
  editing: boolean;
  multiline?: boolean;
  onCopy?: () => void;
  copied: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted uppercase">{label}</label>
        {!editing && onCopy && (
          <button onClick={onCopy} className="text-muted hover:text-ink-soft" aria-label={`${label} nusxalash`}>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
      {editing ? (
        children
      ) : multiline ? (
        <p className="text-sm text-ink-soft line-clamp-4 whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm font-medium">{value}</p>
      )}
    </div>
  );
}
