import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { incrementOutreachMetric } from "@/lib/lead-outreach";

const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const leadId = searchParams.get("leadId");
  const key = searchParams.get("key");
  const redirectUrl = searchParams.get("url");

  const respondPixel = () =>
    new NextResponse(TRACKING_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

  try {
    if (leadId && key && (type === "open" || type === "click")) {
      const lead = await prisma.locksmithLead.findUnique({
        where: { id: leadId },
        select: { id: true, notes: true },
      });

      if (lead) {
        const notes = incrementOutreachMetric(lead.notes, key, type);
        await prisma.locksmithLead.update({
          where: { id: lead.id },
          data: { notes },
        });
      }
    }
  } catch (error) {
    console.error("Lead outreach tracking error:", error);
  }

  if (type === "click" && redirectUrl) {
    return NextResponse.redirect(decodeURIComponent(redirectUrl));
  }

  return respondPixel();
}
