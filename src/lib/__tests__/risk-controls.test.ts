import {
  evaluateEmergencyJobRisk,
  validatePaymentAmount,
} from "../risk-controls";

describe("risk controls", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PAYMENT_MIN_AMOUNT_GBP: "10",
      PAYMENT_MAX_AMOUNT_GBP: "5000",
      FRAUD_CHECK_CUSTOMER_MAX_JOBS_24H: "5",
      FRAUD_CHECK_DUPLICATE_JOBS_WINDOW_MINUTES: "10",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects payment amounts below the configured minimum", () => {
    expect(validatePaymentAmount(5)).toMatch(/between GBP 10 and GBP 5000/);
  });

  it("accepts payment amounts within bounds", () => {
    expect(validatePaymentAmount(29)).toBeNull();
  });

  it("blocks duplicate emergency requests inside the duplicate window", () => {
    expect(
      evaluateEmergencyJobRisk({
        recentCustomerJobs24h: 1,
        recentDuplicateRequests: 1,
      })
    ).toMatch(/recent emergency request already exists/i);
  });

  it("blocks customers who exceed the 24-hour emergency request limit", () => {
    expect(
      evaluateEmergencyJobRisk({
        recentCustomerJobs24h: 5,
        recentDuplicateRequests: 0,
      })
    ).toMatch(/reached the limit of 5 emergency requests/i);
  });

  it("allows low-risk emergency requests", () => {
    expect(
      evaluateEmergencyJobRisk({
        recentCustomerJobs24h: 1,
        recentDuplicateRequests: 0,
      })
    ).toBeNull();
  });
});