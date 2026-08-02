'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  fullName: z.string().min(2, 'Ism kamida 2 harf'),
  email: z.string().email('Email noto\'g\'ri'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Parol kamida 6 belgi'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const res = await api.post('/auth/register', data);
      setAuth(
        res.data.user,
        res.data.organizations || [],
        res.data.accessToken,
        res.data.refreshToken,
      );
      router.push('/dashboard');
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Xato yuz berdi');
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-canvas overflow-hidden">
      
      {/* LEFT SIDE: Visuals & Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-12 bg-ink overflow-hidden">
        {/* Background Effects for Left Side */}
        <div className="absolute inset-0 aurora opacity-40"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        
        {/* Decorative Grid */}
        <div className="absolute inset-0 grid-fade opacity-30"></div>

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5 font-serif text-2xl font-bold text-white shrink-0">
            <span className="w-8 h-8 rounded-xl bg-grad-brand grid grid-cols-2 gap-[3px] p-[5px] shadow-[0_4px_12px_-2px_rgba(108,71,255,0.4)]">
              <span className="rounded-[2px] bg-white/95" />
              <span className="rounded-[2px] bg-white/45" />
              <span className="rounded-[2px] bg-white/45" />
              <span className="rounded-[2px] bg-white/95" />
            </span>
            <span>Market<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-2 to-ozon">Flow</span></span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium mb-6 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Tizim 100% barqaror ishlamoqda
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
            Sotuvlarni bitta <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a890ff] to-[#5b9bff]">joydan boshqaring</span>
          </h2>
          <p className="mt-5 text-lg text-white/60 font-medium leading-relaxed">
            Uzum, Ozon, Wildberries va Yandex Market uchun yagona, super tezkor va qulay platforma.
          </p>

          {/* Floating mock card */}
          <div className="mt-12 w-full glass bg-white/5 border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-white/60 text-sm font-medium mb-1">Bugungi daromad</p>
                <p className="text-2xl font-bold text-white">12,450,000 UZS</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-400/20 flex items-center justify-center text-green-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-white/40 text-sm font-medium">
          © {new Date().getFullYear()} MarketFlow. Barcha huquqlar himoyalangan.
        </div>
      </div>

      {/* RIGHT SIDE: Form */}
      <div className="w-full lg:w-[55%] relative flex items-center justify-center p-6 sm:p-12">
        {/* Subtle mesh bg on the right side */}
        <div className="absolute inset-0 mesh-bg opacity-30"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/10 blur-[80px] rounded-full mix-blend-multiply opacity-50 animate-spin-slow"></div>

        <div className="relative z-10 w-full max-w-[420px]">
          <div className="text-center lg:text-left mb-10 animate-fade-down">
            <h1 className="text-3xl font-extrabold text-ink tracking-tight">Xush kelibsiz!</h1>
            <p className="text-ink-soft text-[0.95rem] mt-2 font-medium">Yangi hisob yaratish uchun ma'lumotlarni kiriting</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="glass bg-paper/70 p-7 sm:p-9 rounded-[28px] shadow-card border border-line/60 animate-fade-up backdrop-blur-xl">
            {serverError && (
              <div className="mb-6 p-4 bg-red-50/50 border border-red-100 text-red-600 rounded-2xl text-[0.9rem] font-medium flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {serverError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[0.85rem] font-bold text-ink mb-1.5">To'liq ism</label>
                <input
                  {...register('fullName')}
                  className="w-full px-4 py-3 bg-canvas/60 border border-line rounded-xl focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-[0.95rem] text-ink placeholder:text-muted/60"
                  placeholder="Ism Familiya"
                />
                {errors.fullName && <p className="text-red-500 text-[0.8rem] font-medium mt-1.5">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="block text-[0.85rem] font-bold text-ink mb-1.5">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full px-4 py-3 bg-canvas/60 border border-line rounded-xl focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-[0.95rem] text-ink placeholder:text-muted/60"
                  placeholder="siz@misol.com"
                />
                {errors.email && <p className="text-red-500 text-[0.8rem] font-medium mt-1.5">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-[0.85rem] font-bold text-ink mb-1.5">Telefon <span className="text-muted font-normal">(ixtiyoriy)</span></label>
                <input
                  {...register('phone')}
                  className="w-full px-4 py-3 bg-canvas/60 border border-line rounded-xl focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-[0.95rem] text-ink placeholder:text-muted/60"
                  placeholder="+998 90 123 45 67"
                />
              </div>

              <div>
                <label className="block text-[0.85rem] font-bold text-ink mb-1.5">Parol</label>
                <input
                  type="password"
                  {...register('password')}
                  className="w-full px-4 py-3 bg-canvas/60 border border-line rounded-xl focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-[0.95rem] text-ink placeholder:text-muted/60 tracking-wider"
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-[0.8rem] font-medium mt-1.5">{errors.password.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3.5 mt-8 text-[0.95rem] shadow-[0_10px_24px_-10px_rgba(108,71,255,0.6)] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSubmitting ? "Yaratilmoqda..." : "Ro'yxatdan o'tish"}
            </button>

            <p className="text-center lg:text-left text-[0.9rem] text-ink-soft mt-8 font-medium">
              Hisobingiz bormi?{' '}
              <Link href="/login" className="text-accent font-bold hover:text-indigo transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-full after:h-[2px] after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left">
                Tizimga kiring
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
