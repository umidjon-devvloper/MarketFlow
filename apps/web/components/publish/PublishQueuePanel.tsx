'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Ban,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { RemoteImage } from '@/components/RemoteImage';

type JobStatus = 'QUEUED' | 'RUNNING' | 'PENDING' | 'DONE' | 'FAILED' | 'CANCELLED';

interface PublishJob {
  id: string;
  marketplace: string;
  status: JobStatus;
  message?: string | null;
  warnings: string[];
  attempts: number;
  createdAt: string;
  product: {
    id: string;
    title: string;
    sku?: string | null;
    images: Array<{ url: string }>;
  };
}

interface JobsResponse {
  items: PublishJob[];
  counts: Record<JobStatus, number>;
  active: boolean;
}

const STATUS: Record<
  JobStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  QUEUED: { label: 'Navbatda', icon: Clock, className: 'text-muted' },
  RUNNING: { label: 'Yuborilmoqda', icon: Loader2, className: 'text-accent' },
  PENDING: { label: 'Javob kutilmoqda', icon: Clock, className: 'text-amber-600 dark:text-amber-400' },
  DONE: { label: 'Joylandi', icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  FAILED: { label: 'Xato', icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  CANCELLED: { label: 'Bekor qilindi', icon: Ban, className: 'text-muted' },
};

/**
 * Joylash navbati.
 *
 * Navbat serverda ishlaydi (cron), shuning uchun bu panel faqat holatni
 * ko'rsatadi — sahifani yopib ketsa ham ish davom etadi. Faol vazifalar
 * bo'lgandagina so'rov yuboriladi: hech narsa kutmayotgan sotuvchi uchun
 * har 5 soniyada so'rov yuborishning ma'nosi yo'q.
 */
export function PublishQueuePanel() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data } = useQuery({
    queryKey: ['publish-jobs', currentOrgId],
    queryFn: async () => (await api.get<JobsResponse>('/cards/publish-jobs')).data,
    enabled: !!currentOrgId,
    // Ish ketayotganda tez-tez, tinch paytda umuman so'ramaymiz
    refetchInterval: (query) => (query.state.data?.active ? 5000 : false),
  });

  if (!data || !data.items.length) return null;

  const { counts } = data;
  const activeCount = counts.QUEUED + counts.RUNNING + counts.PENDING;

  const handleCancel = async () => {
    const ok = await confirm({
      title: `${activeCount} ta vazifa bekor qilinsinmi?`,
      description:
        "Hali yuborilmagan kartochkalar navbatdan chiqadi. Marketplace'ga allaqachon " +
        "ketganlarini to'xtatib bo'lmaydi — ular kabinetda qoladi.",
      confirmLabel: 'Ha, bekor qilinsin',
      danger: true,
    });
    if (!ok) return;

    setCancelling(true);
    try {
      const { data: result } = await api.post('/cards/publish-jobs/cancel');
      toast('info', result.message);
      queryClient.invalidateQueries({ queryKey: ['publish-jobs', currentOrgId] });
    } catch (err: any) {
      toast('error', err.response?.data?.error || "Bekor qilib bo'lmadi");
    } finally {
      setCancelling(false);
    }
  };

  const visible = expanded ? data.items : data.items.slice(0, 4);

  return (
    <div className="card mb-6 overflow-hidden">
      <div className="p-4 flex items-center gap-4 flex-wrap">
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            activeCount ? 'bg-accent-soft text-accent' : 'bg-panel text-muted'
          }`}
        >
          {activeCount ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {activeCount ? `${activeCount} ta kartochka yo'lda` : 'Joylash navbati'}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {[
              counts.DONE && `${counts.DONE} joylandi`,
              counts.PENDING && `${counts.PENDING} javob kutmoqda`,
              counts.QUEUED && `${counts.QUEUED} navbatda`,
              counts.FAILED && `${counts.FAILED} xato`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Vazifa yo’q'}
          </p>
        </div>

        {activeCount > 0 && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="btn-ghost btn-sm text-red-600 disabled:opacity-50"
          >
            {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
            Bekor qilish
          </button>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Ro'yxatni yig'ish" : "Barchasini ko'rish"}
          className="btn-ghost btn-sm"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? "Yig'ish" : `Barchasi (${data.items.length})`}
        </button>
      </div>

      <div className="divide-y border-t border-line">
        {visible.map((job) => {
          const info = STATUS[job.status];
          const Icon = info.icon;
          const image = job.product.images[0]?.url;

          return (
            <div key={job.id} className="p-3.5 flex items-center gap-3">
              {image ? (
                <RemoteImage src={image} alt="" sizes="36px" className="w-9 h-9 rounded-lg flex-shrink-0" />
              ) : (
                <span className="w-9 h-9 rounded-lg bg-panel flex-shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{job.product.title}</p>
                <p className="text-xs text-muted truncate">
                  {job.marketplace}
                  {job.product.sku ? ` · ${job.product.sku}` : ''}
                  {job.attempts > 1 ? ` · ${job.attempts}-urinish` : ''}
                </p>
              </div>

              <div className="text-right min-w-0 max-w-[45%]">
                <p className={`text-xs font-medium flex items-center justify-end gap-1.5 ${info.className}`}>
                  <Icon className={`w-3.5 h-3.5 ${job.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                  {info.label}
                </p>
                {job.message && (
                  <p
                    className="text-[11px] text-muted mt-0.5 line-clamp-2"
                    title={job.message}
                  >
                    {job.message}
                  </p>
                )}
                {job.warnings.length > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 flex items-center justify-end gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {job.warnings.length} ta eslatma
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
