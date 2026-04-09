export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

const TEST_SCENARIOS: Record<string, any> = {
  emergency: {
    callerPhone: "+447700900001",
    callerName: "James Wilson",
    callerPostcode: "SW1A 1AA",
    callCategory: "emergency",
    urgencyLevel: "critical",
    problemType: "lockout",
    propertyType: "residential",
    outcome: "job_created",
    sentimentScore: 0.3,
    sentimentLabel: "neutral",
    durationSeconds: 185,
    summary: "Customer locked out of flat in SW1A 1AA. Keys left inside. Emergency locksmith dispatched with 20-minute ETA.",
    estimatedRevenue: 150,
    transcript: [
      { role: "agent", content: "Hello, thank you for calling LockSafe UK. How can I help you today?" },
      { role: "user", content: "Hi, I'm locked out of my flat. I left my keys inside." },
      { role: "agent", content: "I'll help you right away. Can I get your name please?" },
      { role: "user", content: "My name is James Wilson." },
      { role: "agent", content: "What's the postcode and address?" },
      { role: "user", content: "SW1A 1AA, 10 Downing Street." },
      { role: "agent", content: "I've found a verified locksmith nearby. Assessment fee is 29 GBP with about 20 minutes ETA. Shall I dispatch them?" },
      { role: "user", content: "Yes please." },
      { role: "agent", content: "Done! You'll receive an SMS with their details shortly. Thank you for choosing LockSafe UK." },
    ],
  },
  appointment: {
    callerPhone: "+447700900002",
    callerName: "Sarah Connor",
    callerPostcode: "M1 1AA",
    callCategory: "appointment",
    urgencyLevel: "low",
    problemType: "security_upgrade",
    propertyType: "residential",
    outcome: "appointment_booked",
    sentimentScore: 0.8,
    sentimentLabel: "positive",
    durationSeconds: 120,
    summary: "Customer booked appointment for anti-snap lock upgrades on front and back doors. Scheduled for next Tuesday at 10am.",
    estimatedRevenue: 120,
    transcript: [
      { role: "agent", content: "Hello, LockSafe UK. How can I help?" },
      { role: "user", content: "I'd like to book someone to upgrade my locks to anti-snap ones." },
      { role: "agent", content: "Great choice! Can I get your name and postcode?" },
      { role: "user", content: "Sarah Connor, M1 1AA." },
      { role: "agent", content: "Anti-snap upgrades start from 45 GBP per lock. Would next Tuesday at 10am work?" },
      { role: "user", content: "Perfect, yes please." },
      { role: "agent", content: "Booked! You'll receive a confirmation SMS. Thank you!" },
    ],
  },
  inquiry: {
    callerPhone: "+447700900003",
    callerName: "Test Inquiry",
    callCategory: "inquiry",
    urgencyLevel: "low",
    outcome: "info_provided",
    sentimentScore: 0.5,
    sentimentLabel: "positive",
    durationSeconds: 90,
    summary: "Customer asked about pricing and service coverage. Provided information.",
    estimatedRevenue: 40,
    transcript: [
      { role: "agent", content: "Hello, LockSafe UK. How can I help?" },
      { role: "user", content: "I wanted to ask about your pricing." },
      { role: "agent", content: "Our assessment fee is 25-49 GBP. Emergency lockouts typically 80-150 GBP. All prices include VAT with no hidden fees." },
      { role: "user", content: "Thanks for the info." },
    ],
  },
  negative: {
    callerPhone: "+447700900004",
    callerName: "Frustrated Customer",
    callerPostcode: "B1 1AA",
    callCategory: "complaint",
    urgencyLevel: "high",
    outcome: "escalated",
    sentimentScore: -0.8,
    sentimentLabel: "negative",
    durationSeconds: 210,
    summary: "Customer complained about a previous job where the locksmith was late. Escalated to human support.",
    estimatedRevenue: 0,
    wasEscalated: true,
    escalationReason: "Customer complaint about previous service",
    flaggedForReview: true,
    transcript: [
      { role: "agent", content: "Hello, LockSafe UK. How can I help?" },
      { role: "user", content: "I'm really unhappy. The locksmith was over an hour late." },
      { role: "agent", content: "I'm very sorry. Let me connect you with our support team to resolve this." },
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const scenario = body?.scenario ?? "emergency";
    const testData = TEST_SCENARIOS[scenario] ?? TEST_SCENARIOS.emergency;
    const testCallId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const call = await prisma.voiceCall.create({
      data: {
        retellCallId: testCallId,
        agentId: "test_agent",
        callerPhone: testData.callerPhone,
        callerName: testData.callerName,
        callerPostcode: testData.callerPostcode ?? null,
        callType: "inbound",
        callStatus: "completed",
        startedAt: new Date(Date.now() - (testData.durationSeconds ?? 120) * 1000),
        endedAt: new Date(),
        durationSeconds: testData.durationSeconds,
        callCategory: testData.callCategory,
        urgencyLevel: testData.urgencyLevel,
        problemType: testData.problemType ?? null,
        propertyType: testData.propertyType ?? null,
        outcome: testData.outcome,
        sentimentScore: testData.sentimentScore,
        sentimentLabel: testData.sentimentLabel,
        summary: testData.summary,
        transcript: testData.transcript,
        estimatedRevenue: testData.estimatedRevenue,
        wasEscalated: testData.wasEscalated ?? false,
        escalationReason: testData.escalationReason ?? null,
        flaggedForReview: testData.flaggedForReview ?? false,
        isTestCall: true,
        dedupeKey: `test_${testCallId}`,
      },
    });

    return NextResponse.json({ success: true, call, message: `Test ${scenario} call created` });
  } catch (error: any) {
    console.error("[API] Error creating test call:", error);
    return NextResponse.json({ error: "Failed to create test call" }, { status: 500 });
  }
}
