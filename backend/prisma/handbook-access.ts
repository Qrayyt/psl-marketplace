import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const [action, email] = process.argv.slice(2);

async function main() {
  if (!email || !['grant', 'revoke'].includes(action)) {
    throw new Error('Usage: npx tsx prisma/handbook-access.ts grant|revoke email');
  }
  const result = await prisma.user.updateMany({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    data: { handbookAccess: action === 'grant' },
  });
  if (result.count === 0) throw new Error('Account not found');
  console.log(`Handbook access: ${action} (${result.count})`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
