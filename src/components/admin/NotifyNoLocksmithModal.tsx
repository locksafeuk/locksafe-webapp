"use client";

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

interface NotifyJob {
  id: string;
  jobNumber: string;
  postcode: string;
  problemType: string;
  customer?: {
    name: string;
    phone: string;
    email?: string | null;
  } | null;
}

interface NotifyNoLocksmithModalProps {
  job: NotifyJob | null;
  onClose: () => void;
  onSent: () => void;
  toast?: (opts: {
    title: string;
    description?: string;
    variant?: "default" | "success" | "error" | "warning";
  }) => void;
}

const SITE_URL = "https://locksafe.uk";
const SUPPORT_PHONE = "07818 333 989";

function buildDefaultSms(args: {
  customerName: string;
  jobNumber: string;
  postcode: string;
  jobId: string;
}): string {
  const firstName = args.customerName.split(" ")[0] || args.customerName;
  const url = `${SITE_URL}/customer/job/${args.jobId}`;
  return (
    `LockSafe UK: Hi ${firstName}, honest update on ${args.jobNumber} — ` +
    `no verified locksmith free in ${args.postcode} right now. ` +
    `Don't wait: call our priority line ${SUPPORT_PHONE} and we'll hand-match you in ~15 mins. ` +
    `Or widen radius/cancel here: ${url} — assessment fee fully refundable.`
  );
}

export function NotifyNoLocksmithModal({
  job,
  onClose,
  onSent,
  toast,
}: NotifyNoLocksmithModalProps) {
  const hasPhone = !!job?.customer?.phone;
  const hasEmail = !!job?.customer?.email;

  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [smsBody, setSmsBody] = useState<string>(() =>
    job
      ? buildDefaultSms({
          customerName: job.customer?.name || "there",
          jobNumber: job.jobNumber,
          postcode: job.postcode,
          jobId: job.id,
        })
      : "",
  );
  const [isSending, setIsSending] = useState(false);

  const smsCount = smsBody.length;
  const segments = useMemo(() => {
    if (smsCount === 0) return 0;
    if (smsCount <= 160) return 1;
    return Math.ceil(smsCount / 153);
  }, [smsCount]);

  if (!job) return null;

  const canSubmit =
    !isSending &&
    ((sendSms && hasPhone) || (sendEmail && hasEmail)) &&
    (!sendSms || smsBody.trim().length > 0);

  const handleSubmit = async () => {
    const channels: ("sms" | "email")[] = [];
    if (sendSms && hasPhone) channels.push("sms");
    if (sendEmail && hasEmail) channels.push("email");
    if (channels.length === 0) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/notify-no-locksmith`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels,
          customSmsMessage: sendSms ? smsBody : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast?.({
          title: "Customer notified",
          description: `Sent via ${data.channelsSent.join(" + ")}`,
        });
        onSent();
        onClose();
      } else {
        const failed: string[] = [];
        if (data.smsResult && !data.smsResult.success) {
          failed.push(`SMS: ${data.smsResult.error || "failed"}`);
        }
        if (data.emailResult && !data.emailResult.success) {
          failed.push(`Email: ${data.emailResult.error || "failed"}`);
        }
        toast?.({
          title: "Notification failed",
          description:
            failed.join(" · ") ||
            data.error ||
            "Unknown error — see server logs",
          variant: "error",
        });
      }
    } catch (err) {
      console.error("[NotifyNoLocksmith] error:", err);
      toast?.({
        title: "Network error",
        description: "Could not reach the server",
        variant: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 lg:p-6 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-500" />
              Notify customer: no locksmith available
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sends an empathetic update + priority line offer for{" "}
              {job.jobNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 lg:p-6 space-y-5">
          {/* Job context */}
          <div className="bg-slate-50 rounded-lg p-3 lg:p-4">
            <div className="text-sm font-semibold text-slate-900 mb-1">
              {job.jobNumber}
            </div>
            <div className="text-xs text-slate-600 mb-1">
              {job.problemType} · {job.postcode}
            </div>
            {job.customer && (
              <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                <div className="text-slate-500">
                  Customer:{" "}
                  <span className="text-slate-700 font-medium">
                    {job.customer.name}
                  </span>
                </div>
                <div className="text-slate-500">
                  Phone:{" "}
                  <span
                    className={
                      hasPhone ? "text-slate-700" : "text-red-500 italic"
                    }
                  >
                    {job.customer.phone || "missing"}
                  </span>
                </div>
                <div className="text-slate-500 sm:col-span-2">
                  Email:{" "}
                  <span
                    className={
                      hasEmail ? "text-slate-700" : "text-red-500 italic"
                    }
                  >
                    {job.customer.email || "missing"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Channel checkboxes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Send via
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer ${
                  hasPhone
                    ? sendSms
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                    : "border-slate-200 opacity-50 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendSms && hasPhone}
                  disabled={!hasPhone}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="mt-0.5 accent-orange-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" /> SMS (Zadarma)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {hasPhone ? "Editable below" : "Customer phone missing"}
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer ${
                  hasEmail
                    ? sendEmail
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                    : "border-slate-200 opacity-50 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendEmail && hasEmail}
                  disabled={!hasEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="mt-0.5 accent-orange-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                    <Mail className="w-4 h-4" /> Email (Resend)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {hasEmail
                      ? "Brand template (preview below)"
                      : "Customer email missing"}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* SMS body editor */}
          {sendSms && hasPhone && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  SMS message
                </label>
                <span
                  className={`text-xs ${
                    smsCount > 320 ? "text-red-500" : "text-slate-500"
                  }`}
                >
                  {smsCount} chars · {segments} segment
                  {segments === 1 ? "" : "s"}
                </span>
              </div>
              <textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Tip: keep under 320 chars (2 segments) to avoid splitting on
                Zadarma.
              </p>
            </div>
          )}

          {/* Email preview */}
          {sendEmail && hasEmail && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              <div className="font-medium text-slate-700 mb-1">
                Email preview
              </div>
              <div className="text-slate-600">
                <strong>Subject:</strong> Quick update on your locksmith request{" "}
                {job.jobNumber}
              </div>
              <div className="text-slate-600 mt-1">
                <strong>Body:</strong> Empathetic open → honest news → priority
                phone line CTA → widen-radius / refund options → 100%
                assessment-fee refund guarantee.
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                The customer will see this within seconds. Outcome is logged on
                the job (audit trail) once at least one channel succeeds.
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 border-t flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send notification
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
