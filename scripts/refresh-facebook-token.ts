/**
 * refresh-facebook-token.ts
 *
 * Updates the Facebook SocialAccount record with a new Page Access Token.
 * Run this whenever the Facebook token expires.
 *
 * Usage:
 *   FACEBOOK_PAGE_ACCESS_TOKEN=<new_token> FACEBOOK_PAGE_ID=<page_id> \
 *     npx ts-node -P tsconfig.scripts.json scripts/refresh-facebook-token.ts
 *
 * How to get a permanent Facebook Page Access Token:
 *   1. Go to developers.facebook.com → Your App → Graph API Explorer
 *   2. Select your app and page
 *   3. Request User Token with permissions:
 *      - pages_manage_posts
 *      - pages_read_engagement
 *      - pages_show_list
 *   4. Click "Generate Access Token"
 *   5. Exchange for a long-lived token:
 *      GET https://graph.facebook.com/oauth/access_token?
 *        grant_type=fb_exchange_token
 *        &client_id=YOUR_APP_ID
 *        &client_secret=YOUR_APP_SECRET
 *        &fb_exchange_token=SHORT_LIVED_TOKEN
 *   6. Use the long-lived user token to get a permanent page token:
 *      GET https://graph.facebook.com/me/accounts?access_token=LONG_LIVED_USER_TOKEN
 *   7. Copy the "access_token" for your page (page tokens NEVER expire)
 *
 * Alternatively use the Meta Business Manager System User token (best for production).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!newToken) {
    console.error("❌ FACEBOOK_PAGE_ACCESS_TOKEN env var not set");
    console.error("Usage: FACEBOOK_PAGE_ACCESS_TOKEN=<token> npx ts-node -P tsconfig.scripts.json scripts/refresh-facebook-token.ts");
    process.exit(1);
  }

  // Find all active Facebook accounts
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "FACEBOOK" },
  });

  console.log(`Found ${accounts.length} Facebook account(s)`);

  for (const account of accounts) {
    const updateData: Record<string, string | boolean> = {
      accessToken: newToken,
      pageAccessToken: newToken,
      isActive: true,
    };

    if (pageId) {
      updateData.accountId = pageId;
      updateData.pageId = pageId;
    }

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: updateData,
    });

    console.log(`✅ Updated ${account.accountHandle || account.accountId} (${account.id})`);
  }

  // Verify the token works by testing the Facebook Graph API
  const testToken = newToken;
  const testPageId = pageId || accounts[0]?.accountId;

  if (testPageId) {
    console.log("\nVerifying token...");
    try {
      const res = await fetch(
        `https://graph.facebook.com/${testPageId}?fields=name,id&access_token=${testToken}`
      );
      const data = await res.json() as { name?: string; id?: string; error?: { message: string } };
      if (data.error) {
        console.error("❌ Token verification failed:", data.error.message);
      } else {
        console.log(`✅ Token valid! Page: ${data.name} (${data.id})`);
      }
    } catch (err) {
      console.error("❌ Token verification error:", err);
    }
  }

  console.log("\nDone! Publish the scheduled posts by running:");
  console.log("  curl -H 'Authorization: Bearer $CRON_SECRET' https://www.locksafe.uk/api/cron/publish-organic");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
