// Next's lockfile check can't find hoisted @next/swc-* entries in an npm
// workspace and crashes trying to patch the root lockfile — the swc binary
// is installed fine, so skip the check.
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';

// Landing (marketing) zonasi Astro'da, alohida app (apps/landing).
// Bu yerda web = "host" zona: dashboard/auth/api o'zi xizmat qiladi,
// marketing yo'llarini esa landing zonasiga proxy qiladi (Multi-Zones).
// Lokal: landing 3001-portda. Vercel'da keyinchalik @vercel/microfrontends bilan almashtiriladi.
const LANDING_URL = process.env.LANDING_URL || 'https://market-flow-landing-mu.vercel.app';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Rasm optimizatsiyasi faqat shu hostlar uchun ishlaydi. Ro'yxatda yo'q host
  // 400 qaytaradi — shuning uchun RemoteImage komponenti xatoni ushlab, oddiy
  // <img> ga tushadi. Ya'ni ro'yxat to'liq bo'lmasa rasm sinmaydi, faqat
  // optimallashtirilmaydi.
  images: {
    remotePatterns: [
      // O'z xostingimiz
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: '*.ufs.sh' },
      // UPLOADTHING_TOKEN bo'lmaganda rasmlar API'ning /uploads/ papkasidan keladi
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      ...(process.env.NEXT_PUBLIC_IMAGE_HOST
        ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_IMAGE_HOST }]
        : []),
      // Marketplace CDN'lari — sinxronizatsiyada kelgan kartochka rasmlari
      { protocol: 'https', hostname: '*.wbbasket.ru' },
      { protocol: 'https', hostname: '*.wb.ru' },
      { protocol: 'https', hostname: '*.ozone.ru' },
      { protocol: 'https', hostname: '*.ozstatic.by' },
      { protocol: 'https', hostname: 'avatars.mds.yandex.net' },
      { protocol: 'https', hostname: '*.uzum.uz' },
      // Namuna ma'lumotdagi rasmlar
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async rewrites() {
    const rewrites = [
      // Marketing sahifalari → Astro landing zonasi
      { source: '/', destination: `${LANDING_URL}/` },
      { source: '/demo', destination: `${LANDING_URL}/demo` },
      { source: '/features', destination: `${LANDING_URL}/features` },
      { source: '/pricing', destination: `${LANDING_URL}/pricing` },
      // Astro'ning bundle qilingan asset'lari (JS/CSS) — faqat production build'da mavjud
      { source: '/_astro/:path*', destination: `${LANDING_URL}/_astro/:path*` },
    ];
    if (process.env.NODE_ENV === 'development') {
      // Dev'da Astro asset'larni Vite dev-server yo'llaridan beradi
      // (/@vite/client, /@fs/..., /@id/astro:scripts/..., /src/styles/...)
      rewrites.push(
        { source: '/@vite/:path*', destination: `${LANDING_URL}/@vite/:path*` },
        { source: '/@react-refresh', destination: `${LANDING_URL}/@react-refresh` },
        { source: '/@fs/:path*', destination: `${LANDING_URL}/@fs/:path*` },
        { source: '/@id/:path*', destination: `${LANDING_URL}/@id/:path*` },
        { source: '/src/:path*', destination: `${LANDING_URL}/src/:path*` },
        { source: '/node_modules/:path*', destination: `${LANDING_URL}/node_modules/:path*` },
      );
    }
    return rewrites;
  },
};
module.exports = nextConfig;
