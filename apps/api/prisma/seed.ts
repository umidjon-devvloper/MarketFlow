import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed boshlandi...');

  // Test foydalanuvchi
  const hashedPassword = await bcrypt.hash('test1234', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'test@marketflow.uz' },
    update: {},
    create: {
      email: 'test@marketflow.uz',
      password: hashedPassword,
      fullName: 'Test Sotuvchi',
      phone: '+998901234567',
      role: 'SELLER',
      emailVerified: true,
    },
  });

  console.log(`✓ Foydalanuvchi yaratildi: ${user.email}`);

  // Test mahsulot
  const product = await prisma.product.upsert({
    where: { sku: 'TEST-001' },
    update: {},
    create: {
      userId: user.id,
      title: 'Bluetooth simsiz quloqchin TWS Pro',
      description: 'Yuqori sifatli tovush, 24 soat batareya, shovqin bostirish funksiyasi bilan',
      category: 'Elektronika',
      subcategory: 'Audio',
      brand: 'TWS Pro',
      sku: 'TEST-001',
      basePrice: 250000,
      costPrice: 150000,
      stock: 50,
      weight: 0.15,
      attributes: {
        rang: 'Qora',
        batareya: '24 soat',
        bluetooth: '5.3',
      },
      tags: ['quloqchin', 'bluetooth', 'tws', 'simsiz'],
    },
  });

  console.log(`✓ Mahsulot yaratildi: ${product.title}`);

  // Har marketplace uchun listing
  const marketplaces = ['UZUM', 'OZON', 'WB', 'YANDEX'] as const;
  
  for (const mp of marketplaces) {
    await prisma.listing.upsert({
      where: {
        productId_marketplace: {
          productId: product.id,
          marketplace: mp,
        },
      },
      update: {},
      create: {
        productId: product.id,
        marketplace: mp,
        status: 'DRAFT',
        title: `${product.title} - ${mp}`,
        description: product.description,
        price: product.basePrice,
        keywords: product.tags,
      },
    });
  }

  console.log(`✓ 4 ta listing yaratildi`);
  console.log('✅ Seed tugadi\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
