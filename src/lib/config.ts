// Site configuration - uses environment variables for flexibility
const DEFAULT_SUPPORT_PHONE = "+44 20 4577 1989";
const DEFAULT_LOCKSMITH_ADMIN_PHONE = "07818 333 989";

function toTelHref(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function toWhatsappPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const configuredSupportPhone =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE ||
  process.env.RETELL_PHONE_NUMBER ||
  DEFAULT_SUPPORT_PHONE;

const configuredSupportPhoneTel =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE_TEL || toTelHref(configuredSupportPhone);

const configuredLocksmithAdminPhone =
  process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE || DEFAULT_LOCKSMITH_ADMIN_PHONE;

const configuredLocksmithAdminPhoneTel =
  process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE_TEL ||
  toTelHref(configuredLocksmithAdminPhone);

const configuredLocksmithAdminWhatsapp =
  process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_WHATSAPP ||
  toWhatsappPhone(configuredLocksmithAdminPhoneTel);

export const siteConfig = {
  // Main site URL - change this in .env when you buy a domain
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk",

  // Site name
  name: "LockSafe UK",

  // Support contact
  supportEmail: "contact@locksafe.uk",
  helpEmail: "contact@locksafe.uk",

  // Phone number
  phone: configuredSupportPhone,
  phoneFormatted: configuredSupportPhoneTel,

  // Social
  twitter: "@locksafeuk",
} as const;

// Export individual constants for convenience
export const SITE_URL = siteConfig.url;
export const SITE_NAME = siteConfig.name;
export const SUPPORT_EMAIL = siteConfig.supportEmail;
export const SUPPORT_PHONE = siteConfig.phone;
export const SUPPORT_PHONE_TEL = siteConfig.phoneFormatted;
export const LOCKSMITH_ADMIN_PHONE = configuredLocksmithAdminPhone;
export const LOCKSMITH_ADMIN_PHONE_TEL = configuredLocksmithAdminPhoneTel;
export const LOCKSMITH_ADMIN_WHATSAPP = configuredLocksmithAdminWhatsapp;

// Helper to get full URL for a path
export function getFullUrl(path: string = ""): string {
  const baseUrl = siteConfig.url.replace(/\/$/, ""); // Remove trailing slash
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
