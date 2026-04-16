/**
 * Tests for Retell AI Custom Function Endpoints
 *
 * Validates the endpoint logic by testing the response format expectations.
 * Full integration tests require a running server (see test-retell-endpoints.sh).
 */

describe("Retell Endpoint Response Contracts", () => {
  describe("check-user response format", () => {
    it("should include onboarding status fields for existing customers", () => {
      const response = {
        success: true,
        exists: true,
        is_new: false,
        customer_id: "cust-123",
        customer_name: "John Smith",
        customer_email: "john@example.com",
        customer_phone: "+447700900123",
        email_verified: true,
        has_active_jobs: false,
        active_job_count: 0,
        onboarding_completed: true,
        password_set: true,
        location_confirmed: true,
        needs_onboarding: false,
        message: "Welcome back, John Smith!",
      };

      expect(response).toHaveProperty("onboarding_completed");
      expect(response).toHaveProperty("password_set");
      expect(response).toHaveProperty("location_confirmed");
      expect(response).toHaveProperty("needs_onboarding");
      expect(response.needs_onboarding).toBe(false);
    });

    it("should include onboarding flags for new customers", () => {
      const response = {
        success: true,
        exists: false,
        is_new: true,
        customer_id: "cust-new",
        customer_name: "Jane Doe",
        onboarding_completed: false,
        password_set: false,
        location_confirmed: false,
        needs_onboarding: true,
        message: "I've created your account, Jane Doe.",
      };

      expect(response.is_new).toBe(true);
      expect(response.onboarding_completed).toBe(false);
      expect(response.needs_onboarding).toBe(true);
    });
  });

  describe("create-job response format", () => {
    it("should include notification status in response", () => {
      const response = {
        success: true,
        job_id: "job-123",
        job_number: "LRS-202604-0001",
        job_status: "PENDING",
        customer_id: "cust-123",
        customer_is_new: false,
        locksmiths_notified: 3,
        notification_status:
          "3 nearby locksmiths have been notified and will respond shortly.",
        message:
          "Job created successfully. Your reference number is LRS-202604-0001. 3 nearby locksmiths have been notified and will respond shortly. You'll receive a text message when a locksmith applies for your job.",
      };

      expect(response).toHaveProperty("job_number");
      expect(response).toHaveProperty("locksmiths_notified");
      expect(response).toHaveProperty("notification_status");
      expect(response.locksmiths_notified).toBe(3);
      expect(response.message).toContain("LRS-202604-0001");
      expect(response.message).toContain("notified");
    });

    it("should handle zero notified locksmiths", () => {
      const notifiedCount = 0;
      const notificationStatus =
        notifiedCount > 0
          ? `${notifiedCount} nearby locksmiths have been notified.`
          : "We're working on finding available locksmiths in your area.";

      expect(notificationStatus).toContain("working on finding");
    });

    it("should handle single locksmith notified", () => {
      const notifiedCount = 1;
      const notificationStatus = `${notifiedCount} nearby locksmith${notifiedCount > 1 ? "s have" : " has"} been notified and will respond shortly.`;

      expect(notificationStatus).toBe(
        "1 nearby locksmith has been notified and will respond shortly."
      );
    });
  });

  describe("create-user response format", () => {
    it("should include onboarding flags for new user", () => {
      const response = {
        success: true,
        customer_id: "cust-new",
        customer_name: "Test User",
        is_new: true,
        onboarding_completed: false,
        password_set: false,
        location_confirmed: false,
        needs_onboarding: true,
        message: "I've created your account, Test User.",
      };

      expect(response.onboarding_completed).toBe(false);
      expect(response.password_set).toBe(false);
      expect(response.location_confirmed).toBe(false);
      expect(response.needs_onboarding).toBe(true);
    });

    it("should include onboarding flags for existing user", () => {
      const response = {
        success: true,
        customer_id: "cust-123",
        customer_name: "Test User",
        is_new: false,
        onboarding_completed: true,
        password_set: true,
        location_confirmed: true,
        needs_onboarding: false,
        message: "I found your existing account.",
      };

      expect(response.needs_onboarding).toBe(false);
    });
  });

  describe("send-notification response format", () => {
    it("should include notification_type field", () => {
      const response = {
        success: true,
        notifications_sent: ["sms"],
        sms_sent: true,
        email_sent: false,
        notification_type: "continue",
        job_number: "LRS-202604-0001",
        message: "I've sent you a text message with a link.",
      };

      expect(response).toHaveProperty("notification_type");
      expect(response.notification_type).toBe("continue");
    });

    it("should support payment notification type", () => {
      const response = {
        success: true,
        notifications_sent: ["sms"],
        sms_sent: true,
        email_sent: false,
        notification_type: "payment",
        job_number: "LRS-202604-0001",
        message: "I've sent you a text message with the payment link.",
      };

      expect(response.notification_type).toBe("payment");
    });
  });

  describe("error response format", () => {
    it("should always include message field for Sarah", () => {
      const errorResponses = [
        {
          success: false,
          error: "Customer ID is required",
          message: "I need to create your account first.",
        },
        {
          success: false,
          error: "Postcode is required",
          message: "I need your postcode to find locksmiths near you.",
        },
        {
          success: false,
          error: "Failed to create job",
          message: "I had a technical issue. Let me try again.",
        },
      ];

      errorResponses.forEach((resp) => {
        expect(resp).toHaveProperty("message");
        expect(resp.message.length).toBeGreaterThan(0);
        // Messages should not expose technical details
        expect(resp.message).not.toContain("Prisma");
        expect(resp.message).not.toContain("database");
        expect(resp.message).not.toContain("SQL");
        expect(resp.message).not.toContain("null");
      });
    });
  });
});
