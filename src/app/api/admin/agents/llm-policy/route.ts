import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdminFromCookies, unauthorizedAgentApiResponse } from "@/lib/agent-api-auth";

const ALLOWED_SEVERITIES = new Set(["low", "medium", "high", "critical"] as const);

function toPublicPolicy(row: {
  openAiFallbackEnabled: boolean | null;
  openAiFallbackMinSeverity: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}) {
  return {
    openAiFallbackEnabled: Boolean(row.openAiFallbackEnabled),
    openAiFallbackMinSeverity: row.openAiFallbackMinSeverity || "high",
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export async function GET() {
  const admin = await requireAdminFromCookies();
  if (!admin) return unauthorizedAgentApiResponse();

  const globalPolicy = await prisma.marketingPolicy.findUnique({
    where: { platform: "global" },
    select: {
      openAiFallbackEnabled: true,
      openAiFallbackMinSeverity: true,
      updatedAt: true,
      updatedBy: true,
    },
  });

  if (!globalPolicy) {
    return NextResponse.json({
      policy: {
        openAiFallbackEnabled: false,
        openAiFallbackMinSeverity: "high",
      },
    });
  }

  return NextResponse.json({ policy: toPublicPolicy(globalPolicy) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromCookies();
  if (!admin) return unauthorizedAgentApiResponse();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.openAiFallbackEnabled !== "boolean") {
    return NextResponse.json(
      { error: "openAiFallbackEnabled must be a boolean" },
      { status: 400 },
    );
  }

  const severity = String(body.openAiFallbackMinSeverity ?? "high").toLowerCase();
  if (!ALLOWED_SEVERITIES.has(severity as "low" | "medium" | "high" | "critical")) {
    return NextResponse.json(
      { error: "openAiFallbackMinSeverity must be one of low, medium, high, critical" },
      { status: 400 },
    );
  }

  const row = await prisma.marketingPolicy.upsert({
    where: { platform: "global" },
    create: {
      platform: "global",
      updatedBy: admin.id,
      notes: "Auto-created while saving LLM fallback policy",
      openAiFallbackEnabled: body.openAiFallbackEnabled,
      openAiFallbackMinSeverity: severity,
    },
    update: {
      updatedBy: admin.id,
      openAiFallbackEnabled: body.openAiFallbackEnabled,
      openAiFallbackMinSeverity: severity,
    },
    select: {
      openAiFallbackEnabled: true,
      openAiFallbackMinSeverity: true,
      updatedAt: true,
      updatedBy: true,
    },
  });

  return NextResponse.json({ ok: true, policy: toPublicPolicy(row) });
}
