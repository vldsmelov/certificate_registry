import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const examType = await prisma.examType.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: { name: 'Demo Exam', code: 'DEMO' },
  });

  const person = await prisma.person.create({
    data: { fullName: 'Иванов Иван Иванович', position: 'Инженер' },
  });

  // Create a single demo certificate
  const publicId = 'demo-public-id-12345';
  await prisma.certificate.upsert({
    where: { publicId },
    update: {},
    create: {
      certificateNumber: '2026-DEMO-000001',
      publicId,
      grade: 'gold',
      status: 'issued',
      issuedAt: new Date(),
      validFrom: new Date(),
      validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // +1 year
      personId: person.id,
      examTypeId: examType.id,
      renderSnapshotJson: {
        fullName: person.fullName,
        position: person.position,
        examTypeName: examType.name,
        examTypeCode: examType.code,
        grade: 'gold',
        certificateNumber: '2026-DEMO-000001',
        publicId,
      },
    },
  });

  console.log('Seeded demo data. Try: GET /certs/outer/demo-public-id-12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
