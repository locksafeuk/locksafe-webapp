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

export function buildTwilioApiPayload(to: string, body: string): TwilioApiPayload {
  const { messagingServiceSid, alphaSenderId, phoneNumber } = getMessageRouting();

  if (messagingServiceSid) {
    return {
      To: to,
      Body: body,
      MessagingServiceSid: messagingServiceSid,
    };
  }

  if (alphaSenderId) {
    return {
      To: to,
      Body: body,
      From: alphaSenderId,
    };
  }

  return {
    To: to,
    Body: body,
    From: phoneNumber,
  };
}

export function buildTwilioSdkPayload(to: string, body: string): TwilioSdkPayload {
  const { messagingServiceSid, alphaSenderId, phoneNumber } = getMessageRouting();

  if (messagingServiceSid) {
    return {
      to,
      body,
      messagingServiceSid,
    };
  }

  if (alphaSenderId) {
    return {
      to,
      body,
      from: alphaSenderId,
    };
  }

  return {
    to,
    body,
    from: phoneNumber,
  };
}
