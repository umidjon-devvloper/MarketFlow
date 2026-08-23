'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, ImagePlus } from 'lucide-react';
import { api } from '@/lib/api';

interface UploadDropzoneProps {
  onUpload: (data: { url: string; fileKey: string }) => void;
  maxFiles?: number;
}

/**
 * Rasm yuklash komponenti
 *
 * Fayl API'ning /cards/upload endpointiga boradi. U yerda UPLOADTHING_TOKEN
 * bo'lsa bulutga, bo'lmasa serverdagi uploads/ papkasiga saqlanadi — ya'ni
 * kalitlar sozlanmagan bo'lsa ham yuklash ishlaydi.
 */
export function UploadDropzone({ onUpload, maxFiles = 10 }: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const fileArray = Array.from(files);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        // Fayl turi tekshiruvi
        if (!file.type.startsWith('image/')) {
          setError(`${file.name}: rasm fayli bo'lishi kerak`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          setError(`${file.name}: 8MB dan katta`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const { data } = await api.post('/cards/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        onUpload({ url: data.url, fileKey: data.fileKey });
        setProgress(Math.round(((i + 1) / fileArray.length) * 100));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Yuklashda xato');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition
          ${dragOver ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}
          ${uploading ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin mb-2" />
            <p className="text-sm text-muted">Yuklanmoqda... {progress}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <ImagePlus className="w-10 h-10 text-muted mb-2" />
            <p className="font-medium">Rasmlarni bu yerga tashlang</p>
            <p className="text-sm text-muted mt-1">yoki bosing va tanlang</p>
            <p className="text-xs text-muted mt-2">PNG, JPG, WEBP · max 8MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
