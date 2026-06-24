import { NextRequest, NextResponse } from "next/server";
import { adminAssignAuction } from "@/lib/job-auction";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, locksmithId } = await request.json();

  if (!jobId || !locksmithId) {
    return NextResponse.json({ error: "jobId and locksmithId required" }, { status: 400 });
  }

  const result = await adminAssignAuction(jobId, locksmithId);

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
