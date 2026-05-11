/**
 * URL helpers for the programmatic SEO surfaces.
 * Single source of truth so callers never hand-roll path strings.
 */
import { getFullUrl } from "@/lib/config";

export const intentUrl = (slug: string) => `/intent/${slug}`;
export const intentGeoUrl = (slug: string, citySlug: string) =>
  `/intent/${slug}/in/${citySlug}`;
export const serviceUrl = (service: string) => `/services/${service}`;
export const serviceGeoUrl = (service: string, citySlug: string) =>
  `/services/${service}/in/${citySlug}`;
export const cityUrl = (citySlug: string) => `/locksmith-${citySlug}`;
export const cityAreaUrl = (citySlug: string, areaSlug: string) =>
  `/locksmith-${citySlug}/${areaSlug}`;
export const postcodeUrl = (postcodeSlug: string) =>
  `/emergency-locksmith-${postcodeSlug}`;
export const postcodeServiceUrl = (postcodeSlug: string, service: string) =>
  `/emergency-locksmith-${postcodeSlug}/${service}`;

export const canonical = (path: string) => getFullUrl(path);

/** Slugify a human label for use as an in-page anchor or URL segment. */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
