import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// 1x1 transparent GIF for tracking pixel
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// GET: Track email opens and clicks
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "open" or "click"
  const recipientId = searchParams.get("rid");
  const redirectUrl = searchParams.get("url");

  if (!recipientId) {
    // For clicks without recipient ID, just redirect
    if (type === "click" && redirectUrl) {
      return NextResponse.redirect(decodeURIComponent(redirectUrl));
    }
    // For opens, return pixel anyway
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }

  try {
    // Track the event
    if (type === "open") {
      const recipient = await prisma.emailRecipient.findUnique({
        where: { id: recipientId },
      });

      if (recipient) {
        await prisma.emailRecipient.update({
          where: { id: recipientId },
          data: {
            openedAt: recipient.openedAt || new Date(), // Only set first open time
            openCount: { increment: 1 },
            status: "delivered", // Mark as delivered if opened
          },
        });

        // Update campaign stats
        if (!recipient.openedAt) {
          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: {
              totalOpened: { increment: 1 },
            },
          });
        }
      }

      // Return tracking pixel
      return new NextResponse(TRACKING_PIXEL, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    if (type === "click" && redirectUrl) {
      const recipient = await prisma.emailRecipient.findUnique({
        where: { id: recipientId },
      });

      if (recipient) {
        const decodedUrl = decodeURIComponent(redirectUrl);

        await prisma.emailRecipient.update({
          where: { id: recipientId },
          data: {
            clickedAt: recipient.clickedAt || new Date(), // Only set first click time
            clickCount: { increment: 1 },
            clickedLinks: recipient.clickedLinks.includes(decodedUrl)
              ? recipient.clickedLinks
              : [...recipient.clickedLinks, decodedUrl],
            status: "delivered",
          },
        });

        // Update campaign stats
        if (!recipient.clickedAt) {
          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: {
              totalClicked: { increment: 1 },
            },
          });
        }
      }

      // Redirect to the actual URL
      return NextResponse.redirect(decodeURIComponent(redirectUrl));
    }
  } catch (error) {
    console.error("Tracking error:", error);
  }

  // Default: return pixel for opens, or redirect for clicks
  if (type === "click" && redirectUrl) {
    return NextResponse.redirect(decodeURIComponent(redirectUrl));
  }

  return new NextResponse(TRACKING_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
