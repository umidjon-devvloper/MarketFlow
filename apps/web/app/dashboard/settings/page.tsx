'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Loader2,
  Mail,
  AlertTriangle,
  Plus,
  X,
  RefreshCw,
  Send,
  PackageX,
  RefreshCcw,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { SkeletonText } from '@/components/Skeleton';

interface AlertSettings {
  stockAlertsEnabled: boolean;
  lowStockThreshold: number;
  stockAlertEmails: string[];
  defaultRecipient: string;
  mailConfigured: boolean;
  mailError?: string;
  activeAlerts: number;
}

interface RunReport {
  checked: number;
  lowCount: number;
  low: Array<{ marketplace: string; sku: string; name?: string; amount: number }>;
  recipients: string[];
  emailSent: boolean;
  emailError?: string;
  errors: Array<{ marketplace: string; error: string }>;
}

interface SyncStatusRow {
  marketplace: string;
  lastSyncedAt: string | null;
  status: 'OK' | 'PARTIAL' | 'FAILED' | null;
  error: string | null;
  durationMs: number | null;
  skuCount: number;
  totalStock: number;
}

const MP_LABELS: Record<string, string> = {
  UZUM: 'Uzum',
  OZON: 'Ozon',
  WB: 'Wildberries',
  YANDEX: 'Yandex',
};

/** Server xatosidan foydalanuvchiga ko'rsatiladigan matn */
function errorText(err: unknown): string {
  return (err as any)?.response?.data?.error || (err as Error)?.message || 'Xato yuz berdi';
}

export default function SettingsPage() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState(5);
  const [emails, setEmails] = useState<string[]>([]);
  const [draftEmail, setDraftEmail] = useState('');
  const [report, setReport] = useState<RunReport | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['alert-settings', currentOrgId],
    queryFn: async () => (await api.get('/alerts/settings')).data as AlertSettings,
    enabled: !!currentOrgId,
  });

  // Server javobi kelgach formani to'ldiramiz (keyingi qayta yuklanishlarda
  // foydalanuvchi kiritganini bosib ketmasligi uchun faqat ma'lumot o'zgarsa)
  const data = settingsQuery.data;
  useEffect(() => {
    if (!data) return;
    setEnabled(data.stockAlertsEnabled);
    setThreshold(data.lowStockThreshold);
    setEmails(data.stockAlertEmails);
  }, [data]);

  const save = useMutation({
    mutationFn: async (patch: Partial<AlertSettings>) =>
      (await api.patch('/alerts/settings', patch)).data,
    onSuccess: () => {
      toast('success', 'Sozlamalar saqlandi');
      queryClient.invalidateQueries({ queryKey: ['alert-settings', currentOrgId] });
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const testMail = useMutation({
    mutationFn: async () => (await api.post('/alerts/test')).data,
    onSuccess: (res) => toast('success', `Sinov xati yuborildi: ${res.recipients.join(', ')}`),
    onError: (err) => toast('error', errorText(err)),
  });

  const runNow = useMutation({
    mutationFn: async () => (await api.post('/alerts/run')).data as RunReport,
    onSuccess: (res) => {
      setReport(res);
      if (res.lowCount === 0) {
        toast('success', `${res.checked} ta mahsulot tekshirildi — hammasi yetarli`);
      } else if (res.emailSent) {
        toast('success', `${res.lowCount} ta mahsulot kam qoldi — xat yuborildi`);
      } else {
        toast('info', `${res.lowCount} ta mahsulot kam qoldi (xat yuborilmadi)`);
      }
      queryClient.invalidateQueries({ queryKey: ['alert-settings', currentOrgId] });
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const addEmail = () => {
    const value = draftEmail.trim().toLowerCase();
    if (!value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast('error', 'Email manzil noto\'g\'ri');
      return;
    }
    if (emails.includes(value)) {
      setDraftEmail('');
      return;
    }
    setEmails([...emails, value]);
    setDraftEmail('');
  };

  const busy = save.isPending;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-1">Sozlamalar</h1>
      <p className="text-ink-soft mb-8">Tashkilot uchun umumiy sozlamalar</p>

      <section className="card">
        <header className="flex items-start gap-3 p-5 border-b">
          <div className="p-2 rounded-lg bg-accent-soft text-accent">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Qoldiq xabarnomasi</h2>
            <p className="text-sm text-ink-soft mt-0.5">
              Mahsulot qoldig'i belgilangan sondan kam qolsa emailga xabar keladi
            </p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label="Qoldiq xabarnomasini yoqish"
            onClick={() => {
              setEnabled(!enabled);
              save.mutate({ stockAlertsEnabled: !enabled });
            }}
            disabled={busy}
            className={`relative w-11 h-6 rounded-full transition flex-shrink-0 disabled:opacity-50 ${
              enabled ? 'bg-accent' : 'bg-panel border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </header>

        {settingsQuery.isLoading ? (
          <div className="p-5" role="status" aria-label="Sozlamalar yuklanmoqda">
            <SkeletonText lines={4} />
          </div>
        ) : settingsQuery.isError ? (
          <p className="p-5 text-sm text-red-600">{errorText(settingsQuery.error)}</p>
        ) : (
          <div className="p-5 space-y-6">
            {/* Server tomonda Gmail sozlanmagan bo'lsa — hech qanday xat ketmaydi */}
            {data && !data.mailConfigured && (
              <div className="flex gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium">Serverda Gmail sozlanmagan</p>
                  <p className="mt-1 leading-relaxed">
                    API <code className="px-1 rounded bg-amber-100">.env</code> fayliga{' '}
                    <code className="px-1 rounded bg-amber-100">GMAIL_USER</code> va{' '}
                    <code className="px-1 rounded bg-amber-100">GMAIL_APP_PASSWORD</code> qo'shing.
                    Parol — Google akkauntdagi «App password», oddiy parol emas.
                  </p>
                </div>
              </div>
            )}
            {data?.mailConfigured && data.mailError && (
              <div className="flex gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Gmail'ga ulanib bo'lmadi</p>
                  <p className="mt-1">{data.mailError}</p>
                </div>
              </div>
            )}

            {/* Chegara */}
            <div>
              <label htmlFor="threshold" className="block text-sm font-medium mb-1.5">
                Ogohlantirish chegarasi
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="threshold"
                  type="number"
                  min={0}
                  max={10000}
                  value={threshold}
                  onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
                  onBlur={() => {
                    if (data && threshold !== data.lowStockThreshold) {
                      save.mutate({ lowStockThreshold: threshold });
                    }
                  }}
                  className="w-28 px-3 py-2 border rounded-lg bg-paper"
                />
                <span className="text-sm text-ink-soft">
                  tadan kam qolganda xabar yuborilsin
                </span>
              </div>
            </div>

            {/* Qabul qiluvchilar */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Kimga yuborilsin</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {emails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-panel text-sm"
                  >
                    {email}
                    <button
                      onClick={() => {
                        const next = emails.filter((e) => e !== email);
                        setEmails(next);
                        save.mutate({ stockAlertEmails: next });
                      }}
                      aria-label={`${email} ni o'chirish`}
                      className="p-0.5 rounded-full hover:bg-paper text-muted hover:text-ink"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {emails.length === 0 && (
                  <span className="text-sm text-muted">
                    Manzil qo'shilmagan — xat egasiga ketadi:{' '}
                    <b className="text-ink-soft">{data?.defaultRecipient}</b>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                  placeholder="ombor@gmail.com"
                  className="flex-1 px-3 py-2 border rounded-lg bg-paper"
                />
                <button
                  onClick={() => {
                    const value = draftEmail.trim().toLowerCase();
                    addEmail();
                    if (value && !emails.includes(value)) {
                      save.mutate({ stockAlertEmails: [...emails, value] });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-panel"
                >
                  <Plus className="w-4 h-4" />
                  Qo'shish
                </button>
              </div>
            </div>

            {/* Amallar */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <button
                onClick={() => runNow.mutate()}
                disabled={runNow.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 mt-4"
              >
                {runNow.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Hozir tekshirish
              </button>
              <button
                onClick={() => testMail.mutate()}
                disabled={testMail.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-panel disabled:opacity-50 mt-4"
              >
                {testMail.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Sinov xati
              </button>
            </div>

            <p className="text-xs text-muted flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Avtomatik tekshiruv har kuni soat 9:00 va 18:00 da ishlaydi.
              {data && data.activeAlerts > 0 && (
                <> Hozir {data.activeAlerts} ta mahsulot kuzatuvda.</>
              )}
            </p>

            {/* Oxirgi tekshiruv natijasi */}
            {report && <RunResult report={report} />}
          </div>
        )}
      </section>

      <SyncSection />
    </div>
  );
}

/**
 * Marketplace sinxronizatsiyasi — kesh qachon yangilangani va qo'lda yangilash.
 *
 * Foydalanuvchi uchun muhim: qoldiq jadvali endi bazadan o'qiladi, ya'ni
 * "eskirgan ma'lumot" degan savol paydo bo'ladi. Shu blok unga javob beradi.
 */
function SyncSection() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  const toast = useToast();

  const statusQuery = useQuery({
    queryKey: ['sync-status', currentOrgId],
    queryFn: async () => (await api.get('/sync/status')).data.items as SyncStatusRow[],
    enabled: !!currentOrgId,
    refetchInterval: 60_000,
  });

  const syncNow = useMutation({
    mutationFn: async () => (await api.post('/sync/run')).data,
    onSuccess: (res) => {
      const ok = res.results.filter((r: any) => r.status === 'OK').length;
      const items = res.results.reduce((n: number, r: any) => n + r.itemCount, 0);
      toast('success', `${ok}/${res.results.length} marketplace yangilandi — ${items} ta SKU`);
      queryClient.invalidateQueries({ queryKey: ['sync-status', currentOrgId] });
      queryClient.invalidateQueries({ queryKey: ['mp-data'] });
    },
    onError: (err) => toast('error', errorText(err)),
  });

  const rows = statusQuery.data || [];

  return (
    <section className="card mt-6">
      <header className="flex items-start gap-3 p-5 border-b">
        <div className="p-2 rounded-lg bg-accent-soft text-accent">
          <RefreshCcw className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold">Marketplace ma'lumoti</h2>
          <p className="text-sm text-ink-soft mt-0.5">
            Qoldiq va buyurtmalar har 3 soatda bazaga yig'iladi — sahifalar shundan o'qiydi
          </p>
        </div>
        <button
          onClick={() => syncNow.mutate()}
          disabled={syncNow.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-panel disabled:opacity-50 flex-shrink-0"
        >
          {syncNow.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4" />
          )}
          Hozir yangilash
        </button>
      </header>

      {statusQuery.isLoading ? (
        <div className="p-8 flex justify-center text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-muted">
          Ulangan marketplace yo'q — avval Marketplace'lar sahifasida kalit qo'shing
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.marketplace} className="p-4 flex items-start gap-3">
              <StatusIcon status={row.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {MP_LABELS[row.marketplace] || row.marketplace}
                </p>
                <p className="text-xs text-ink-soft mt-0.5">
                  {row.lastSyncedAt ? (
                    <>
                      {timeAgo(row.lastSyncedAt)} · {row.skuCount} ta SKU ·{' '}
                      {row.totalStock.toLocaleString()} dona
                    </>
                  ) : (
                    'Hali yangilanmagan'
                  )}
                </p>
                {row.error && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 break-words">{row.error}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusIcon({ status }: { status: SyncStatusRow['status'] }) {
  if (status === 'OK') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />;
  if (status === 'PARTIAL') return <CircleAlert className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />;
  if (status === 'FAILED') return <CircleAlert className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />;
  return <CircleAlert className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" />;
}

/** "3 soat oldin" ko'rinishidagi vaqt */
function timeAgo(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'hozirgina';
  if (diffMin < 60) return `${diffMin} daqiqa oldin`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `${hours} soat oldin`;
  return `${Math.round(hours / 24)} kun oldin`;
}

function RunResult({ report }: { report: RunReport }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-4 py-2.5 bg-panel text-sm flex items-center gap-2">
        <PackageX className="w-4 h-4 text-muted" />
        <span className="font-medium">Oxirgi tekshiruv</span>
        <span className="text-ink-soft">
          {report.checked} ta mahsulot · {report.lowCount} tasi kam qolgan
        </span>
      </div>

      {report.errors.length > 0 && (
        <ul className="px-4 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border-b space-y-1">
          {report.errors.map((e) => (
            <li key={e.marketplace}>
              <b>{MP_LABELS[e.marketplace] || e.marketplace}:</b> {e.error}
            </li>
          ))}
        </ul>
      )}

      {report.low.length > 0 && (
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {report.low.slice(0, 20).map((row, i) => (
              <tr key={`${row.marketplace}-${row.sku}-${i}`}>
                <td className="px-4 py-2">
                  <span className="text-xs text-muted mr-2">
                    {MP_LABELS[row.marketplace] || row.marketplace}
                  </span>
                  {row.name || row.sku}
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.amount === 0
                        ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {row.amount} ta
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {report.low.length > 20 && (
        <p className="px-4 py-2 text-xs text-muted border-t">
          va yana {report.low.length - 20} ta
        </p>
      )}

      {report.emailError && (
        <p className="px-4 py-2 text-xs text-red-600 border-t">Xat yuborilmadi: {report.emailError}</p>
      )}
    </div>
  );
}
