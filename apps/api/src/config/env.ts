/**
 * Muhit o'zgaruvchilarini ishga tushishda tekshirish.
 *
 * Nega kerak: JWT_SECRET yoki ENCRYPTION_KEY qisqa bo'lsa, ilova baribir
 * ishga tushadi va muammo faqat keyinroq — token buzilganda yoki saqlangan
 * API kalit ochilmay qolganda — bilinadi. Bu yerda esa darhol to'xtaydi.
 *
 * DIQQAT: bu fayl index.ts ning ENG BOSHIDA import qilinishi kerak,
 * aks holda tekshiruv kech ishlaydi. Ilgari u umuman import qilinmagan edi —
 * ya'ni himoya bordek ko'rinardi, lekin hech qachon ishlamagan.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),

  DATABASE_URL: z.string().min(1, 'baza ulanish satri kerak'),
  DIRECT_URL: z.string().optional(),

  JWT_SECRET: z.string().min(32, 'kamida 32 belgi (openssl rand -base64 32)'),
  JWT_REFRESH_SECRET: z.string().min(32, 'kamida 32 belgi va JWT_SECRET dan farqli'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  /** Marketplace API kalitlari shu bilan shifrlanadi — almashtirilsa eskilari ochilmaydi */
  ENCRYPTION_KEY: z.string().min(32, 'AES-256 uchun kamida 32 belgi'),

  // Quyidagilar ixtiyoriy: yo'q bo'lsa tegishli imkoniyat o'chadi, ilova ishlayveradi
  UPLOADTHING_TOKEN: z.string().optional(),
  UPLOADTHING_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  HIGGSFIELD_API_KEY: z.string().optional(),
  HIGGSFIELD_API_URL: z.string().default('https://api.higgsfield.ai/v1'),

  /** Vergul bilan ajratilgan ro'yxat. Nomi index.ts va .env.example bilan bir xil */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  WEB_APP_URL: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([key, messages]) => `  ${key}: ${(messages ?? []).join(', ')}`)
    .join('\n');
  console.error(`\n❌ .env to'g'ri emas — ilova ishga tushmadi:\n${problems}\n`);
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';

/**
 * JWT_SECRET va JWT_REFRESH_SECRET bir xil bo'lsa, access token'ni refresh
 * sifatida ishlatib bo'ladi — muddat cheklovi ma'nosini yo'qotadi.
 */
if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
  console.warn(
    "\n⚠️  JWT_SECRET va JWT_REFRESH_SECRET bir xil. Har biri alohida bo'lsin —\n" +
      '   aks holda 15 daqiqalik token 7 kunlik token o\'rnida ham ishlaydi.\n',
  );
}
