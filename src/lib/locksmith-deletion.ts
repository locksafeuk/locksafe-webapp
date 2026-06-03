import prisma from "@/lib/db";

export interface DeleteLocksmithResult {
  locksmithName: string;
  deletedJobNumbers: string[];
  deletedJobCount: number;
  relatedCounts: {
    companyLinks: number;
    ownedCompanies: number;
    stripeReminderLogs: number;
    baseLocationReminderLogs: number;
  };
}

export async function deleteLocksmithCascade(locksmithId: string): Promise<DeleteLocksmithResult> {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    include: {
      _count: {
        select: {
          jobs: true,
          quotes: true,
          applications: true,
          payouts: true,
          reviews: true,
        },
      },
    },
  });

  if (!locksmith) {
    throw new Error("LOCKSMITH_NOT_FOUND");
  }

  const locksmithJobs = await prisma.job.findMany({
    where: { locksmithId },
    select: { id: true, jobNumber: true },
  });
  const jobIds = locksmithJobs.map((job) => job.id);

  const companyLinks = await prisma.locksmithCompanyMember.count({
    where: { locksmithId },
  });
  const ownedCompanies = await prisma.locksmithCompany.count({
    where: { ownerId: locksmithId },
  });
  const stripeReminderLogs = await prisma.stripeReminderLog.count({
    where: { locksmithId },
  });
  const baseLocationReminderLogs = await prisma.baseLocationReminderLog.count({
    where: { locksmithId },
  });

  await prisma.$transaction([
    prisma.locksmithCompany.updateMany({
      where: { ownerId: locksmithId },
      data: { ownerId: null },
    }),
    prisma.jobAuction.updateMany({
      where: { acceptedByLocksmithId: locksmithId },
      data: { acceptedByLocksmithId: null },
    }),

    prisma.report.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.photo.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.signature.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.payment.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.review.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.locksmithApplication.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.quote.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.jobMessage.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.jobAuction.deleteMany({
      where: { jobId: { in: jobIds } },
    }),
    prisma.job.deleteMany({
      where: { locksmithId },
    }),

    prisma.locksmithApplication.deleteMany({
      where: { locksmithId },
    }),
    prisma.quote.deleteMany({
      where: { locksmithId },
    }),
    prisma.payout.deleteMany({
      where: { locksmithId },
    }),
    prisma.review.deleteMany({
      where: { locksmithId },
    }),
    prisma.notification.deleteMany({
      where: { locksmithId },
    }),
    prisma.emailRecipient.deleteMany({
      where: { locksmithId },
    }),
    prisma.locksmithCompanyMember.deleteMany({
      where: { locksmithId },
    }),
    prisma.stripeReminderLog.deleteMany({
      where: { locksmithId },
    }),
    prisma.baseLocationReminderLog.deleteMany({
      where: { locksmithId },
    }),
    prisma.appInstallReminderLog.deleteMany({
      where: { locksmithId },
    }),
    prisma.locksmith.delete({
      where: { id: locksmithId },
    }),
  ]);

  return {
    locksmithName: locksmith.name,
    deletedJobNumbers: locksmithJobs.map((job) => job.jobNumber),
    deletedJobCount: locksmithJobs.length,
    relatedCounts: {
      companyLinks,
      ownedCompanies,
      stripeReminderLogs,
      baseLocationReminderLogs,
    },
  };
}
