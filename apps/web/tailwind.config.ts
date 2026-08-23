import type { Config } from 'tailwindcss';
// Ranglar, soyalar, animatsiyalar — packages/shared/tailwind-preset.js da.
// Landing ham aynan shu presetni ishlatadi, ya'ni ikkalasi bir joydan boshqariladi.
import sharedPreset from '../../packages/shared/tailwind-preset';

const config: Config = {
  presets: [sharedPreset as Config],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // var() ichidagi fallback ataylab: next/font klassi <html> dan tushib qolsa ham
      // shrift nomi ataladi va butun font-family e'loni yaroqsiz bo'lib qolmaydi
      fontFamily: {
        serif: ["var(--font-fraunces, 'Fraunces')", 'Georgia', 'serif'],
        sans: ["var(--font-manrope, 'Manrope')", 'system-ui', 'sans-serif'],
        mono: ["var(--font-jbmono, 'JetBrains Mono')", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
