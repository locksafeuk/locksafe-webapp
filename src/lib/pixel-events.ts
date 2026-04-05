/**
 * Enhanced Pixel Events Helper
 *
 * Provides unified tracking with:
 * - Browser-side Meta Pixel (fbq)
 * - Server-side Conversions API
 * - Event deduplication
 * - User matching parameters
 * - fbc/fbp cookie handling
 */

import { hashForMeta, sendConversionsAPIEvent, type ConversionsAPIEvent } from './meta-marketing';

// Types
export interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalId?: string; // Your internal user ID
  clientIp?: string;
  userAgent?: string;
  fbc?: string; // Facebook click ID from cookie
  fbp?: string; // Facebook browser ID from cookie
}

export interface EventData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: string;
  orderId?: string;
  numItems?: number;
  searchString?: string;
  status?: string;
}

export interface TrackEventParams {
  eventName: string;
  eventId?: string; // For deduplication - same ID used for browser + server
  userData?: UserData;
  eventData?: EventData;
  sourceUrl?: string;
}

// ===================
// COOKIE HELPERS
// ===================

/**
 * Parse fbc (Facebook Click ID) from URL or cookie
 * Format: fb.1.timestamp.fbclid
 */
export function getFbc(fbclid?: string, existingFbc?: string): string | undefined {
  if (existingFbc) return existingFbc;
  if (!fbclid) return undefined;

  const timestamp = Date.now();
  return `fb.1.${timestamp}.${fbclid}`;
}

/**
 * Parse fbp (Facebook Browser ID) from cookie or generate new
 * Format: fb.1.timestamp.random
 */
export function getFbp(existingFbp?: string): string {
  if (existingFbp) return existingFbp;

  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000000000);
  return `fb.1.${timestamp}.${random}`;
}

/**
 * Extract fbclid from URL
 */
export function extractFbclid(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('fbclid') || undefined;
  } catch {
    return undefined;
  }
}

// ===================
// EVENT ID GENERATION
// ===================

/**
 * Generate a unique event ID for deduplication
 * This ID should be used for both browser and server events
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${random}`;
}

// ===================
// SERVER-SIDE TRACKING
// ===================

/**
 * Send event to Meta Conversions API
 * This should be called from your API routes
 */
export async function trackServerEvent(params: TrackEventParams): Promise<{
  success: boolean;
  eventId: string;
  error?: string;
}> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('Meta Pixel or Conversions API token not configured');
    return { success: false, eventId: params.eventId || '', error: 'Not configured' };
  }

  const eventId = params.eventId || generateEventId();

  // Build user data with hashing
  const userData: ConversionsAPIEvent['user_data'] = {};

  if (params.userData) {
    if (params.userData.email) {
      userData.em = [hashForMeta(params.userData.email)];
    }
    if (params.userData.phone) {
      // Normalize phone: remove non-digits, add country code if missing
      const phone = params.userData.phone.replace(/\D/g, '');
      userData.ph = [hashForMeta(phone)];
    }
    if (params.userData.firstName) {
      userData.fn = [hashForMeta(params.userData.firstName)];
    }
    if (params.userData.lastName) {
      userData.ln = [hashForMeta(params.userData.lastName)];
    }
    if (params.userData.city) {
      userData.ct = [hashForMeta(params.userData.city)];
    }
    if (params.userData.state) {
      userData.st = [hashForMeta(params.userData.state)];
    }
    if (params.userData.zipCode) {
      userData.zp = [hashForMeta(params.userData.zipCode)];
    }
    if (params.userData.country) {
      userData.country = [hashForMeta(params.userData.country)];
    }
    if (params.userData.externalId) {
      userData.external_id = [hashForMeta(params.userData.externalId)];
    }
    if (params.userData.clientIp) {
      userData.client_ip_address = params.userData.clientIp;
    }
    if (params.userData.userAgent) {
      userData.client_user_agent = params.userData.userAgent;
    }
    if (params.userData.fbc) {
      userData.fbc = params.userData.fbc;
    }
    if (params.userData.fbp) {
      userData.fbp = params.userData.fbp;
    }
  }

  // Build custom data
  const customData: ConversionsAPIEvent['custom_data'] = {};

  if (params.eventData) {
    if (params.eventData.value !== undefined) {
      customData.value = params.eventData.value;
    }
    if (params.eventData.currency) {
      customData.currency = params.eventData.currency;
    }
    if (params.eventData.contentName) {
      customData.content_name = params.eventData.contentName;
    }
    if (params.eventData.contentCategory) {
      customData.content_category = params.eventData.contentCategory;
    }
    if (params.eventData.contentIds) {
      customData.content_ids = params.eventData.contentIds;
    }
    if (params.eventData.contentType) {
      customData.content_type = params.eventData.contentType;
    }
    if (params.eventData.orderId) {
      customData.order_id = params.eventData.orderId;
    }
    if (params.eventData.numItems !== undefined) {
      customData.num_items = params.eventData.numItems;
    }
  }

  const event: ConversionsAPIEvent = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: params.sourceUrl,
    action_source: 'website',
    user_data: userData,
    custom_data: Object.keys(customData).length > 0 ? customData : undefined,
  };

  try {
    await sendConversionsAPIEvent(pixelId, accessToken, [event]);
    return { success: true, eventId };
  } catch (error) {
    console.error('Error sending Conversions API event:', error);
    return {
      success: false,
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ===================
// STANDARD EVENTS
// ===================

/**
 * Track a Lead event (form submission, inquiry)
 */
export async function trackLead(params: {
  userData: UserData;
  value?: number;
  contentName?: string;
  sourceUrl?: string;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId();

  await trackServerEvent({
    eventName: 'Lead',
    eventId,
    userData: params.userData,
    eventData: {
      value: params.value || 50, // Default lead value
      currency: 'GBP',
      contentName: params.contentName || 'Lead Form',
      contentCategory: 'locksmith',
    },
    sourceUrl: params.sourceUrl,
  });

  return { eventId };
}

/**
 * Track a Purchase event
 */
export async function trackPurchase(params: {
  userData: UserData;
  value: number;
  orderId: string;
  contentIds?: string[];
  contentName?: string;
  sourceUrl?: string;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId();

  await trackServerEvent({
    eventName: 'Purchase',
    eventId,
    userData: params.userData,
    eventData: {
      value: params.value,
      currency: 'GBP',
      orderId: params.orderId,
      contentIds: params.contentIds,
      contentName: params.contentName || 'Locksmith Service',
      contentType: 'product',
    },
    sourceUrl: params.sourceUrl,
  });

  return { eventId };
}

/**
 * Track InitiateCheckout event
 */
export async function trackInitiateCheckout(params: {
  userData: UserData;
  value: number;
  contentIds?: string[];
  contentName?: string;
  sourceUrl?: string;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId();

  await trackServerEvent({
    eventName: 'InitiateCheckout',
    eventId,
    userData: params.userData,
    eventData: {
      value: params.value,
      currency: 'GBP',
      contentIds: params.contentIds,
      contentName: params.contentName,
      numItems: 1,
    },
    sourceUrl: params.sourceUrl,
  });

  return { eventId };
}

/**
 * Track CompleteRegistration event
 */
export async function trackRegistration(params: {
  userData: UserData;
  contentName: string;
  sourceUrl?: string;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId();

  await trackServerEvent({
    eventName: 'CompleteRegistration',
    eventId,
    userData: params.userData,
    eventData: {
      contentName: params.contentName,
      status: 'completed',
    },
    sourceUrl: params.sourceUrl,
  });

  return { eventId };
}

// ===================
// CUSTOM EVENTS
// ===================

/**
 * Track a custom event
 */
export async function trackCustomEvent(params: {
  eventName: string;
  userData?: UserData;
  eventData?: EventData;
  sourceUrl?: string;
  eventId?: string;
}): Promise<{ eventId: string }> {
  const eventId = params.eventId || generateEventId();

  await trackServerEvent({
    eventName: params.eventName,
    eventId,
    userData: params.userData,
    eventData: params.eventData,
    sourceUrl: params.sourceUrl,
  });

  return { eventId };
}

// ===================
// UTM PARAMETER HELPERS
// ===================

export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

/**
 * Parse UTM parameters from URL
 */
export function parseUTMParams(url: string): UTMParams {
  try {
    const urlObj = new URL(url);
    return {
      source: urlObj.searchParams.get('utm_source') || undefined,
      medium: urlObj.searchParams.get('utm_medium') || undefined,
      campaign: urlObj.searchParams.get('utm_campaign') || undefined,
      content: urlObj.searchParams.get('utm_content') || undefined,
      term: urlObj.searchParams.get('utm_term') || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Build UTM query string
 */
export function buildUTMString(params: UTMParams): string {
  const parts: string[] = [];

  if (params.source) parts.push(`utm_source=${encodeURIComponent(params.source)}`);
  if (params.medium) parts.push(`utm_medium=${encodeURIComponent(params.medium)}`);
  if (params.campaign) parts.push(`utm_campaign=${encodeURIComponent(params.campaign)}`);
  if (params.content) parts.push(`utm_content=${encodeURIComponent(params.content)}`);
  if (params.term) parts.push(`utm_term=${encodeURIComponent(params.term)}`);

  return parts.join('&');
}

/**
 * Add UTM parameters to URL
 */
export function addUTMToUrl(baseUrl: string, params: UTMParams): string {
  const url = new URL(baseUrl);

  if (params.source) url.searchParams.set('utm_source', params.source);
  if (params.medium) url.searchParams.set('utm_medium', params.medium);
  if (params.campaign) url.searchParams.set('utm_campaign', params.campaign);
  if (params.content) url.searchParams.set('utm_content', params.content);
  if (params.term) url.searchParams.set('utm_term', params.term);

  return url.toString();
}

// ===================
// AD TRACKING HELPERS
// ===================

/**
 * Generate tracking URL for an ad
 * Includes UTM parameters and sets up for fbclid capture
 */
export function generateAdTrackingUrl(params: {
  destinationUrl: string;
  campaignName: string;
  adName: string;
  source?: string;
  medium?: string;
}): string {
  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  return addUTMToUrl(params.destinationUrl, {
    source: params.source || 'facebook',
    medium: params.medium || 'paid',
    campaign: slugify(params.campaignName),
    content: slugify(params.adName),
    term: Date.now().toString(36), // Unique identifier
  });
}

/**
 * Map ad objective to pixel event
 */
export function getPixelEventForObjective(
  objective: 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'SALES' | 'APP_INSTALLS'
): string {
  const map: Record<string, string> = {
    AWARENESS: 'PageView',
    TRAFFIC: 'PageView',
    ENGAGEMENT: 'ViewContent',
    LEADS: 'Lead',
    SALES: 'Purchase',
    APP_INSTALLS: 'PageView',
  };
  return map[objective] || 'PageView';
}
