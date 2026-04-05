/**
 * Natural Language Processing API Endpoint
 *
 * Handles conversational queries from admin, locksmith, and customer interfaces
 *
 * POST /api/agent/nlp - Process natural language query
 */

import { NextRequest, NextResponse } from "next/server";
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";
import { verifyApiKey } from "@/lib/agent-auth";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication for admin/agent requests
    const authHeader = request.headers.get("Authorization");
    const isAgentAuth = authHeader?.startsWith("Bearer ");

    // Parse request body
    const body = await request.json();
    const { query, role = "customer", userId, jobId } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["admin", "locksmith", "customer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Admin role requires authentication
    if (role === "admin" && isAgentAuth) {
      const auth = verifyApiKey(request);
      if (!auth.authenticated) {
        return NextResponse.json(
          { error: auth.error },
          { status: 401 }
        );
      }
    }

    // Process the natural language query
    const result = await processNaturalLanguageQuery(
      query,
      role as "admin" | "locksmith" | "customer",
      userId,
      jobId
    );

    return NextResponse.json({
      success: true,
      response: result.response,
      intent: result.intent,
      entities: result.entities,
      actions: result.actions,
    });
  } catch (error) {
    console.error("[NLP API] Error:", error);
    return NextResponse.json(
      { error: "Failed to process query" },
      { status: 500 }
    );
  }
}

/**
 * GET - Health check and capabilities
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    capabilities: [
      "Natural language intent extraction",
      "Conversational response generation",
      "Tool execution for platform actions",
      "Multi-role support (admin, locksmith, customer)",
    ],
    intents: {
      admin: [
        "list_jobs", "find_locksmith", "dispatch_job", "get_stats", "get_alerts"
      ],
      locksmith: [
        "view_active_jobs", "accept_job", "decline_job", "go_online", "go_offline"
      ],
      customer: [
        "track_job", "get_eta", "contact_locksmith", "request_callback", "report_issue"
      ],
    },
  });
}
