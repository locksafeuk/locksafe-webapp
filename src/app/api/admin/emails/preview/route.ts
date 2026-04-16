import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generatePreviewEmail, type EmailTemplate } from "@/lib/campaign-email";

// POST: Generate email preview HTML
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      subject,
      preheader,
      template,
      headline,
      body: emailBody,
      ctaText,
      ctaUrl,
      accentColor,
    } = body;

    if (!subject || !template || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: subject, template, body" },
        { status: 400 }
      );
    }

    const html = generatePreviewEmail({
      subject,
      preheader,
      template: template as EmailTemplate,
      headline,
      body: emailBody,
      ctaText,
      ctaUrl,
      accentColor,
    });

    return NextResponse.json({
      success: true,
      html,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
