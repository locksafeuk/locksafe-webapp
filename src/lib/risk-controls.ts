function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface PaymentAmountBounds {
  minAmountGbp: number;
  maxAmountGbp: number;
}

export function getPaymentAmountBounds(): PaymentAmountBounds {
  return {
    minAmountGbp: parsePositiveNumber(process.env.PAYMENT_MIN_AMOUNT_GBP, 10),
    maxAmountGbp: parsePositiveNumber(process.env.PAYMENT_MAX_AMOUNT_GBP, 5000),
  };
}

export function validatePaymentAmount(amount: number): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "Invalid payment amount";
  }

  const { minAmountGbp, maxAmountGbp } = getPaymentAmountBounds();
  if (amount < minAmountGbp || amount > maxAmountGbp) {
    return `Payment amount must be between GBP ${minAmountGbp} and GBP ${maxAmountGbp}`;
  }

  return null;
}

export interface EmergencyJobRiskSnapshot {
  recentCustomerJobs24h: number;
  recentDuplicateRequests: number;
}

export interface EmergencyJobRiskConfig {
  maxJobsPer24Hours: number;
  duplicateWindowMinutes: number;
}

export function getEmergencyJobRiskConfig(): EmergencyJobRiskConfig {
  return {
    maxJobsPer24Hours: parsePositiveInt(process.env.FRAUD_CHECK_CUSTOMER_MAX_JOBS_24H, 5),
    duplicateWindowMinutes: parsePositiveInt(process.env.FRAUD_CHECK_DUPLICATE_JOBS_WINDOW_MINUTES, 10),
  };
}

export function evaluateEmergencyJobRisk(snapshot: EmergencyJobRiskSnapshot): string | null {
  const config = getEmergencyJobRiskConfig();

  if (snapshot.recentDuplicateRequests > 0) {
    return `A recent emergency request already exists for this customer and postcode within the last ${config.duplicateWindowMinutes} minutes.`;
  }

  if (snapshot.recentCustomerJobs24h >= config.maxJobsPer24Hours) {
    return `This customer has reached the limit of ${config.maxJobsPer24Hours} emergency requests in the last 24 hours.`;
  }

  return null;
}
