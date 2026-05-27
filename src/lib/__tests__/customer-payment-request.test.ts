/**
 * @jest-environment node
 */

import { sendCustomerCalloutPaymentRequest } from "@/lib/customer-payment-request";

const mockSendSMS = jest.fn();
const mockSendCustomerPaymentLinkEmail = jest.fn();
const mockCreateNotification = jest.fn();

jest.mock("@/lib/sms", () => ({
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
}));

jest.mock("@/lib/email", () => ({
  sendCustomerPaymentLinkEmail: (...args: unknown[]) =>
    mockSendCustomerPaymentLinkEmail(...args),
}));

jest.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

describe("sendCustomerCalloutPaymentRequest", () => {
  beforeEach(() => {
    mockSendSMS.mockReset().mockResolvedValue({ success: true });
    mockSendCustomerPaymentLinkEmail.mockReset().mockResolvedValue({ success: true });
    mockCreateNotification.mockReset().mockResolvedValue({ id: "notif_1" });
  });

  it("sends payment request across SMS/email/notification after acceptance", async () => {
    const result = await sendCustomerCalloutPaymentRequest({
      jobId: "job_1",
      jobNumber: "LRS-202605-1001",
      applicationId: "app_1",
      customerId: "cust_1",
      customerName: "Jane",
      customerPhone: "+447700900111",
      customerEmail: "jane@example.com",
      locksmithName: "Lock Pro",
      locksmithCompany: "Lock Pro Ltd",
      assessmentFee: 49,
      etaMinutes: 25,
      problemType: "lockout",
      address: "123 High Street",
      postcode: "SW1A 1AA",
    });

    expect(result.paymentUrl).toContain("/customer/job/job_1?");
    expect(result.paymentUrl).toContain("applicationId=app_1");
    expect(result.paymentUrl).toContain("pay=1");
    expect(result.smsQueued).toBe(true);
    expect(result.emailQueued).toBe(true);
    expect(result.notificationQueued).toBe(true);

    expect(mockSendSMS).toHaveBeenCalledTimes(1);
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    expect(smsBody).toContain("Call-out fee: £49.00");
    expect(smsBody).toContain(result.paymentUrl);

    expect(mockSendCustomerPaymentLinkEmail).toHaveBeenCalledTimes(1);
    expect(mockSendCustomerPaymentLinkEmail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.objectContaining({
        assessmentFee: 49,
        paymentUrl: result.paymentUrl,
        locksmithName: "Lock Pro",
      }),
    );

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cust_1",
        jobId: "job_1",
        type: "locksmith_accepted",
      }),
    );
  });

  it("still creates in-app notification when SMS/email channels are unavailable", async () => {
    const result = await sendCustomerCalloutPaymentRequest({
      jobId: "job_2",
      jobNumber: "LRS-202605-1002",
      applicationId: "app_2",
      customerId: "cust_2",
      customerName: "John",
      customerPhone: null,
      customerEmail: null,
      locksmithName: "Secure Locks",
      assessmentFee: 39,
      etaMinutes: 15,
    });

    expect(result.smsQueued).toBe(false);
    expect(result.emailQueued).toBe(false);
    expect(result.notificationQueued).toBe(true);

    expect(mockSendSMS).not.toHaveBeenCalled();
    expect(mockSendCustomerPaymentLinkEmail).not.toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });
});
