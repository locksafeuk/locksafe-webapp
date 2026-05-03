/**
 * Orchestrates the "no locksmith available" notification sent by an admin
 * from /admin/jobs.
 *
 * - SMS goes via Zadarma (`sendZadarmaSMS`).
 * - Email goes via Resend (`sendNoLocksmithAvailableEmail`).
 *
 * Copy follows Neil Patel + Ryan Deiss conversion principles:
 * empathy → honest news → immediate alternative path → soft urgency →
 * risk reversal close (full refund of assessment fee).
 */

import { SITE_URL, SUPPORT_PHONE, siteConfig } from "@/lib/config";
import { sendNoLocksmithAvailableEmail } from "@/lib/email";
import type { SMSResult } from "@/lib/sms";
import { sendZadarmaSMS } from "@/lib/sms-zadarma";

export type NotifyChannel = "sms" | "email";

export interface NotifyNoLocksmithJob {
  id: string;
  jobNumber: string;
  postcode: string;
  problemType?: string | null;
}

export interface NotifyNoLocksmithCustomer {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface NotifyNoLocksmithInput {
  job: NotifyNoLocksmithJob;
  customer: NotifyNoLocksmithCustomer;
  channels: NotifyChannel[];
  /** Optional admin override of the SMS body. Email always uses the brand template. */
  customSmsMessage?: string;
}

export interface NotifyNoLocksmithResult {
  smsResult?: SMSResult;
  emailResult?: {
    success: boolean;
    id?: string;
    error?: string;
    mock?: boolean;
  };
  channelsAttempted: NotifyChannel[];
  channelsSent: NotifyChannel[];
}

/**
 * Build the default SMS body. Kept under ~320 chars (max 2 GSM-7 segments)
 * so it sends reliably on Zadarma without being chunked into 4+ parts.
 */
export function buildNoLocksmithSms(input: {
  customerName: string;
  jobNumber: string;
  postcode: string;
  priorityPhone: string;
  jobUrl: string;
}): string {
  const firstName = input.customerName.split(" ")[0] || input.customerName;
  return (
    `LockSafe UK: Hi ${firstName}, honest update on ${input.jobNumber} — ` +
    `no verified locksmith free in ${input.postcode} right now. ` +
    `Don't wait: call our priority line ${input.priorityPhone} and we'll hand-match you in ~15 mins. ` +
    `Or widen radius/cancel here: ${input.jobUrl} — assessment fee fully refundable.`
  );
}

function buildJobUrl(jobId: string): string {
  return `${SITE_URL.replace(/\/$/, "")}/customer/job/${jobId}`;
}

function toTelHref(phone: string): string {
  return phone.replace(/\s+/g, "");
}

export async function notifyNoLocksmithAvailable(
  input: NotifyNoLocksmithInput,
): Promise<NotifyNoLocksmithResult> {
  const { job, customer, channels, customSmsMessage } = input;
  const priorityPhone = SUPPORT_PHONE || siteConfig.phone;
  const jobUrl = buildJobUrl(job.id);

  const channelsAttempted: NotifyChannel[] = [];
  const channelsSent: NotifyChannel[] = [];
  const result: NotifyNoLocksmithResult = {
    channelsAttempted,
    channelsSent,
  };

  if (channels.includes("sms")) {
    channelsAttempted.push("sms");
    if (!customer.phone) {
      result.smsResult = {
        success: false,
        error: "Customer has no phone on file",
      };
    } else {
      const message =
        customSmsMessage?.trim() ||
        buildNoLocksmithSms({
          customerName: customer.name,
          jobNumber: job.jobNumber,
          postcode: job.postcode,
          priorityPhone,
          jobUrl,
        });
      result.smsResult = await sendZadarmaSMS(customer.phone, message, {
        logContext: `no-locksmith:${job.jobNumber}`,
      });
      if (result.smsResult.success) channelsSent.push("sms");
    }
  }

  if (channels.includes("email")) {
    channelsAttempted.push("email");
    if (!customer.email) {
      result.emailResult = {
        success: false,
        error: "Customer has no email on file",
      };
    } else {
      result.emailResult = await sendNoLocksmithAvailableEmail(customer.email, {
        customerName: customer.name,
        jobNumber: job.jobNumber,
        postcode: job.postcode,
        problemType: job.problemType ?? undefined,
        jobUrl,
        priorityPhone,
        priorityPhoneTel: toTelHref(priorityPhone),
      });
      if (result.emailResult.success) channelsSent.push("email");
    }
  }

  return result;
}
