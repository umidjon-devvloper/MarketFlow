import type { Metadata } from 'next';
import { Manrope, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Brend shriftlari.
 *
 * Landing (Astro) ularni Base.astro'dagi Google Fonts <link> orqali yuklaydi,
 * bu yerda esa next/font ishlatiladi: fayllar build paytida o'zimizga ko'chiriladi,
 * ya'ni tashqi so'rov ham, layout sakrashi ham bo'lmaydi.
 *
 * Kirill subset majburiy — marketplace maydonlari ruscha nomlanadi
 * ("Название товара", "Артикул продавца"). Fraunces'da kirill yo'q,
 * lekin u faqat sarlavhalar uchun.
 */
const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fraunces',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MarketFlow — Marketplace management',
  description: 'Uzum, Ozon, WB, Yandex uchun yagona kartochka boshqaruvi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uz"
      className={`${manrope.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Tema klassini render'dan oldin qo'yamiz — aks holda sahifa oq bo'lib miltillaydi */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mf-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-canvas text-ink font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
