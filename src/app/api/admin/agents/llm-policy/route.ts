import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdminFromCookies, unauthorizedAgentApiResponse } from "@/lib/agent-api-auth";
import { invalidateOperationalPolicyCache } from "@/agents/core/operational-policy";

const ALLOWED_SEVERITIES = new Set(["low", "medium", "high", "critical"] as const);
const ALLOWED_SENSITIVITIES = new Set(["all", "workflow", "critical"] as const);

function toPublicPolicy(row: {
  openAiFallbackEnabled: boolean | null;
  openAiFallbackMinSeverity: string | null;
  guardianModeEnabled: boolean | null;
  alertSensitivity: string | null;
  nonWorkflowHeartbeatMultiplier: number | null;
  updatedAt: Date;
  updatedBy: string | null;
}) {
  return {
    openAiFallbackEnabled: Boolean(row.openAiFallbackEnabled),
    openAiFallbackMinSeverity: row.openAiFallbackMinSeverity || "high",
    guardianModeEnabled: Boolean(row.guardianModeEnabled),
    alertSensitivity: row.alertSensitivity || "workflow",
    nonWorkflowHeartbeatMultiplier: Math.max(1, row.nonWorkflowHeartbeatMultiplier ?? 1),
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
      guardianModeEnabled: true,
      alertSensitivity: true,
      nonWorkflowHeartbeatMultiplier: true,
      updatedAt: true,
      updatedBy: true,
    },
  });

  if (!globalPolicy) {
    return NextResponse.json({
      policy: {
        openAiFallbackEnabled: false,
        openAiFallbackMinSeverity: "high",
        guardianModeEnabled: false,
        alertSensitivity: "workflow",
        nonWorkflowHeartbeatMultiplier: 1,
      },
    });
  }

  return NextResponse.json({ policy: toPublicPolicy(globalPolicy) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromCookies();
  if (!admin) return unauthorizedAgentApiResponse();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Build a patch — only fields present in the body are updated. Allows
  // independent toggles (LLM fallback vs guardian-mode vs sensitivity) without
  // requiring callers to re-send every field.
  const patch: Record<string, unknown> = {};

  if (body.openAiFallbackEnabled !== undefined) {
    if (typeof body.openAiFallbackEnabled !== "boolean") {
      return NextResponse.json(
        { error: "openAiFallbackEnabled must be a boolean" },
        { status: 400 },
      );
    }
    patch.openAiFallbackEnabled = body.openAiFallbackEnabled;
  }

  if (body.openAiFallbackMinSeverity !== undefined) {
    const severity = String(body.openAiFallbackMinSeverity).toLowerCase();
    if (!ALLOWED_SEVERITIES.has(severity as "low" | "medium" | "high" | "critical")) {
      return NextResponse.json(
        { error: "openAiFallbackMinSeverity must be one of low, medium, high, critical" },
        { status: 400 },
      );
    }
    patch.openAiFallbackMinSeverity = severity;
  }

  if (body.guardianModeEnabled !== undefined) {
    if (typeof body.guardianModeEnabled !== "boolean") {
      return NextResponse.json(
        { error: "guardianModeEnabled must be a boolean" },
        { status: 400 },
      );
    }
    patch.guardianModeEnabled = body.guardianModeEnabled;
  }

  if (body.alertSensitivity !== undefined) {
    const sensitivity = String(body.alertSensitivity).toLowerCase();
    if (!ALLOWED_SENSITIVITIES.has(sensitivity as "all" | "workflow" | "critical")) {
      return NextResponse.json(
        { error: "alertSensitivity must be one of all, workflow, critical" },
        { status: 400 },
      );
    }
    patch.alertSensitivity = sensitivity;
  }

  if (body.nonWorkflowHeartbeatMultiplier !== undefined) {
    const n = Number(body.nonWorkflowHeartbeatMultiplier);
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      return NextResponse.json(
        { error: "nonWorkflowHeartbeatMultiplier must be an integer between 1 and 24" },
        { status: 400 },
      );
    }
    patch.nonWorkflowHeartbeatMultiplier = Math.floor(n);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided" },
      { status: 400 },
    );
  }

  const row = await prisma.marketingPolicy.upsert({
    where: { platform: "global" },
    create: {
      platform: "global",
      updatedBy: admin.id,
      notes: "Auto-created while saving operational policy",
      openAiFallbackEnabled: (patch.openAiFallbackEnabled as boolean | undefined) ?? false,
      openAiFallbackMinSeverity: (patch.openAiFallbackMinSeverity as string | undefined) ?? "high",
      guardianModeEnabled: (patch.guardianModeEnabled as boolean | undefined) ?? false,
      alertSensitivity: (patch.alertSensitivity as string | undefined) ?? "workflow",
      nonWorkflowHeartbeatMultiplier:
        (patch.nonWorkflowHeartbeatMultiplier as number | undefined) ?? 1,
    },
    update: {
      ...patch,
      updatedBy: admin.id,
    },
    select: {
      openAiFallbackEnabled: true,
      openAiFallbackMinSeverity: true,
      guardianModeEnabled: true,
      alertSensitivity: true,
      nonWorkflowHeartbeatMultiplier: true,
      updatedAt: true,
      updatedBy: true,
    },
  });

  invalidateOperationalPolicyCache();

  return NextResponse.json({ ok: true, policy: toPublicPolicy(row) });
}
