import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, createCipheriv } from 'crypto';

const prisma = new PrismaClient();

const ENC_KEY = Buffer.from('0'.repeat(64), 'hex');

function encrypt(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

async function main() {
  const adminHash = await bcrypt.hash('admin123', 12);
  const userHash = await bcrypt.hash('user123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@streambooster.io' },
    update: {},
    create: {
      email: 'admin@streambooster.io',
      passwordHash: adminHash,
      role: 'admin',
      bandwidthBytesRemaining: BigInt(100 * 1024 * 1024 * 1024),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@streambooster.io' },
    update: {},
    create: {
      email: 'demo@streambooster.io',
      passwordHash: userHash,
      role: 'user',
      bandwidthBytesRemaining: BigInt(10 * 1024 * 1024 * 1024),
    },
  });

  const manualProvider = await prisma.proxyProvider.upsert({
    where: { name: 'manual-demo' },
    update: {},
    create: {
      name: 'manual-demo',
      displayName: 'Demo Manual Proxies',
      adapterType: 'manual',
      apiEndpoint: 'http://localhost',
      priority: 0,
    },
  });

  const demoProxies = [
    { address: 'socks5://demo:demo@192.168.1.1:1080', country: 'FR' },
    { address: 'socks5://demo:demo@192.168.1.2:1080', country: 'FR' },
    { address: 'socks5://demo:demo@192.168.1.3:1080', country: 'US' },
    { address: 'socks5://demo:demo@192.168.1.4:1080', country: 'DE' },
  ];

  for (const p of demoProxies) {
    await prisma.proxyPool.create({
      data: {
        providerId: manualProvider.id,
        addressEncrypted: encrypt(p.address),
        countryCode: p.country,
        type: 'datacenter',
      },
    });
  }

  const apiKeyRaw = 'sb_demo_key_000000000000000000000000000000';
  const keyHash = createHash('sha256').update(apiKeyRaw).digest('hex');
  await prisma.apiKey.upsert({
    where: { id: 'demo-api-key-id' },
    update: {},
    create: {
      id: 'demo-api-key-id',
      userId: user.id,
      keyHash,
      label: 'Demo Desktop App',
    },
  });

  console.log('✅ Seed terminé');
  console.log(`   Admin: admin@streambooster.io / admin123`);
  console.log(`   User:  demo@streambooster.io / user123`);
  console.log(`   API Key demo: ${apiKeyRaw}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
