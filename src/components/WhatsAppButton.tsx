"use client";

import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";

export interface WhatsAppClickContext {
  /** What the link points to. */
  targetType: "locksmith" | "lead" | "customer";
  /** DB id of the target entity. */
  targetId: string;
  /** Optional related job id, for jobs-page buttons. */
  jobId?: string;
}

export interface WhatsAppButtonProps {
  /** Recipient phone (any common format — UK 07…, +44…, 44…, or international). */
  phone: string | null | undefined;
  /** Pre-filled message body. Keep ≤200 chars; some WA clients truncate. */
  message?: string;
  /** Visible label. Defaults to "WhatsApp". Hidden when iconOnly. */
  label?: string;
  /** Render only the icon (compact rows). */
  iconOnly?: boolean;
  /** Sizing for the button. */
  size?: "sm" | "md";
  /** Context for the click audit log. If omitted, no log call is made. */
  context?: WhatsAppClickContext;
  /** Optional extra className for layout overrides. */
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<WhatsAppButtonProps["size"]>, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

const ICON_ONLY_SIZE_CLASSES: Record<
  NonNullable<WhatsAppButtonProps["size"]>,
  string
> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

/**
 * Click-to-chat WhatsApp button.
 *
 * Opens `https://wa.me/<phone>?text=<message>` in a new tab. Works on
 * desktop (WhatsApp Web) and mobile (deep-links into the WhatsApp app).
 * Outbound identity is whichever WhatsApp account is logged into the
 * admin's device — operational policy is the LockSafe business number
 * +447818333989 logged into WhatsApp Business on the admin device.
 *
 * If `phone` cannot be normalised, the button renders disabled with a
 * tooltip explaining why (so Ops can spot missing data).
 *
 * If `context` is supplied, an authenticated fire-and-forget POST is
 * sent to `/api/admin/whatsapp/click` before navigation. The fetch is
 * non-blocking and any failure is silently ignored — the admin still
 * gets to WhatsApp.
 */
export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  iconOnly = false,
  size = "sm",
  context,
  className = "",
}: WhatsAppButtonProps) {
  const url = buildWhatsAppUrl(phone, message);

  const sizeClass = iconOnly
    ? ICON_ONLY_SIZE_CLASSES[size]
    : SIZE_CLASSES[size];

  const baseClass = `inline-flex items-center justify-center rounded-md font-medium transition-colors ${sizeClass} ${className}`;

  if (!url) {
    return (
      <span
        title="No phone on file"
        aria-disabled="true"
        className={`${baseClass} bg-slate-100 text-slate-400 cursor-not-allowed`}
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        {!iconOnly && <span>{label}</span>}
      </span>
    );
  }

  const handleClick = () => {
    if (!context) return;
    // Fire-and-forget. The browser opens the new tab via the anchor's
    // default action in the same user gesture, so this fetch doesn't
    // block or race the navigation. Errors are silently ignored.
    try {
      fetch("/api/admin/whatsapp/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: context.targetType,
          targetId: context.targetId,
          jobId: context.jobId ?? null,
          phone,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* noop */
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title={iconOnly ? `${label}${message ? `: ${message.slice(0, 60)}` : ""}` : undefined}
      className={`${baseClass} bg-[#25D366] hover:bg-[#1ebe57] text-white`}
    >
      <MessageCircle className="w-4 h-4" aria-hidden="true" />
      {!iconOnly && <span>{label}</span>}
    </a>
  );
}

export default WhatsAppButton;
