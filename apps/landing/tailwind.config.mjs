// Ranglar, soyalar, animatsiyalar — packages/shared/tailwind-preset.js da.
// apps/web ham aynan shu presetni ishlatadi, ya'ni dizayn tizimi bitta joydan boshqariladi.
import sharedPreset from '../../packages/shared/tailwind-preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [sharedPreset],
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      // Shriftlarni Base.astro dagi Google Fonts <link> yuklaydi
      fontFamily: {
        serif: ["var(--font-fraunces, 'Fraunces')", 'Georgia', 'serif'],
        sans: ["var(--font-manrope, 'Manrope')", 'system-ui', 'sans-serif'],
        mono: ["var(--font-jbmono, 'JetBrains Mono')", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
