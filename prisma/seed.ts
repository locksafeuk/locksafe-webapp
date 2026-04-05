import { PrismaClient, JobStatus, PhotoType } from "@prisma/client";

const prisma = new PrismaClient();

// Simple hash function for demo purposes (in production, use bcrypt)
function simpleHash(password: string): string {
  // This creates a simple reversible encoding - NOT FOR PRODUCTION
  // In production, you would use: await bcrypt.hash(password, 10)
  return Buffer.from(`hashed:${password}`).toString("base64");
}

// Helper to generate job numbers
function generateJobNumber(index: number): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `LS-${year}${month}-${String(index).padStart(4, "0")}`;
}

// Helper to generate dates in the past
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function hoursAgo(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

function minutesAgo(minutes: number): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date;
}

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prisma.analyticsEvent.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.report.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.locksmithApplication.deleteMany();
  await prisma.job.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.locksmith.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.fAQ.deleteMany();
  await prisma.serviceArea.deleteMany();
  await prisma.blogPost.deleteMany();

  // =====================================================
  // ADMIN USERS
  // =====================================================
  console.log("👤 Creating admin users...");

  const admin = await prisma.admin.create({
    data: {
      email: "admin@locksafe.co.uk",
      passwordHash: simpleHash("demo123"),
      name: "Admin User",
      role: "super_admin",
      isActive: true,
    },
  });

  await prisma.admin.create({
    data: {
      email: "support@locksafe.co.uk",
      passwordHash: simpleHash("demo123"),
      name: "Support Team",
      role: "admin",
      isActive: true,
    },
  });

  console.log(`   ✓ Created admin: admin@locksafe.co.uk / demo123`);

  // =====================================================
  // LOCKSMITHS
  // =====================================================
  console.log("🔧 Creating locksmiths...");

  const locksmithsData = [
    {
      name: "Mike Thompson",
      companyName: "Thompson Locks Ltd",
      email: "mike@thompsonlocks.co.uk",
      phone: "07700 900001",
      rating: 4.9,
      totalJobs: 127,
      totalEarnings: 18750.0,
      isVerified: true,
      yearsExperience: 12,
      coverageAreas: ["SW1", "SW2", "SW3", "SW4", "SW5", "W1", "W2"],
      services: ["lockout", "broken", "key-stuck", "security-upgrade"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: true,
    },
    {
      name: "Sarah Davis",
      companyName: "SecureLock Services",
      email: "sarah@securelock.co.uk",
      phone: "07700 900002",
      rating: 4.8,
      totalJobs: 89,
      totalEarnings: 12340.0,
      isVerified: true,
      yearsExperience: 8,
      coverageAreas: ["E1", "E2", "E3", "E14", "E15", "N1", "N2"],
      services: ["lockout", "broken", "lost-keys", "burglary"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: true,
    },
    {
      name: "James Wilson",
      companyName: "Wilson & Sons Locksmiths",
      email: "james@wilsonlocksmiths.co.uk",
      phone: "07700 900003",
      rating: 5.0,
      totalJobs: 203,
      totalEarnings: 28900.0,
      isVerified: true,
      yearsExperience: 20,
      coverageAreas: ["SE1", "SE2", "SE3", "SE4", "SE5", "SE6"],
      services: ["lockout", "broken", "key-stuck", "security-upgrade", "safe-opening"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: true,
    },
    {
      name: "Emma Roberts",
      companyName: "Emma's Emergency Locks",
      email: "emma@emmalocks.co.uk",
      phone: "07700 900004",
      rating: 4.7,
      totalJobs: 56,
      totalEarnings: 7820.0,
      isVerified: true,
      yearsExperience: 5,
      coverageAreas: ["NW1", "NW2", "NW3", "NW4", "NW5", "N3", "N4"],
      services: ["lockout", "key-stuck", "lost-keys"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: false,
    },
    {
      name: "David Clark",
      companyName: "Clark Security Solutions",
      email: "david@clarksecurity.co.uk",
      phone: "07700 900005",
      rating: 4.9,
      totalJobs: 145,
      totalEarnings: 21500.0,
      isVerified: true,
      yearsExperience: 15,
      coverageAreas: ["M1", "M2", "M3", "M4", "M5", "M6"],
      services: ["lockout", "broken", "security-upgrade", "commercial"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: true,
    },
    {
      name: "Lisa Brown",
      companyName: "LB Locksmith Services",
      email: "lisa@lblocksmiths.co.uk",
      phone: "07700 900006",
      rating: 4.6,
      totalJobs: 34,
      totalEarnings: 4560.0,
      isVerified: true,
      yearsExperience: 3,
      coverageAreas: ["B1", "B2", "B3", "B4", "B5"],
      services: ["lockout", "key-stuck", "lost-keys"],
      stripeConnectOnboarded: false,
      stripeConnectVerified: false,
    },
    {
      name: "Tom Harrison",
      companyName: "Harrison Locks",
      email: "tom@harrisonlocks.co.uk",
      phone: "07700 900007",
      rating: 4.8,
      totalJobs: 78,
      totalEarnings: 10890.0,
      isVerified: true,
      yearsExperience: 10,
      coverageAreas: ["LS1", "LS2", "LS3", "LS4", "LS5"],
      services: ["lockout", "broken", "burglary", "security-upgrade"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: true,
    },
    {
      name: "Rachel Green",
      companyName: "Green Key Solutions",
      email: "rachel@greenkey.co.uk",
      phone: "07700 900008",
      rating: 4.9,
      totalJobs: 92,
      totalEarnings: 13200.0,
      isVerified: true,
      yearsExperience: 7,
      coverageAreas: ["EH1", "EH2", "EH3", "EH4", "EH5"],
      services: ["lockout", "broken", "key-stuck", "lost-keys"],
      stripeConnectOnboarded: true,
      stripeConnectVerified: true,
    },
  ];

  const locksmiths = await Promise.all(
    locksmithsData.map((data) =>
      prisma.locksmith.create({
        data: {
          ...data,
          passwordHash: simpleHash("demo123"),
          isActive: true,
        },
      })
    )
  );

  console.log(`   ✓ Created ${locksmiths.length} locksmiths`);

  // =====================================================
  // CUSTOMERS
  // =====================================================
  console.log("👥 Creating customers...");

  const customersData = [
    { name: "Sarah Mitchell", email: "sarah.mitchell@email.com", phone: "07700 900100" },
    { name: "James Wilson", email: "james.wilson@email.com", phone: "07700 900101" },
    { name: "Emma Brown", email: "emma.brown@email.com", phone: "07700 900102" },
    { name: "Robert Taylor", email: "robert.taylor@email.com", phone: "07700 900103" },
    { name: "Lucy Anderson", email: "lucy.anderson@email.com", phone: "07700 900104" },
    { name: "John Smith", email: "john.smith@email.com", phone: "07700 900105" },
    { name: "Mary Johnson", email: "mary.johnson@email.com", phone: "07700 900106" },
    { name: "David Williams", email: "david.williams@email.com", phone: "07700 900107" },
    { name: "Sophie Davies", email: "sophie.davies@email.com", phone: "07700 900108" },
    { name: "Michael Brown", email: "michael.brown@email.com", phone: "07700 900109" },
    { name: "Emily White", email: "emily.white@email.com", phone: "07700 900110" },
    { name: "Daniel Jones", email: "daniel.jones@email.com", phone: "07700 900111" },
    { name: "Olivia Martin", email: "olivia.martin@email.com", phone: "07700 900112" },
    { name: "William Harris", email: "william.harris@email.com", phone: "07700 900113" },
    { name: "Charlotte Clark", email: "charlotte.clark@email.com", phone: "07700 900114" },
  ];

  const customers = await Promise.all(
    customersData.map((data) =>
      prisma.customer.create({
        data,
      })
    )
  );

  console.log(`   ✓ Created ${customers.length} customers`);

  // =====================================================
  // JOBS WITH VARIOUS STATUSES
  // =====================================================
  console.log("📋 Creating jobs...");

  // Helper to pick random items
  const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const problemTypes = ["lockout", "broken", "key-stuck", "lost-keys", "burglary"];
  const propertyTypes = ["house", "flat", "commercial", "car"];

  const addresses = [
    { address: "10 Downing Street", postcode: "SW1A 2AA", lat: 51.5034, lng: -0.1276 },
    { address: "42 Commercial Road", postcode: "E1 6AN", lat: 51.5142, lng: -0.0568 },
    { address: "15 High Street", postcode: "B1 1AA", lat: 52.4814, lng: -1.8998 },
    { address: "100 Business Park", postcode: "LS1 4PL", lat: 53.7997, lng: -1.5492 },
    { address: "25 Garden Lane", postcode: "E14 5HP", lat: 51.5068, lng: -0.0176 },
    { address: "8 Park Avenue", postcode: "M1 2WD", lat: 53.4808, lng: -2.2426 },
    { address: "72 Victoria Road", postcode: "SW1V 1EY", lat: 51.4944, lng: -0.1403 },
    { address: "33 Queens Street", postcode: "EH2 1JX", lat: 55.9533, lng: -3.1883 },
    { address: "55 Church Road", postcode: "NW3 6UP", lat: 51.5562, lng: -0.1789 },
    { address: "120 Market Street", postcode: "M4 3AQ", lat: 53.4831, lng: -2.2377 },
    { address: "45 Oxford Road", postcode: "M13 9PL", lat: 53.4668, lng: -2.2339 },
    { address: "88 King Street", postcode: "W6 0QT", lat: 51.4922, lng: -0.2250 },
  ];

  const jobs = [];

  // 1. Completed and signed jobs (most common)
  for (let i = 0; i < 25; i++) {
    const addr = randomPick(addresses);
    const locksmith = randomPick(locksmiths);
    const customer = randomPick(customers);
    const createdAt = daysAgo(Math.floor(Math.random() * 30) + 1);
    const acceptedAt = new Date(createdAt.getTime() + 5 * 60000);
    const arrivedAt = new Date(acceptedAt.getTime() + 20 * 60000);
    const completedAt = new Date(arrivedAt.getTime() + 45 * 60000);
    const signedAt = new Date(completedAt.getTime() + 5 * 60000);

    const assessmentFee = 29 + Math.floor(Math.random() * 20);
    const quoteTotal = 100 + Math.floor(Math.random() * 200);

    const job = await prisma.job.create({
      data: {
        jobNumber: generateJobNumber(1000 + i),
        status: JobStatus.SIGNED,
        customerId: customer.id,
        locksmithId: locksmith.id,
        problemType: randomPick(problemTypes),
        propertyType: randomPick(propertyTypes),
        description: "Customer called for emergency locksmith service.",
        postcode: addr.postcode,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        assessmentFee,
        assessmentPaid: true,
        createdAt,
        acceptedAt,
        arrivedAt,
        diagnosedAt: new Date(arrivedAt.getTime() + 10 * 60000),
        workStartedAt: new Date(arrivedAt.getTime() + 15 * 60000),
        workCompletedAt: completedAt,
        signedAt,
      },
    });

    // Create quote for completed jobs
    await prisma.quote.create({
      data: {
        jobId: job.id,
        locksmithId: locksmith.id,
        lockType: randomPick(["euro-cylinder", "mortice", "night-latch", "multipoint"]),
        defect: "Lock mechanism required replacement",
        difficulty: randomPick(["easy", "medium", "hard"]),
        parts: [
          { name: "Euro Cylinder (Anti-Snap)", quantity: 1, unitPrice: 85, total: 85 },
        ],
        labourCost: quoteTotal - 85,
        labourTime: 30,
        partsTotal: 85,
        subtotal: quoteTotal,
        vat: quoteTotal * 0.2,
        total: quoteTotal * 1.2,
        accepted: true,
        acceptedAt: new Date(arrivedAt.getTime() + 12 * 60000),
      },
    });

    // Create payments
    await prisma.payment.createMany({
      data: [
        {
          jobId: job.id,
          type: "assessment",
          amount: assessmentFee,
          status: "succeeded",
          createdAt: acceptedAt,
        },
        {
          jobId: job.id,
          type: "quote",
          amount: quoteTotal * 1.2,
          status: "succeeded",
          createdAt: completedAt,
        },
      ],
    });

    // Create signature
    await prisma.signature.create({
      data: {
        jobId: job.id,
        signatureData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        signerName: customer.name,
        signerIp: "192.168.1.1",
        confirmsWork: true,
        confirmsPrice: true,
        confirmsSatisfied: true,
        signedAt,
      },
    });

    // Create review for some jobs
    if (Math.random() > 0.3) {
      await prisma.review.create({
        data: {
          jobId: job.id,
          customerId: customer.id,
          locksmithId: locksmith.id,
          rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
          comment: randomPick([
            "Excellent service, very professional!",
            "Quick response and fair pricing.",
            "Would definitely recommend.",
            "Very helpful and knowledgeable.",
            "Great job, thank you!",
            "Professional and courteous service.",
          ]),
          isPublic: true,
          createdAt: new Date(signedAt.getTime() + 60 * 60000),
        },
      });
    }

    jobs.push(job);
  }

  // 2. In-progress jobs
  for (let i = 0; i < 5; i++) {
    const addr = randomPick(addresses);
    const locksmith = randomPick(locksmiths);
    const customer = randomPick(customers);
    const createdAt = hoursAgo(Math.floor(Math.random() * 3) + 1);
    const acceptedAt = new Date(createdAt.getTime() + 5 * 60000);
    const arrivedAt = new Date(acceptedAt.getTime() + 15 * 60000);

    const job = await prisma.job.create({
      data: {
        jobNumber: generateJobNumber(2000 + i),
        status: JobStatus.IN_PROGRESS,
        customerId: customer.id,
        locksmithId: locksmith.id,
        problemType: randomPick(problemTypes),
        propertyType: randomPick(propertyTypes),
        description: "Emergency lockout service requested.",
        postcode: addr.postcode,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        assessmentFee: 35,
        assessmentPaid: true,
        createdAt,
        acceptedAt,
        arrivedAt,
        diagnosedAt: new Date(arrivedAt.getTime() + 10 * 60000),
        workStartedAt: new Date(arrivedAt.getTime() + 12 * 60000),
      },
    });

    // Create quote
    await prisma.quote.create({
      data: {
        jobId: job.id,
        locksmithId: locksmith.id,
        lockType: "euro-cylinder",
        defect: "Lock needs to be drilled and replaced",
        difficulty: "medium",
        parts: [
          { name: "Euro Cylinder (Anti-Snap)", quantity: 1, unitPrice: 85, total: 85 },
        ],
        labourCost: 80,
        labourTime: 45,
        partsTotal: 85,
        subtotal: 165,
        vat: 33,
        total: 198,
        accepted: true,
        acceptedAt: new Date(arrivedAt.getTime() + 11 * 60000),
      },
    });

    jobs.push(job);
  }

  // 3. Quoted jobs (waiting for customer response)
  for (let i = 0; i < 3; i++) {
    const addr = randomPick(addresses);
    const locksmith = randomPick(locksmiths);
    const customer = randomPick(customers);
    const createdAt = hoursAgo(Math.floor(Math.random() * 2) + 1);
    const acceptedAt = new Date(createdAt.getTime() + 5 * 60000);
    const arrivedAt = new Date(acceptedAt.getTime() + 20 * 60000);

    const job = await prisma.job.create({
      data: {
        jobNumber: generateJobNumber(3000 + i),
        status: JobStatus.QUOTED,
        customerId: customer.id,
        locksmithId: locksmith.id,
        problemType: randomPick(problemTypes),
        propertyType: randomPick(propertyTypes),
        description: "Lock repair service requested.",
        postcode: addr.postcode,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        assessmentFee: 35,
        assessmentPaid: true,
        createdAt,
        acceptedAt,
        arrivedAt,
        diagnosedAt: new Date(arrivedAt.getTime() + 10 * 60000),
      },
    });

    // Create quote
    await prisma.quote.create({
      data: {
        jobId: job.id,
        locksmithId: locksmith.id,
        lockType: "mortice",
        defect: "Mortice lock mechanism worn, requires replacement",
        difficulty: "hard",
        parts: [
          { name: "Mortice Lock (5-Lever)", quantity: 1, unitPrice: 120, total: 120 },
          { name: "Door Handle Set", quantity: 1, unitPrice: 55, total: 55 },
        ],
        labourCost: 90,
        labourTime: 60,
        partsTotal: 175,
        subtotal: 265,
        vat: 53,
        total: 318,
        accepted: false,
      },
    });

    jobs.push(job);
  }

  // 4. Accepted jobs (locksmith en route)
  for (let i = 0; i < 3; i++) {
    const addr = randomPick(addresses);
    const locksmith = randomPick(locksmiths);
    const customer = randomPick(customers);
    const createdAt = minutesAgo(Math.floor(Math.random() * 30) + 10);
    const acceptedAt = new Date(createdAt.getTime() + 5 * 60000);

    const job = await prisma.job.create({
      data: {
        jobNumber: generateJobNumber(4000 + i),
        status: JobStatus.ACCEPTED,
        customerId: customer.id,
        locksmithId: locksmith.id,
        problemType: randomPick(problemTypes),
        propertyType: randomPick(propertyTypes),
        description: "Emergency lockout - customer waiting outside.",
        postcode: addr.postcode,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        assessmentFee: 35,
        assessmentPaid: true,
        createdAt,
        acceptedAt,
      },
    });

    jobs.push(job);
  }

  // 5. Pending jobs (awaiting locksmith)
  for (let i = 0; i < 5; i++) {
    const addr = randomPick(addresses);
    const customer = randomPick(customers);
    const createdAt = minutesAgo(Math.floor(Math.random() * 20) + 2);

    const job = await prisma.job.create({
      data: {
        jobNumber: generateJobNumber(5000 + i),
        status: JobStatus.PENDING,
        customerId: customer.id,
        problemType: randomPick(problemTypes),
        propertyType: randomPick(propertyTypes),
        description: "Locked out and need urgent assistance.",
        postcode: addr.postcode,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        assessmentFee: 29,
        assessmentPaid: false,
        createdAt,
      },
    });

    // Create some applications from locksmiths
    const numApplications = Math.floor(Math.random() * 3) + 1;
    const shuffledLocksmiths = [...locksmiths].sort(() => Math.random() - 0.5);

    for (let j = 0; j < numApplications; j++) {
      await prisma.locksmithApplication.create({
        data: {
          jobId: job.id,
          locksmithId: shuffledLocksmiths[j].id,
          assessmentFee: 29 + Math.floor(Math.random() * 20),
          eta: 15 + Math.floor(Math.random() * 30),
          message: randomPick([
            "I'm nearby and can be there quickly.",
            "Available now with all necessary equipment.",
            "Experienced with this type of lock.",
            "On my way from another job nearby.",
          ]),
          status: "pending",
          createdAt: new Date(createdAt.getTime() + (j + 1) * 60000),
        },
      });
    }

    jobs.push(job);
  }

  console.log(`   ✓ Created ${jobs.length} jobs`);

  // =====================================================
  // PAYOUTS
  // =====================================================
  console.log("💰 Creating payouts...");

  // Create some historical payouts
  for (const locksmith of locksmiths.slice(0, 5)) {
    for (let week = 1; week <= 4; week++) {
      const periodEnd = daysAgo(week * 7);
      const periodStart = daysAgo(week * 7 + 7);
      const amount = 500 + Math.floor(Math.random() * 1000);
      const platformFee = amount * 0.1;

      await prisma.payout.create({
        data: {
          locksmithId: locksmith.id,
          amount,
          platformFee,
          netAmount: amount - platformFee,
          status: "paid",
          periodStart,
          periodEnd,
          jobIds: [],
          paidAt: periodEnd,
          createdAt: periodEnd,
        },
      });
    }
  }

  console.log(`   ✓ Created payouts for locksmiths`);

  // =====================================================
  // SERVICE AREAS
  // =====================================================
  console.log("🗺️  Creating service areas...");

  const serviceAreas = [
    {
      name: "London",
      slug: "london",
      postcodes: ["SW1", "SW2", "SW3", "SW4", "SW5", "W1", "W2", "W3", "E1", "E2", "E14", "SE1", "N1", "NW1", "EC1", "EC2"],
      description: "24/7 emergency locksmith services across Greater London. We cover all London postcodes with rapid response times.",
      metaTitle: "Emergency Locksmith London | 24/7 Service | LockSafe UK",
      metaDescription: "Need an emergency locksmith in London? Our verified locksmiths arrive in 15-30 minutes. Transparent pricing, no hidden fees. Call now!",
    },
    {
      name: "Manchester",
      slug: "manchester",
      postcodes: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"],
      description: "Professional locksmith services throughout Manchester and surrounding areas. Fast response, competitive prices.",
      metaTitle: "Emergency Locksmith Manchester | 24/7 Service | LockSafe UK",
      metaDescription: "Locked out in Manchester? Our local locksmiths provide fast, reliable service. Transparent pricing guaranteed. Available 24/7.",
    },
    {
      name: "Birmingham",
      slug: "birmingham",
      postcodes: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"],
      description: "Expert locksmith services in Birmingham. From emergency lockouts to security upgrades, we've got you covered.",
      metaTitle: "Emergency Locksmith Birmingham | 24/7 Service | LockSafe UK",
      metaDescription: "Birmingham emergency locksmith services. Verified professionals, transparent pricing, fast response. Call for immediate assistance.",
    },
    {
      name: "Leeds",
      slug: "leeds",
      postcodes: ["LS1", "LS2", "LS3", "LS4", "LS5", "LS6", "LS7", "LS8", "LS9"],
      description: "Trusted locksmith services in Leeds and West Yorkshire. Professional, reliable, and affordable.",
      metaTitle: "Emergency Locksmith Leeds | 24/7 Service | LockSafe UK",
      metaDescription: "Leeds locksmith services available 24/7. Emergency lockouts, lock repairs, security upgrades. Transparent pricing.",
    },
    {
      name: "Edinburgh",
      slug: "edinburgh",
      postcodes: ["EH1", "EH2", "EH3", "EH4", "EH5", "EH6", "EH7", "EH8", "EH9"],
      description: "Professional locksmith services across Edinburgh and the Lothians. Scottish locksmiths you can trust.",
      metaTitle: "Emergency Locksmith Edinburgh | 24/7 Service | LockSafe UK",
      metaDescription: "Edinburgh emergency locksmith. Fast response, fair prices, professional service. Available 24 hours a day, 7 days a week.",
    },
    {
      name: "Bristol",
      slug: "bristol",
      postcodes: ["BS1", "BS2", "BS3", "BS4", "BS5", "BS6", "BS7", "BS8"],
      description: "Reliable locksmith services in Bristol and the South West. From lockouts to full security solutions.",
      metaTitle: "Emergency Locksmith Bristol | 24/7 Service | LockSafe UK",
      metaDescription: "Bristol locksmith services. Emergency lockouts, lock changes, security advice. Transparent pricing, no call-out fees.",
    },
  ];

  await Promise.all(
    serviceAreas.map((area) =>
      prisma.serviceArea.create({
        data: {
          ...area,
          isActive: true,
        },
      })
    )
  );

  console.log(`   ✓ Created ${serviceAreas.length} service areas`);

  // =====================================================
  // FAQs
  // =====================================================
  console.log("❓ Creating FAQs...");

  const faqs = [
    {
      question: "How quickly can a locksmith arrive?",
      answer: "Our locksmiths typically arrive within 15-30 minutes of accepting your job request. You can track their location in real-time on our platform.",
      category: "service",
      order: 1,
    },
    {
      question: "What is the assessment fee?",
      answer: "The assessment fee covers the locksmith's travel to your location and initial diagnosis of the problem. This fee is agreed upfront before you book. If you proceed with the work, you'll receive a separate quote for the actual repair or replacement.",
      category: "pricing",
      order: 2,
    },
    {
      question: "Are your locksmiths verified?",
      answer: "Yes, all locksmiths on our platform are thoroughly vetted. We verify their identity, check their qualifications, confirm their insurance, and conduct background checks. Look for the verified badge on locksmith profiles.",
      category: "safety",
      order: 3,
    },
    {
      question: "What if I'm not happy with the quote?",
      answer: "You can decline the quote at no extra cost - you'll only pay the assessment fee. There's no obligation to proceed with the work, and you'll never face hidden charges.",
      category: "pricing",
      order: 4,
    },
    {
      question: "Do you work 24/7?",
      answer: "Yes, our platform operates 24 hours a day, 7 days a week. Emergency locksmiths are available around the clock for lockouts and urgent situations.",
      category: "service",
      order: 5,
    },
    {
      question: "What types of locks can you handle?",
      answer: "Our locksmiths can work with all types of locks including euro cylinders, mortice locks, night latches, multipoint locks, smart locks, and more. We cover residential, commercial, and automotive locksmithing.",
      category: "service",
      order: 6,
    },
    {
      question: "How do I pay?",
      answer: "All payments are handled securely through our platform using Stripe. We accept all major credit and debit cards. You'll never need to pay cash to the locksmith directly.",
      category: "pricing",
      order: 7,
    },
    {
      question: "What happens after the job is complete?",
      answer: "You'll receive a detailed digital report including photos, timeline, invoice, and your signature. This provides complete documentation for your records or insurance claims.",
      category: "service",
      order: 8,
    },
    {
      question: "Can I get a receipt for insurance purposes?",
      answer: "Absolutely. Every completed job generates a comprehensive PDF report that includes all details required for insurance claims: timestamps, photos, GPS verification, itemized invoice, and digital signature.",
      category: "general",
      order: 9,
    },
    {
      question: "What if there's a problem after the locksmith leaves?",
      answer: "If you experience any issues with the work performed, contact our support team immediately. All work comes with a satisfaction guarantee, and we'll work to resolve any problems quickly.",
      category: "general",
      order: 10,
    },
  ];

  await Promise.all(
    faqs.map((faq) =>
      prisma.fAQ.create({
        data: {
          ...faq,
          active: true,
        },
      })
    )
  );

  console.log(`   ✓ Created ${faqs.length} FAQs`);

  // =====================================================
  // BLOG POSTS
  // =====================================================
  console.log("📝 Creating blog posts...");

  const blogPosts = [
    {
      slug: "how-to-avoid-locksmith-scams",
      title: "How to Avoid Locksmith Scams: A Complete Guide",
      excerpt: "Learn the warning signs of locksmith scams and how to protect yourself when you're locked out.",
      content: `
# How to Avoid Locksmith Scams

Being locked out is stressful enough without falling victim to a scam. Unfortunately, the locksmith industry has its share of bad actors. Here's how to protect yourself.

## Warning Signs of a Scam

1. **No company name on the van** - Legitimate locksmiths display their company details
2. **Drastically low initial quotes** - If it sounds too good to be true, it probably is
3. **Insisting on drilling immediately** - Many locks can be opened without damage
4. **No identification or credentials** - Always ask to see ID
5. **Cash-only payments** - Professional locksmiths accept card payments

## How LockSafe Protects You

Our platform addresses these concerns by:

- Verifying all locksmith credentials before they join
- Showing transparent, upfront pricing
- Requiring digital documentation of all work
- Processing all payments securely through the platform
- Collecting verified customer reviews

Stay safe and always choose a verified locksmith!
      `.trim(),
      featuredImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
      metaTitle: "How to Avoid Locksmith Scams | LockSafe UK",
      metaDescription: "Protect yourself from locksmith scams. Learn the warning signs and how to choose a trustworthy locksmith.",
      keywords: ["locksmith scams", "avoid scams", "locksmith tips", "locksmith fraud"],
      authorName: "LockSafe Team",
      published: true,
      publishedAt: daysAgo(7),
    },
    {
      slug: "what-to-do-when-locked-out",
      title: "What to Do When You're Locked Out: A Step-by-Step Guide",
      excerpt: "Don't panic! Follow these steps to safely get back into your home when you're locked out.",
      content: `
# What to Do When You're Locked Out

It happens to everyone eventually. You've stepped outside for just a moment and the door has locked behind you. Here's what to do.

## Step 1: Stay Calm

Panic leads to poor decisions. Take a deep breath and assess the situation.

## Step 2: Check All Entry Points

Before calling anyone, check:
- Other doors (back door, side door, garage)
- Windows (but be careful!)
- Do you have a spare key with a neighbor or family member?

## Step 3: Call a Trusted Locksmith

If you can't find another way in, it's time to call a professional. Using a platform like LockSafe ensures you get:
- Verified, trustworthy locksmiths
- Transparent, upfront pricing
- Fast response times (typically 15-30 minutes)

## What NOT to Do

- Don't break a window - it's dangerous and expensive to repair
- Don't trust someone just because they show up with tools
- Don't pay cash without getting proper documentation

Stay prepared by saving a trusted locksmith's number in your phone!
      `.trim(),
      featuredImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
      metaTitle: "What to Do When Locked Out | Emergency Locksmith Guide",
      metaDescription: "Locked out of your home? Follow our step-by-step guide to safely get back inside. Tips from professional locksmiths.",
      keywords: ["locked out", "emergency locksmith", "lockout help", "lost keys"],
      authorName: "Mike Thompson",
      published: true,
      publishedAt: daysAgo(14),
    },
    {
      slug: "home-security-tips-2026",
      title: "Top 10 Home Security Tips for 2026",
      excerpt: "Protect your home with these expert security recommendations from professional locksmiths.",
      content: `
# Top 10 Home Security Tips for 2026

Home security technology continues to evolve. Here are our top recommendations for keeping your home safe.

## 1. Upgrade to Anti-Snap Cylinders

Standard euro cylinders can be snapped in seconds. Anti-snap cylinders provide much better protection.

## 2. Install a Smart Doorbell

Video doorbells let you see who's at your door from anywhere.

## 3. Use Timer Switches for Lights

Make it look like someone's home even when you're away.

## 4. Secure Your Garage

The garage is often the weakest point of home security.

## 5. Don't Hide Keys Outside

Key safes are a much better option than hiding keys under mats or plant pots.

## 6. Keep Hedges Trimmed

Don't give burglars places to hide.

## 7. Install Window Locks

Many break-ins happen through unsecured windows.

## 8. Get to Know Your Neighbors

A watchful community is one of the best deterrents.

## 9. Consider a Monitored Alarm

Modern alarm systems offer affordable 24/7 monitoring.

## 10. Regular Security Audits

Have a professional assess your home's vulnerabilities.

Need help implementing any of these tips? Our verified locksmiths can advise on the best solutions for your home.
      `.trim(),
      featuredImage: "https://images.unsplash.com/photo-1558002038-1055907df827?w=800",
      metaTitle: "Top 10 Home Security Tips 2026 | Expert Advice",
      metaDescription: "Protect your home with these expert security tips. From smart locks to basic precautions, learn how to keep burglars out.",
      keywords: ["home security", "security tips", "burglary prevention", "home protection"],
      authorName: "Sarah Davis",
      published: true,
      publishedAt: daysAgo(21),
    },
  ];

  await Promise.all(
    blogPosts.map((post) =>
      prisma.blogPost.create({
        data: post,
      })
    )
  );

  console.log(`   ✓ Created ${blogPosts.length} blog posts`);

  // =====================================================
  // ANALYTICS EVENTS (sample data for the dashboard)
  // =====================================================
  console.log("📊 Creating analytics events...");

  const eventTypes = ["page_view", "job_created", "job_completed", "quote_accepted", "payment_received"];

  // Create analytics events in batches for performance
  const analyticsEvents = [];
  for (let day = 0; day < 30; day++) {
    const date = daysAgo(day);
    const numEvents = Math.floor(Math.random() * 10) + 5; // Reduced count

    for (let i = 0; i < numEvents; i++) {
      const eventDate = new Date(date);
      eventDate.setHours(Math.floor(Math.random() * 24));
      eventDate.setMinutes(Math.floor(Math.random() * 60));

      analyticsEvents.push({
        type: randomPick(eventTypes),
        data: {
          page: randomPick(["/", "/request", "/locksmith/dashboard", "/admin"]),
          value: Math.floor(Math.random() * 500),
        },
        sessionId: `session-${Math.random().toString(36).substring(7)}`,
        createdAt: eventDate,
      });
    }
  }

  // Batch insert analytics events
  await prisma.analyticsEvent.createMany({
    data: analyticsEvents,
  });

  console.log(`   ✓ Created ${analyticsEvents.length} analytics events`);

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log("\n✅ Seed completed successfully!\n");
  console.log("📋 Summary:");
  console.log(`   • Admin users: 2`);
  console.log(`   • Locksmiths: ${locksmiths.length}`);
  console.log(`   • Customers: ${customers.length}`);
  console.log(`   • Jobs: ${jobs.length}`);
  console.log(`   • Service areas: ${serviceAreas.length}`);
  console.log(`   • FAQs: ${faqs.length}`);
  console.log(`   • Blog posts: ${blogPosts.length}`);
  console.log("\n🔑 Login credentials:");
  console.log("   Admin:     admin@locksafe.co.uk / demo123");
  console.log("   Locksmith: mike@thompsonlocks.co.uk / demo123");
  console.log("   (All locksmiths use password: demo123)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
