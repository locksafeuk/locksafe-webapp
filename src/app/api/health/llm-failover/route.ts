import { NextResponse } from "next/server";
import { runLLMFailoverHealthCheck } from "@/lib/llm-failover-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runLLMFailoverHealthCheck();
    const statusCode = result.status === "healthy" ? 200 : result.status === "degraded" ? 200 : 503;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
