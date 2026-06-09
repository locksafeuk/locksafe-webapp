type TwilioApiPayload = {
  To: string;
  Body: string;
  From?: string;
  MessagingServiceSid?: string;
};

type TwilioSdkPayload = {
  to: string;
  body: string;
  from?: string;
  messagingServiceSid?: string;
};

function getSmsPhoneNumber() {
  return process.env.TWILIO_SMS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
}

function getAlphaSenderId() {
  const raw = (process.env.TWILIO_ALPHANUMERIC_SENDER_ID || "").trim();
  if (!raw) return "";

  // Twilio alphanumeric sender IDs: up to 11 chars, letters/digits/spaces
  // (at least one letter). e.g. "LockSafe UK".
  const cleaned = raw
    .replace(/[^a-z0-9 ]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 11)
    .trim();
  if (!/[a-z]/i.test(cleaned)) return "";
  return cleaned;
}

function getMessageRouting() {
  const messagingServiceSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  const alphaSenderId = getAlphaSenderId();
  const phoneNumber = getSmsPhoneNumber();

  return {
    messagingServiceSid,
    alphaSenderId,
    phoneNumber,
  };
}

export function hasTwilioSenderConfigured() {
  const { messagingServiceSid, alphaSenderId, phoneNumber } = getMessageRouting();
  return Boolean(messagingServiceSid || alphaSenderId || phoneNumber);
}

/**
 * Channel decides the sender:
 *  - "transactional" → a REPLYABLE sender (Messaging Service or numeric VMN),
 *    never the alphanumeric ID, so customers can text back ("paid", "running
 *    late") and we receive it.
 *  - "marketing"     → prefers the branded alphanumeric "LockSafe UK" Sender ID
 *    (one-way) for outreach blasts where replies aren't expected.
 */
export type SmsChannel = "transactional" | "marketing";

/** Is a two-way (replyable) Twilio sender available? */
export function hasTwilioTwoWaySender() {
  const { messagingServiceSid, phoneNumber } = getMessageRouting();
  return Boolean(messagingServiceSid || phoneNumber);
}

export function buildTwilioApiPayload(
  to: string,
  body: string,
  channel: SmsChannel = "marketing",
): TwilioApiPayload {
  const { messagingServiceSid, alphaSenderId, phoneNumber } = getMessageRouting();

  if (channel === "transactional") {
    // Replyable senders only — skip the alphanumeric ID.
    if (messagingServiceSid) return { To: to, Body: body, MessagingServiceSid: messagingServiceSid };
    if (phoneNumber) return { To: to, Body: body, From: phoneNumber };
    // No two-way sender configured — fall through to whatever exists so the
    // message still goes out (replies just won't work until a VMN is added).
  }

  if (messagingServiceSid) return { To: to, Body: body, MessagingServiceSid: messagingServiceSid };
  if (alphaSenderId) return { To: to, Body: body, From: alphaSenderId };
  return { To: to, Body: body, From: phoneNumber };
}

export function buildTwilioSdkPayload(
  to: string,
  body: string,
  channel: SmsChannel = "marketing",
): TwilioSdkPayload {
  const { messagingServiceSid, alphaSenderId, phoneNumber } = getMessageRouting();

  if (channel === "transactional") {
    if (messagingServiceSid) return { to, body, messagingServiceSid };
    if (phoneNumber) return { to, body, from: phoneNumber };
  }

  if (messagingServiceSid) return { to, body, messagingServiceSid };
  if (alphaSenderId) return { to, body, from: alphaSenderId };
  return { to, body, from: phoneNumber };
}
