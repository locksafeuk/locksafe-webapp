/**
 * API Route: /api/admin/organic/generate
 *
 * AI-powered organic content generation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  generateOrganicPost,
  generateHooks,
  generateContentCalendar,
  CONTENT_PILLARS,
  type ContentPillarKey,
} from "@/lib/organic-content";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

// POST - Generate organic content
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      action, // 'generate', 'hooks', 'calendar', 'batch'
      pillar,
      topic,
      framework,
      emotionalAngle,
      postType,
      platforms,
      includeCallToAction,
      maxLength,
      count,
      hookType,
      days,
      saveAsDrafts,
    } = body;

    switch (action) {
      case "generate": {
        // Generate single/multiple posts
        const posts = await generateOrganicPost({
          pillar: pillar as ContentPillarKey,
          topic,
          framework,
          emotionalAngle,
          postType,
          platforms,
          includeCallToAction,
          maxLength,
        });

        // Optionally save as drafts
        if (saveAsDrafts && posts.length > 0) {
          // Find pillar in DB
          let pillarDoc = await prisma.contentPillar.findFirst({
            where: { name: pillar },
          });

          // Create pillar if doesn't exist
          if (!pillarDoc) {
            const pillarData = CONTENT_PILLARS[pillar as ContentPillarKey];
            if (pillarData) {
              pillarDoc = await prisma.contentPillar.create({
                data: {
                  name: pillarData.name,
                  displayName: pillarData.displayName,
                  description: pillarData.description,
                  color: pillarData.color,
                  icon: pillarData.icon,
                  toneGuidelines: [...pillarData.toneGuidelines],
                  topicExamples: [...pillarData.topicExamples],
                  hashtags: [...pillarData.hashtags],
                  postsPerWeek: pillarData.postsPerWeek,
                },
              });
            }
          }

          // Save posts as drafts
          const savedPosts = await Promise.all(
            posts.map(post =>
              prisma.socialPost.create({
                data: {
                  content: post.content,
                  headline: post.headline,
                  hook: post.hook,
                  hookType: post.hookType,
                  pillarId: pillarDoc?.id,
                  hashtags: post.hashtags,
                  platforms: platforms?.map((p: string) => p.toUpperCase()) || ["FACEBOOK", "INSTAGRAM"],
                  aiGenerated: true,
                  aiPrompt: topic || `Generated for ${pillar} pillar`,
                  aiFramework: post.framework,
                  emotionalAngle: post.emotionalAngle,
                  status: "DRAFT",
                },
              })
            )
          );

          return NextResponse.json({
            success: true,
            posts,
            savedPosts,
            message: `${savedPosts.length} posts saved as drafts`,
          });
        }

        return NextResponse.json({
          success: true,
          posts,
        });
      }

      case "hooks": {
        // Generate hooks only
        const hooks = await generateHooks(count || 5, hookType);

        return NextResponse.json({
          success: true,
          hooks,
        });
      }

      case "calendar": {
        // Generate content calendar
        const calendar = generateContentCalendar(
          new Date(),
          days || 7
        );

        return NextResponse.json({
          success: true,
          calendar,
        });
      }

      case "batch": {
        // Generate batch content for multiple pillars
        const allPillars = Object.keys(CONTENT_PILLARS) as ContentPillarKey[];
        const batchResults: Record<string, unknown[]> = {};

        for (const p of allPillars) {
          try {
            const posts = await generateOrganicPost({
              pillar: p,
              framework: "mixed",
              includeCallToAction: true,
            });
            batchResults[p] = posts;
          } catch (error) {
            console.error(`Error generating for ${p}:`, error);
            batchResults[p] = [];
          }
        }

        return NextResponse.json({
          success: true,
          batch: batchResults,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate content" },
      { status: 500 }
    );
  }
}

// GET - Get available pillars and frameworks
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    pillars: CONTENT_PILLARS,
    frameworks: [
      { id: "justin-welsh", name: "Justin Welsh", description: "Pattern interrupts & hooks" },
      { id: "russell-brunson", name: "Russell Brunson", description: "Storytelling & engagement" },
      { id: "nicholas-cole", name: "Nicholas Cole", description: "Specificity & category design" },
      { id: "simon-sinek", name: "Simon Sinek", description: "Purpose-driven messaging" },
      { id: "mixed", name: "Mixed", description: "Combination of all frameworks" },
    ],
    emotionalAngles: [
      { id: "trust", name: "Trust", description: "Building credibility" },
      { id: "urgency", name: "Urgency", description: "Time-sensitive messaging" },
      { id: "control", name: "Control", description: "Empowering the customer" },
      { id: "benefit", name: "Benefit", description: "Highlighting value" },
      { id: "fear", name: "Fear", description: "Risk awareness" },
      { id: "curiosity", name: "Curiosity", description: "Sparking interest" },
    ],
    hookTypes: [
      { id: "pattern-interrupt", name: "Pattern Interrupt" },
      { id: "curiosity-gap", name: "Curiosity Gap" },
      { id: "story", name: "Story Hook" },
      { id: "question", name: "Question" },
    ],
  });
}
