import { SITE_URL } from "@/lib/config";
import { sendCustomerPaymentLinkEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { sendSMS } from "@/lib/sms";

type SendCustomerCalloutPaymentRequestInput = {
  jobId: string;
  jobNumber: string;
  applicationId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  locksmithName: string;
  locksmithCompany?: string | null;
  assessmentFee: number;
  etaMinutes?: number | null;
  problemType?: string | null;
  address?: string | null;
  postcode?: string | null;
};

type SendCustomerCalloutPaymentRequestResult = {
  paymentUrl: string;
  smsQueued: boolean;
  emailQueued: boolean;
  notificationQueued: boolean;
};

function buildProblemTypeLabel(type?: string | null): string {
  const labels: Record<string, string> = {
    lockout: "Locked Out",
    broken: "Broken Lock",
    "key-stuck": "Key Stuck",
    "lost-keys": "Lost Keys",
    burglary: "After Burglary",
    "lock-change": "Lock Change",
    other: "Other Issue",
  };

  if (!type) return "Emergency Locksmith Service";
  return labels[type] || type;
}

function buildPaymentUrl(jobId: string, applicationId: string): string {
  const params = new URLSearchParams({
    applicationId,
    pay: "1",
  });
  return `${SITE_URL}/customer/job/${jobId}?${params.toString()}`;
}

export async function sendCustomerCalloutPaymentRequest(
  input: SendCustomerCalloutPaymentRequestInput,
): Promise<SendCustomerCalloutPaymentRequestResult> {
  const paymentUrl = buildPaymentUrl(input.jobId, input.applicationId);

  let smsQueued = false;
  let emailQueued = false;
  let notificationQueued = false;

  if (input.customerPhone) {
    const etaText = input.etaMinutes && input.etaMinutes > 0
      ? `${input.etaMinutes} minutes`
      : "ASAP";

    const smsMessage = `🔐 LockSafe UK: ${input.locksmithName} has accepted your job ${input.jobNumber}.

Call-out fee: £${input.assessmentFee.toFixed(2)}
Estimated Arrival: ${etaText}

Please pay to confirm:
${paymentUrl}

Questions? Call us: +44 20 4577 1989`;

    sendSMS(input.customerPhone, smsMessage).catch((err) => {
      console.error("[Payment Request] Failed to send customer SMS:", err);
    });
    smsQueued = true;
  }

  if (input.customerEmail) {
    sendCustomerPaymentLinkEmail(input.customerEmail, {
      customerName: input.customerName,
      jobNumber: input.jobNumber,
      locksmithName: input.locksmithName,
      locksmithCompany: input.locksmithCompany || undefined,
      assessmentFee: input.assessmentFee,
      eta: input.etaMinutes && input.etaMinutes > 0 ? input.etaMinutes : 0,
      paymentUrl,
      problemType: buildProblemTypeLabel(input.problemType),
      address: `${input.address || ""}${input.postcode ? `, ${input.postcode}` : ""}`.replace(/^,\s*/, "") || "Address to be confirmed",
    }).catch((err) => {
      console.error("[Payment Request] Failed to send customer email:", err);
    });
    emailQueued = true;
  }

  await createNotification({
    customerId: input.customerId,
    jobId: input.jobId,
    type: "locksmith_accepted",
    title: "Locksmith Assigned",
    message: `${input.locksmithName} has accepted your job ${input.jobNumber}. Please pay the call-out fee to confirm.`,
    actionUrl: `/customer/job/${input.jobId}`,
    actionLabel: "Pay Now",
    data: {
      assessmentFee: input.assessmentFee,
      eta: input.etaMinutes,
      locksmithName: input.locksmithName,
      applicationId: input.applicationId,
    },
  }).catch((err) => {
    console.error("[Payment Request] Failed to create customer notification:", err);
  });
  notificationQueued = true;

  return {
    paymentUrl,
    smsQueued,
    emailQueued,
    notificationQueued,
  };
}
