import prisma from '@/lib/db';
import { generateJobNumber } from '@/lib/job-number';
import { calculateSurgeFee } from '@/lib/surge-pricing';
(async () => {
  const body = {
    name: 'E2E Test User',
    phone: '+447700900123',
    address: '10 Downing Street',
    postcode: 'SW1A 2AA',
    problemType: 'lockout',
    propertyType: 'residential',
    description: 'E2E synthetic test',
  };
  try {
    console.log('1. find/create customer...');
    let customer = await prisma.customer.findFirst({ where: { phone: body.phone } });
    if (!customer) {
      customer = await prisma.customer.create({ data: { name: body.name, phone: body.phone } });
    }
    console.log('   customerId:', customer.id);

    console.log('2. generateJobNumber...');
    const jobNumber = await generateJobNumber(body.postcode);
    console.log('   jobNumber:', jobNumber);

    console.log('3. surge fee...');
    const surge = await calculateSurgeFee(body.postcode);
    console.log('   fee:', surge.fee);

    console.log('4. create job...');
    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId: customer.id,
        problemType: body.problemType,
        propertyType: body.propertyType,
        postcode: body.postcode.toUpperCase(),
        address: body.address,
        description: body.description,
        assessmentFee: surge.fee,
        scheduledFor: null,
        isScheduled: false,
        status: 'PENDING',
        organisationId: null,
        propertyId: null,
        latitude: 51.5034,
        longitude: -0.1276,
        requestGps: null,
      },
      include: { customer: true, photos: true },
    });
    console.log('   ok jobId:', job.id);
    await prisma.job.delete({ where: { id: job.id } });
    console.log('   cleaned up');
  } catch (e: any) {
    console.log('ERROR:', e.name, '|', e.code, '|', e.message?.slice(0, 600));
    if (e.meta) console.log('  meta:', JSON.stringify(e.meta).slice(0, 400));
  }
  await prisma.$disconnect();
})();
