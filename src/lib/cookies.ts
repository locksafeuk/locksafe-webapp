/**
 * Cookie utilities for marketing and modal tracking
 * Uses cookies for better cross-session persistence compared to localStorage
 */

// Cookie names
export const COOKIE_KEYS = {
  FIRST_VISIT: "ls_first_visit",
  VISITOR_ID: "ls_vid",
  LAST_MODAL_TIME: "ls_last_modal",
  MODALS_SHOWN: "ls_modals_shown",
  PWA_PROMPT_SHOWN: "ls_pwa_shown",
  DEVICE_TYPE: "ls_device",
  WELCOME_SURVEY_COMPLETED: "ls_ws_done",
  WALKTHROUGH_SEEN: "ls_walkthrough_seen",
  LOCKSMITH_WALKTHROUGH_SEEN: "ls_locksmith_walkthrough_seen",
} as const;

// Default cookie expiration (365 days)
const DEFAULT_EXPIRY_DAYS = 365;

// Modal cooldown periods (in milliseconds)
export const MODAL_TIMINGS = {
  // Minimum time between any modal (60 seconds)
  GLOBAL_COOLDOWN_MS: 60 * 1000,

  // Time to wait after page load before showing first modal on mobile
  MOBILE_FIRST_MODAL_DELAY_MS: 8000,

  // Time to wait after page load before showing first modal on desktop
  DESKTOP_FIRST_MODAL_DELAY_MS: 5000,

  // Time to wait after PWA prompt before showing marketing modals
  POST_PWA_COOLDOWN_MS: 15000,

  // Welcome survey delay for first-time mobile visitors
  WELCOME_SURVEY_MOBILE_DELAY_MS: 15000,

  // Welcome survey delay for first-time desktop visitors
  WELCOME_SURVEY_DESKTOP_DELAY_MS: 8000,

  // Minimum time between phase 2 modals (price guarantee, trust builder, etc.)
  PHASE2_INTERVAL_MS: 30000,

  // Lead magnet check interval
  LEAD_MAGNET_CHECK_INTERVAL_MS: 15000,

  // Phase 2 check interval
  PHASE2_CHECK_INTERVAL_MS: 12000,
} as const;

/**
 * Set a cookie with optional expiration
 */
export function setCookie(
  name: string,
  value: string,
  expiryDays: number = DEFAULT_EXPIRY_DAYS,
): void {
  if (typeof document === "undefined") return;

  const date = new Date();
  date.setTime(date.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;

  document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
}

/**
 * Get a cookie value
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const c = cookie.trim();
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length));
    }
  }

  return null;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

/**
 * Check if user is on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
    userAgent,
  );
}

/**
 * Check if this is the user's first visit (using cookies)
 */
export function isFirstVisit(): boolean {
  const firstVisitCookie = getCookie(COOKIE_KEYS.FIRST_VISIT);

  if (!firstVisitCookie) {
    // Mark as visited
    setCookie(COOKIE_KEYS.FIRST_VISIT, new Date().toISOString());
    return true;
  }

  return false;
}

/**
 * Get or create a visitor ID (stored in cookie)
 */
export function getOrCreateVisitorIdCookie(): string {
  let visitorId = getCookie(COOKIE_KEYS.VISITOR_ID);

  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    setCookie(COOKIE_KEYS.VISITOR_ID, visitorId);
  }

  return visitorId;
}

/**
 * Record when a modal was last shown
 */
export function recordModalShown(modalType: string): void {
  const now = Date.now().toString();
  setCookie(COOKIE_KEYS.LAST_MODAL_TIME, now, 1); // 1 day expiry

  // Also track which modals have been shown
  const shown = getCookie(COOKIE_KEYS.MODALS_SHOWN) || "";
  const shownList = shown ? shown.split(",") : [];

  if (!shownList.includes(modalType)) {
    shownList.push(modalType);
    setCookie(COOKIE_KEYS.MODALS_SHOWN, shownList.join(","), 7); // 7 day expiry
  }
}

/**
 * Get time since last modal was shown (in ms)
 */
export function getTimeSinceLastModal(): number {
  const lastModalTime = getCookie(COOKIE_KEYS.LAST_MODAL_TIME);

  if (!lastModalTime) {
    return Number.POSITIVE_INFINITY; // No modal shown yet
  }

  return Date.now() - Number.parseInt(lastModalTime, 10);
}

/**
 * Check if enough time has passed since last modal
 */
export function canShowModalBasedOnCooldown(): boolean {
  const timeSinceLastModal = getTimeSinceLastModal();
  return timeSinceLastModal >= MODAL_TIMINGS.GLOBAL_COOLDOWN_MS;
}

/**
 * Get list of modals already shown this session/recent time
 */
export function getShownModals(): string[] {
  const shown = getCookie(COOKIE_KEYS.MODALS_SHOWN) || "";
  return shown ? shown.split(",") : [];
}

/**
 * Check if a specific modal has been shown
 */
export function hasModalBeenShown(modalType: string): boolean {
  return getShownModals().includes(modalType);
}

/**
 * Record that PWA prompt was shown
 */
export function recordPWAPromptShown(): void {
  setCookie(COOKIE_KEYS.PWA_PROMPT_SHOWN, Date.now().toString(), 7);
}

/**
 * Get time since PWA prompt was shown
 */
export function getTimeSincePWAPrompt(): number {
  const pwaTime = getCookie(COOKIE_KEYS.PWA_PROMPT_SHOWN);

  if (!pwaTime) {
    return Number.POSITIVE_INFINITY;
  }

  return Date.now() - Number.parseInt(pwaTime, 10);
}

/**
 * Check if we should wait for PWA prompt cooldown
 */
export function shouldWaitForPWACooldown(): boolean {
  const timeSincePWA = getTimeSincePWAPrompt();

  // If PWA was never shown or shown long ago, no need to wait
  if (timeSincePWA > MODAL_TIMINGS.POST_PWA_COOLDOWN_MS) {
    return false;
  }

  // PWA was shown recently, wait
  return true;
}

/**
 * Mark welcome survey as completed
 */
export function markWelcomeSurveyCompleted(): void {
  setCookie(COOKIE_KEYS.WELCOME_SURVEY_COMPLETED, "true", 30);
}

/**
 * Check if welcome survey was completed
 */
export function hasCompletedWelcomeSurvey(): boolean {
  return getCookie(COOKIE_KEYS.WELCOME_SURVEY_COMPLETED) === "true";
}

/**
 * Mark first-visit walkthrough as seen (skipped, dismissed, or completed).
 * Persisted for 1 year so the walkthrough never appears again on the same device.
 */
export function markWalkthroughSeen(): void {
  setCookie(COOKIE_KEYS.WALKTHROUGH_SEEN, "true", DEFAULT_EXPIRY_DAYS);
}

/**
 * Check if the first-visit walkthrough has already been shown to this visitor.
 */
export function hasSeenWalkthrough(): boolean {
  return getCookie(COOKIE_KEYS.WALKTHROUGH_SEEN) === "true";
}

/**
 * Mark the locksmith-prospect walkthrough as seen (skipped, dismissed, or completed).
 */
export function markLocksmithWalkthroughSeen(): void {
  setCookie(
    COOKIE_KEYS.LOCKSMITH_WALKTHROUGH_SEEN,
    "true",
    DEFAULT_EXPIRY_DAYS,
  );
}

/**
 * Check if the locksmith-prospect walkthrough has already been shown to this visitor.
 */
export function hasSeenLocksmithWalkthrough(): boolean {
  return getCookie(COOKIE_KEYS.LOCKSMITH_WALKTHROUGH_SEEN) === "true";
}

/**
 * Get appropriate delay for first modal based on device type
 */
export function getFirstModalDelay(): number {
  return isMobileDevice()
    ? MODAL_TIMINGS.MOBILE_FIRST_MODAL_DELAY_MS
    : MODAL_TIMINGS.DESKTOP_FIRST_MODAL_DELAY_MS;
}

/**
 * Get appropriate delay for welcome survey based on device type
 */
export function getWelcomeSurveyDelay(): number {
  return isMobileDevice()
    ? MODAL_TIMINGS.WELCOME_SURVEY_MOBILE_DELAY_MS
    : MODAL_TIMINGS.WELCOME_SURVEY_DESKTOP_DELAY_MS;
}
