'use client';

/**
 * Sotuvchining o'z Excel shabloni.
 *
 * Marketplace shablonlari KATEGORIYAGA bog'langan: ilova bilan kelgan nusxa
 * faqat bitta kategoriya uchun to'g'ri keladi (WB'da o'yinchoqlar, Uzum'da
 * kiyim). Boshqa kategoriyada ustunlar mos kelmaydi va to'ldirilgan faylni
 * marketplace qabul qilmaydi.
 *
 * Shuning uchun sotuvchi o'z kategoriyasining shablonini kabinetdan yuklab
 * olib, bir marta shu yerga joylaydi.
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface TemplateInfo {
  label: string;
  fileName: string;
  size: number;
  updatedAt: string;
}

export function TemplatePanel({ marketplace, name }: { marketplace: string; name: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data } = useQuery({
    queryKey: ['card-template', marketplace],
    queryFn: async () =>
      (await api.get(`/cards/template/${marketplace}`)).data.template as TemplateInfo | null,
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/cards/template/${marketplace}`),
    onSuccess: () => {
      toast('success', "Shablon o'chirildi — namunaviy shablon ishlatiladi");
      queryClient.invalidateQueries({ queryKey: ['card-template', marketplace] });
      queryClient.invalidateQueries({ queryKey: ['card-charcs'] });
    },
  });

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/cards/template/${marketplace}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast('success', 'Shablon saqlandi — keyingi eksportlar shu fayl asosida bo\'ladi');
      queryClient.invalidateQueries({ queryKey: ['card-template', marketplace] });
      // Uzum'da xususiyatlar aynan shu fayldan o'qiladi
      queryClient.invalidateQueries({ queryKey: ['card-charcs'] });
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Shablon saqlanmadi');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="w-5 h-5 mt-0.5 text-accent flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{name} shabloni</p>
          {data ? (
            <p className="text-xs text-muted mt-0.5 break-all">
              {data.fileName} · {Math.round(data.size / 1024)} KB
            </p>
          ) : (
            <p className="text-xs text-muted mt-0.5">
              Namunaviy shablon ishlatilyapti — u faqat bitta kategoriya uchun to&apos;g&apos;ri
              keladi. O&apos;z kategoriyangiz shablonini {name} kabinetidan yuklab olib, shu yerga
              qo&apos;shing.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn px-3 py-1.5 text-xs font-medium border border-line hover:bg-panel transition disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {data ? 'Almashtirish' : 'Shablon yuklash'}
            </button>

            {data && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="btn px-3 py-1.5 text-xs font-medium border border-line text-red-600 hover:bg-panel transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                O&apos;chirish
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}
