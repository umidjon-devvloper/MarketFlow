import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Dev rejimda har bir SQL so'rovni chiqarish konsolni to'ldiradi va ortiqcha
 * yuk beradi — kerak bo'lsa PRISMA_LOG_QUERIES=1 bilan yoqiladi.
 */
const logLevels: ('query' | 'error' | 'warn')[] =
  process.env.PRISMA_LOG_QUERIES === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'];

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: logLevels });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Jarayon yopilganda ulanishlarni bo'shatamiz.
 * `tsx watch` har saqlashda qayta ishga tushadi — bu bo'lmasa eski
 * ulanishlar bazada osilib qolib, connection pool tugab qolardi.
 */
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await prisma.$disconnect();
  } catch {
    // yopishda xato bo'lsa ham jarayon to'xtashi kerak
  }
  if (signal !== 'beforeExit') process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('beforeExit', () => shutdown('beforeExit'));

/**
 * Neon compute bo'sh turganda uyquga ketadi (scale-to-zero). Uyg'onishi
 * bir necha soniya oladi — birinchi HTTP so'rov shu kutishga tushib
 * P1001 ("Can't reach database server") bilan yiqilardi.
 *
 * Server ko'tarilganda ulanishni oldindan ochib qo'yamiz. Uyg'onish
 * cheklangan urinishlar bilan qayta sinaladi; baribir bo'lmasa server
 * to'xtamaydi — so'rovlar odatdagidek xato qaytaradi.
 */
export async function warmupDatabase(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const startedAt = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`🗄️  Baza ulanishi tayyor (${Date.now() - startedAt}ms)`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      console.warn(`⏳ Baza uyg'onmadi (${attempt}/${retries}): ${message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  console.error("❌ Baza bilan ulanib bo'lmadi — so'rovlar xato qaytarishi mumkin.");
}
