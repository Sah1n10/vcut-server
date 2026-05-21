// Run once: node seed.js
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const accounts = [
  { name: 'Shop Admin',  email: 'admin@cuts.com',  password: 'admin123',  role: 'admin'  },
  { name: 'Marcus J.',   email: 'marcus@cuts.com', password: 'barber123', role: 'barber' },
  { name: 'Diego R.',    email: 'diego@cuts.com',  password: 'barber123', role: 'barber' },
  { name: 'Amir K.',     email: 'amir@cuts.com',   password: 'barber123', role: 'barber' },
];

// Store info for seeded barbers
const barberStoreInfo = [
  {
    email: 'marcus@cuts.com',
    storeName: 'CUTS Barbershop',
    storeAddress: '123 Blade Street',
    storeCity: 'New York',
    storeState: 'NY',
    storeZip: '10001',
    storePhone: '(212) 555-0192',
    specialties: 'Fades & Tapers, Classic Cuts',
    yearsExperience: '10+ years',
    bio: 'Master barber with over 12 years of experience specializing in fades and tapers.',
  },
  {
    email: 'diego@cuts.com',
    storeName: 'CUTS Barbershop',
    storeAddress: '123 Blade Street',
    storeCity: 'New York',
    storeState: 'NY',
    storeZip: '10001',
    storePhone: '(212) 555-0192',
    specialties: 'Classic Cuts, Beard Grooming',
    yearsExperience: '6–10 years',
    bio: 'Expert in classic cuts and beard grooming with 8 years of experience.',
  },
  {
    email: 'amir@cuts.com',
    storeName: 'CUTS Barbershop',
    storeAddress: '123 Blade Street',
    storeCity: 'New York',
    storeState: 'NY',
    storeZip: '10001',
    storePhone: '(212) 555-0192',
    specialties: 'Hot Towel Shaves, Classic Cuts',
    yearsExperience: '10+ years',
    bio: 'Veteran barber with 15 years specializing in hot towel shaves and classic cuts.',
  },
];

async function seed() {
  console.log('Seeding accounts...\n');

  for (const acc of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: acc.email } });
    if (existing) {
      console.log(`  Skipping ${acc.name} — already exists`);
    } else {
      const hashed = await bcrypt.hash(acc.password, 10);
      await prisma.user.create({ data: { name: acc.name, email: acc.email, password: hashed, role: acc.role } });
      console.log(`  Created [${acc.role}]: ${acc.name} (${acc.email})`);
    }
  }

  console.log('\nSeeding barber store info...\n');

  for (const info of barberStoreInfo) {
    const existing = await prisma.barberApplication.findUnique({ where: { email: info.email } });
    if (existing) {
      console.log(`  Skipping store info for ${info.email} — already exists`);
    } else {
      const user = await prisma.user.findUnique({ where: { email: info.email } });
      const hashed = await bcrypt.hash('barber123', 10);
      await prisma.barberApplication.create({
        data: {
          name: user.name,
          email: info.email,
          password: hashed,
          phone: info.storePhone,
          storeName: info.storeName,
          storeAddress: info.storeAddress,
          storeCity: info.storeCity,
          storeState: info.storeState,
          storeZip: info.storeZip,
          storePhone: info.storePhone,
          yearsExperience: info.yearsExperience,
          specialties: info.specialties,
          bio: info.bio,
          licenseFile: 'seeded',
          insuranceFile: 'seeded',
          certificateFiles: '[]',
          status: 'approved',
        }
      });
      console.log(`  Created store info for ${user.name}`);
    }
  }

  console.log('\n--- Login Credentials ---');
  console.log('ADMIN:   admin@cuts.com   / admin123');
  console.log('BARBERS: marcus@cuts.com  / barber123');
  console.log('         diego@cuts.com   / barber123');
  console.log('         amir@cuts.com    / barber123');

  await prisma.$disconnect();
}

seed().catch(console.error);