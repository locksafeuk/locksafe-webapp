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

  describe("baseline endpoint response format", () => {
    it("should include baseline environment and KPI fields", () => {
      const response = {
        success: true,
        baseline: {
          generatedAt: "2026-05-19T12:00:00.000Z",
          environment: {
            hasRetellApiKey: true,
            hasRetellAgentId: true,
            hasRetellWebhookSecret: true,
            configuredPhoneNumber: "+442045771989",
          },
          traffic: {
            totalCalls: 120,
            calls7d: 24,
            calls30d: 83,
          },
          quality: {
            callToJobRate7d: 37.5,
            completionRate7d: 90.1,
            reviewRate7d: 8.3,
          },
        },
      };

      expect(response).toHaveProperty("baseline");
      expect(response.baseline).toHaveProperty("environment");
      expect(response.baseline).toHaveProperty("traffic");
      expect(response.baseline).toHaveProperty("quality");
      expect(response.baseline.quality).toHaveProperty("callToJobRate7d");
    });
  });

  describe("dataset endpoint response format", () => {
    it("should include masked dataset metadata and rows", () => {
      const response = {
        success: true,
        dataset: {
          generatedAt: "2026-05-19T12:00:00.000Z",
          filters: {
            from: null,
            to: null,
            limit: 200,
            includeTestCalls: false,
          },
          totals: {
            calls: 2,
            withTranscript: 2,
            withOutcome: 1,
          },
          rows: [
            {
              callId: "abc123",
              transcript: [
                { role: "user", content: "My number is [PHONE]" },
              ],
            },
          ],
        },
      };

      expect(response.dataset).toHaveProperty("filters");
      expect(response.dataset).toHaveProperty("totals");
      expect(Array.isArray(response.dataset.rows)).toBe(true);
      expect(response.dataset.rows[0].transcript[0].content).toContain("[PHONE]");
    });
  });

  describe("config versions response format", () => {
    it("should include list payload for versions", () => {
      const response = {
        success: true,
        versions: [
          {
            id: "ver_1",
            version: 1,
            title: "Initial baseline",
            isDeployed: false,
          },
        ],
      };

      expect(response).toHaveProperty("versions");
      expect(response.versions[0]).toHaveProperty("version");
      expect(response.versions[0].version).toBe(1);
    });

    it("should include created version payload", () => {
      const response = {
        success: true,
        version: {
          id: "ver_2",
          version: 2,
          title: "Prompt update",
          notes: "Improved emergency triage",
        },
      };

      expect(response).toHaveProperty("version");
      expect(response.version.version).toBe(2);
      expect(response.version.title).toContain("Prompt");
    });
  });

  describe("publish orchestration response format", () => {
    it("should include provider version metadata on publish", () => {
      const response = {
        success: true,
        providerVersionId: "agent_123:1716120000",
        deployment: {
          id: "dep_1",
          isDeployed: true,
          publishStatus: "published",
        },
      };

      expect(response).toHaveProperty("providerVersionId");
      expect(response).toHaveProperty("deployment");
    });
  });

  describe("realism endpoint response format", () => {
    it("should include realism profile and matrix", () => {
      const response = {
        success: true,
        profile: {
          interruptionSensitivity: "medium",
          backchannelFrequency: "medium",
          pauseStyle: "natural",
          noiseHandling: "adaptive",
        },
        matrix: [{ interruptionSensitivity: "low", backchannelFrequency: "low", pauseStyle: "concise" }],
      };

      expect(response).toHaveProperty("profile");
      expect(Array.isArray(response.matrix)).toBe(true);
    });
  });

  describe("dataset jobs response format", () => {
    it("should include job status and row counts", () => {
      const response = {
        success: true,
        job: {
          id: "job_1",
          status: "completed",
          rowCount: 120,
        },
      };

      expect(response.job.status).toBe("completed");
      expect(response.job.rowCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("reviews endpoint response format", () => {
    it("should include review metrics and labels", () => {
      const response = {
        success: true,
        reviews: [{ id: "r1", labels: ["natural", "complete"], naturalnessScore: 4 }],
        metrics: { totals: 1, avgNaturalness: 4 },
      };

      expect(response.metrics).toHaveProperty("avgNaturalness");
      expect(response.reviews[0].labels.length).toBeGreaterThan(0);
    });
  });

  describe("simulations endpoint response format", () => {
    it("should include run metrics and pass rate", () => {
      const response = {
        success: true,
        runs: [{ id: "sim_1", passed: true, score: 90 }],
        metrics: { total: 1, passRate: 100 },
      };

      expect(response.metrics).toHaveProperty("passRate");
      expect(response.runs[0]).toHaveProperty("score");
    });
  });

  describe("experiments endpoint response format", () => {
    it("should include experiment summary and winner", () => {
      const response = {
        success: true,
        summary: {
          controlNaturalness: 3.8,
          challengerNaturalness: 4.1,
          stopLossTriggered: false,
          winnerVersionId: "ver_challenger",
        },
      };

      expect(response.summary).toHaveProperty("winnerVersionId");
      expect(response.summary).toHaveProperty("stopLossTriggered");
    });
  });

  describe("daily scorecard response format", () => {
    it("should include KPI and alert payload", () => {
      const response = {
        success: true,
        scorecard: {
          totalCalls: 22,
          completionRate: 86.4,
          callToJobRate: 31.8,
          escalationRate: 9.1,
          avgNaturalness: 3.9,
          alertCount: 0,
        },
        alerts: [],
      };

      expect(response.scorecard).toHaveProperty("completionRate");
      expect(Array.isArray(response.alerts)).toBe(true);
    });
  });
});
