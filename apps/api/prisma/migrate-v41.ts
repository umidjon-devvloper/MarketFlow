/**
 * Migratsiya skripti — v3 → v4.1
 *
 * ISHLASH TARTIBI:
 * 1. `npx prisma db push` — yangi sxemani bazaga qo'llash
 *    (Prisma yangi ustunlar qo'shadi, eskilari qoladi)
 * 2. `npx tsx prisma/migrate-v41.ts` — bu skript
 *    Har bir User uchun avtomatik Organization yaratadi
 *    va uni OWNER qiladi. Barcha Product va UserMarketplace
 *    yangi organizationId ga bog'lanadi.
 *
 * QANDAY ISHLAYDI:
 * - Har bir User uchun yangi Organization yaratiladi (nomi: "{fullName}ning tashkiloti")
 * - User Membership OWNER sifatida qo'shiladi
 * - User'ning barcha Product larining organizationId ← yangi org.id
 * - User'ning barcha UserMarketplace larining organizationId ← yangi org.id
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40) + '-' + Date.now().toString(36);
}

async function migrate() {
  console.log('🔄 Migratsiya boshlandi...\n');

  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          memberships: true,
        },
      },
    },
  });

  console.log(`📊 Jami foydalanuvchilar: ${users.length}`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    // Agar allaqachon a'zoligi bo'lsa — o'tkazib yuborish
    if (user._count.memberships > 0) {
      console.log(`⏭  ${user.email} — tashkilotga a'zo bo'lgan`);
      skipped++;
      continue;
    }

    // Yangi tashkilot yaratish
    const orgName = `${user.fullName}ning tashkiloti`;
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: slugify(user.fullName),
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    console.log(`✅ ${user.email} → Organization: ${org.name} (${org.id})`);

    // User ning mahsulotlarini yangi org ga bog'lash (agar eski schema'da user.products bo'lsa)
    // NOTE: Bu qismni faqat eski db columns hali mavjud bo'lsa qo'shing
    try {
      // Prisma raw query - eski userId ustuni asosida
      await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET "organizationId" = $1 WHERE "userId" = $2 AND "organizationId" IS NULL`,
        org.id,
        user.id,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "UserMarketplace" SET "organizationId" = $1 WHERE "userId" = $2 AND "organizationId" IS NULL`,
        org.id,
        user.id,
      );
    } catch (err: any) {
      // Agar eski ustun yo'q bo'lsa — muammo emas
      console.log(`   (eski userId ustun yo'q, o'tkazib yuborildi)`);
    }

    created++;
  }

  console.log(`\n✨ Yakun:`);
  console.log(`   Yaratildi: ${created} ta tashkilot`);
  console.log(`   O'tkazib yuborildi: ${skipped}`);

  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error('❌ Migratsiya xato:', err);
  process.exit(1);
});
