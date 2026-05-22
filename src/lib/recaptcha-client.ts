"use client";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SRC = "https://www.google.com/recaptcha/api.js?render=";

let scriptLoadPromise: Promise<void> | null = null;

function getSiteKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY || "";
}

async function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (window.grecaptcha) {
    return;
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${RECAPTCHA_SRC}${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export async function executeRecaptcha(action: string): Promise<string | null> {
  const siteKey = getSiteKey();
  if (!siteKey || typeof window === "undefined") {
    return null;
  }

  try {
    await loadRecaptchaScript(siteKey);
    if (!window.grecaptcha) {
      return null;
    }

    const token = await new Promise<string>((resolve, reject) => {
      window.grecaptcha?.ready(() => {
        window.grecaptcha
          ?.execute(siteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    });

    return token || null;
  } catch (error) {
    console.warn("[reCAPTCHA] Failed to execute", error);
    return null;
  }
}
