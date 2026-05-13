import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";

async function requireAdmin(request: NextRequest) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token");
  if (!authToken) return null;
  const { verifyToken } = await import("@/lib/auth");
  const payload = await verifyToken(authToken.value);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

// Recommended Radar value lists for LockSafe
const RECOMMENDED_LISTS = [
  {
    alias: "locksafe_blocked_cards",
    name: "LockSafe — Blocked Cards",
    item_type: "card_fingerprint" as const,
    description: "Card fingerprints to permanently block (fraud / chargebacks)",
  },
  {
    alias: "locksafe_blocked_emails",
    name: "LockSafe — Blocked Emails",
    item_type: "email" as const,
    description: "Customer emails to block from placing orders",
  },
  {
    alias: "locksafe_trusted_customers",
    name: "LockSafe — Trusted Customers",
    item_type: "customer_id" as const,
    description: "Verified repeat customers — bypass review rules",
  },
] as const;

// GET /api/admin/security/radar — list value lists + items + recommended rules
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stripe = getStripe();

    // Fetch all radar value lists
    const allLists = await stripe.radar.valueLists.list({ limit: 100 });

    // Fetch items for each of our managed lists
    const managedLists = await Promise.all(
      RECOMMENDED_LISTS.map(async (def) => {
        const existing = allLists.data.find((l) => l.alias === def.alias);
        if (!existing) {
          return { ...def, exists: false, id: null, items: [], itemCount: 0 };
        }
        const items = await stripe.radar.valueListItems.list({
          value_list: existing.id,
          limit: 100,
        });
        return {
          ...def,
          exists: true,
          id: existing.id,
          items: items.data.map((i) => ({ id: i.id, value: i.value, created: i.created })),
          itemCount: items.data.length,
        };
      })
    );

    // Recommended Radar rules (Dashboard-only — provide as setup guide)
    const recommendedRules = [
      {
        id: "rule_block_non_gb",
        action: "block",
        predicate: ":card_country: != 'GB'",
        label: "Block non-GB cards",
        description: "Block all cards not issued in the UK. Prevents international fraud.",
        dashboardOnly: true,
        priority: "high",
      },
      {
        id: "rule_review_high_value_new",
        action: "review",
        predicate: ":amount_in_gbp: > 500 and :customer_transaction_count: == 0",
        label: "Review high-value first-time customers",
        description: "Send to manual review: amount > £500 from a customer with no prior transactions.",
        dashboardOnly: true,
        priority: "high",
      },
      {
        id: "rule_block_blocked_cards",
        action: "block",
        predicate: ":card_fingerprint: in locksafe_blocked_cards",
        label: "Block cards on our blocklist",
        description: "Block any card whose fingerprint is in your LockSafe blocked cards list.",
        dashboardOnly: true,
        priority: "high",
      },
      {
        id: "rule_block_blocked_emails",
        action: "block",
        predicate: ":email: in locksafe_blocked_emails",
        label: "Block emails on our blocklist",
        description: "Block any customer whose email is in your LockSafe blocked emails list.",
        dashboardOnly: true,
        priority: "medium",
      },
      {
        id: "rule_allow_trusted",
        action: "allow",
        predicate: ":customer_id: in locksafe_trusted_customers",
        label: "Allow trusted customers",
        description: "Always allow payments from verified repeat customers (bypasses review rules).",
        dashboardOnly: true,
        priority: "medium",
      },
      {
        id: "rule_review_velocity",
        action: "review",
        predicate: ":ip_country: != 'GB' and :amount_in_gbp: > 100",
        label: "Review foreign IP + high value",
        description: "Review when IP is outside GB but amount is over £100.",
        dashboardOnly: true,
        priority: "medium",
      },
    ];

    return NextResponse.json({
      success: true,
      managedLists,
      recommendedRules,
      dashboardUrl: "https://dashboard.stripe.com/radar/rules",
    });
  } catch (error) {
    console.error("GET /api/admin/security/radar error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/security/radar — create missing value lists or add/remove items
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, listAlias, value, itemId } = body;

    const stripe = getStripe();

    if (action === "create_lists") {
      // Create any missing recommended value lists
      const allLists = await stripe.radar.valueLists.list({ limit: 100 });
      const results: string[] = [];

      for (const def of RECOMMENDED_LISTS) {
        const existing = allLists.data.find((l) => l.alias === def.alias);
        if (!existing) {
          await stripe.radar.valueLists.create({
            alias: def.alias,
            name: def.name,
            item_type: def.item_type,
          });
          results.push(`Created: ${def.name}`);
        } else {
          results.push(`Already exists: ${def.name}`);
        }
      }

      return NextResponse.json({ success: true, results });
    }

    if (action === "add_item") {
      if (!listAlias || !value) {
        return NextResponse.json({ error: "listAlias and value are required" }, { status: 400 });
      }

      // Find the list by alias
      const allLists = await stripe.radar.valueLists.list({ limit: 100 });
      const list = allLists.data.find((l) => l.alias === listAlias);
      if (!list) {
        return NextResponse.json(
          { error: `Value list '${listAlias}' not found. Create lists first.` },
          { status: 404 }
        );
      }

      const item = await stripe.radar.valueListItems.create({
        value_list: list.id,
        value: value.trim(),
      });

      return NextResponse.json({ success: true, item: { id: item.id, value: item.value } });
    }

    if (action === "remove_item") {
      if (!itemId) {
        return NextResponse.json({ error: "itemId is required" }, { status: 400 });
      }

      await stripe.radar.valueListItems.del(itemId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const stripeErr = error as { type?: string; message?: string };
    if (stripeErr?.type === "StripeInvalidRequestError") {
      return NextResponse.json({ error: stripeErr.message }, { status: 400 });
    }
    console.error("POST /api/admin/security/radar error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
