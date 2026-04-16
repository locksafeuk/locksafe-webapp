// Site configuration - uses environment variables for flexibility
export const siteConfig = {
  // Main site URL - change this in .env when you buy a domain
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.co.uk",

  // Site name
  name: "LockSafe UK",

  // Support contact
  supportEmail: "contact@locksafe.uk",
  helpEmail: "contact@locksafe.uk",

  // Phone number
  phone: "07818 333 989",
  phoneFormatted: "07818-333-989",

  // Social
  twitter: "@locksafeuk",
} as const;

// Export individual constants for convenience
export const SITE_URL = siteConfig.url;
export const SITE_NAME = siteConfig.name;
export const SUPPORT_EMAIL = siteConfig.supportEmail;
export const SUPPORT_PHONE = siteConfig.phone;

// Helper to get full URL for a path
export function getFullUrl(path: string = ""): string {
  const baseUrl = siteConfig.url.replace(/\/$/, ""); // Remove trailing slash
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
