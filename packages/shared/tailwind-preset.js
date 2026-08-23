/**
 * Umumiy Tailwind preseti — apps/web va apps/landing uchun.
 *
 * Ilgari ranglar, soyalar, animatsiyalar va keyframe'lar ikkala ilovaning
 * konfiguratsiyasida alohida-alohida yozilgan edi. Yangi rang qo'shganda
 * ikkalasini ham tahrirlash kerak bo'lardi va ular sekin-asta ajralib ketardi.
 *
 * Ranglar CSS o'zgaruvchilaridan olinadi (packages/shared/styles/tokens.css),
 * shuning uchun `<alpha-value>` sintaksisi ishlatiladi — `bg-accent/40` kabi
 * shaffoflik yozuvlari shu tufayli ishlaydi.
 *
 * Shrift stack'i bu yerda YO'Q: har bir ilova o'zi yuklaydi
 * (web — next/font, landing — Google Fonts <link>), shuning uchun
 * o'zgaruvchi nomlari ham har joyda boshqacha berilishi mumkin.
 */

const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: v('--c-ink'),
        'ink-soft': v('--c-ink-soft'),
        muted: v('--c-muted'),
        line: v('--c-line'),
        'line-soft': v('--c-line-soft'),
        paper: v('--c-paper'),
        canvas: v('--c-canvas'),
        panel: v('--c-panel'),
        accent: v('--c-accent'),
        'accent-2': v('--c-accent-2'),
        'accent-soft': v('--c-accent-soft'),
        indigo: '#4f46e5',
        electric: '#2f6bff',
        // Marketplace brend ranglari — nishoncha va urg'ular uchun
        uzum: '#8b5cf6',
        ozon: '#2f88ff',
        wb: '#e0189c',
        yandex: '#f5b301',
      },

      // Klassi ko'rsatilmagan `border`, `divide-y` ham tema rangini olsin —
      // aks holda dark rejimda Tailwind'ning kulrang chegaralari qolib ketadi
      borderColor: { DEFAULT: v('--c-line') },
      divideColor: { DEFAULT: v('--c-line') },

      boxShadow: {
        card: '0 1px 2px rgba(16,18,27,0.04), 0 10px 30px -16px rgba(16,18,27,0.14)',
        'card-hover': '0 1px 2px rgba(16,18,27,0.05), 0 28px 56px -22px rgba(108,71,255,0.28)',
        btn: '0 1px 0 rgba(255,255,255,0.22) inset, 0 10px 24px -10px rgba(108,71,255,0.55)',
        'btn-hover': '0 1px 0 rgba(255,255,255,0.3) inset, 0 16px 34px -10px rgba(108,71,255,0.65)',
        soft: '0 1px 2px rgba(16,18,27,0.05)',
        glow: '0 0 0 1px rgba(108,71,255,0.12), 0 20px 60px -24px rgba(108,71,255,0.45)',
      },

      backgroundImage: {
        'grad-brand': 'linear-gradient(135deg, #6c47ff 0%, #4f46e5 50%, #2f6bff 100%)',
        'grad-soft': 'linear-gradient(135deg, #efeaff 0%, #ffffff 60%)',
      },

      animation: {
        drift1: 'drift1 26s ease-in-out infinite',
        drift2: 'drift2 30s ease-in-out infinite',
        scanmove: 'scanmove 1.6s ease-in-out infinite',
        fadein: 'fadein .5s cubic-bezier(.16,.84,.32,1)',
        floaty: 'floaty 7s ease-in-out infinite',
        'floaty-slow': 'floaty 11s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        wobble: 'wobble 12s ease-in-out infinite',
        'spin-slow': 'spinSlow 22s linear infinite',
        'gradient-x': 'gradientShift 8s ease infinite',
        marquee: 'marquee 38s linear infinite',
        'pulse-ring': 'pulseRing 2.4s ease-out infinite',
        'fade-down': 'fadeDown .6s cubic-bezier(.16,.84,.32,1) both',
        'fade-up': 'fadeUp .6s cubic-bezier(.16,.84,.32,1) both',
      },

      keyframes: {
        drift1: { '0%,100%': { transform: 'translate(0,0)' }, '50%': { transform: 'translate(50px,40px)' } },
        drift2: { '0%,100%': { transform: 'translate(0,0)' }, '50%': { transform: 'translate(-50px,50px)' } },
        scanmove: { '0%': { top: '0%' }, '50%': { top: '96%' }, '100%': { top: '0%' } },
        fadein: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeDown: { from: { opacity: '0', transform: 'translateY(-14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeUp: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        wobble: {
          '0%,100%': { transform: 'rotateX(-26deg) rotateY(-42deg)' },
          '50%': { transform: 'rotateX(-22deg) rotateY(-50deg)' },
        },
        spinSlow: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        gradientShift: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(43,201,120,0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(43,201,120,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(43,201,120,0)' },
        },
      },
    },
  },
};
