/**
 * Test Facebook Graph API Integration
 *
 * Usage:
 *   bun run scripts/test-facebook-api.ts
 *
 * This script will:
 * 1. Check if credentials are configured
 * 2. Verify Page Access Token is valid
 * 3. Get page information
 * 4. Optionally post a test message
 */

const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface PageInfo {
  id: string;
  name: string;
  username?: string;
  followers_count?: number;
  fan_count?: number;
}

async function getPageInfo(pageId: string, accessToken: string): Promise<PageInfo | null> {
  try {
    const response = await fetch(
      `${META_BASE_URL}/${pageId}?fields=id,name,username,followers_count,fan_count&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('❌ Error fetching page info:', data.error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Network error:', error);
    return null;
  }
}

async function testPostMessage(pageId: string, accessToken: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${META_BASE_URL}/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('❌ Error posting message:', data.error.message);
      return false;
    }

    console.log('✅ Test post published successfully!');
    console.log('   Post ID:', data.id);
    return true;
  } catch (error) {
    console.error('❌ Network error:', error);
    return false;
  }
}

async function checkTokenExpiry(accessToken: string): Promise<void> {
  try {
    const response = await fetch(
      `${META_BASE_URL}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.data) {
      console.log('\n📋 Token Information:');
      console.log('   Valid:', data.data.is_valid);
      console.log('   App ID:', data.data.app_id);
      console.log('   Type:', data.data.type);
      console.log('   Scopes:', data.data.scopes?.join(', '));

      if (data.data.expires_at) {
        const expiryDate = new Date(data.data.expires_at * 1000);
        console.log('   Expires:', expiryDate.toLocaleString());
      } else {
        console.log('   Expires: Never (long-lived token)');
      }
    }
  } catch (error) {
    console.error('⚠️  Could not check token expiry');
  }
}

async function main() {
  console.log('🧪 Testing Facebook Graph API Integration\n');
  console.log('═'.repeat(60));

  // Check environment variables
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pageId) {
    console.error('❌ META_PAGE_ID environment variable not set');
    console.log('\n💡 Set it in your .env file or Vercel dashboard');
    process.exit(1);
  }

  if (!accessToken) {
    console.error('❌ META_ACCESS_TOKEN environment variable not set');
    console.log('\n💡 Set it in your .env file or Vercel dashboard');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log('   Page ID:', pageId);
  console.log('   Access Token:', `${accessToken.substring(0, 20)}...`);

  // Test token expiry
  await checkTokenExpiry(accessToken);

  // Get page information
  console.log('\n📄 Fetching page information...');
  const pageInfo = await getPageInfo(pageId, accessToken);

  if (!pageInfo) {
    console.error('\n❌ Failed to fetch page information');
    console.log('\n💡 Check that:');
    console.log('   1. Your Page ID is correct');
    console.log('   2. Your Access Token is valid');
    console.log('   3. The token has pages_read_engagement permission');
    process.exit(1);
  }

  console.log('✅ Page information retrieved:');
  console.log('   Name:', pageInfo.name);
  console.log('   Username:', pageInfo.username || 'N/A');
  console.log('   Followers:', pageInfo.fan_count || pageInfo.followers_count || 'N/A');

  // Ask if user wants to post a test message
  console.log('\n═'.repeat(60));
  console.log('🎯 Test Message Posting');
  console.log('\nDo you want to post a test message? (y/n)');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('> ', async (answer: string) => {
    readline.close();

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      const testMessage = `🧪 Test post from LockSafe API - ${new Date().toLocaleString()}`;
      console.log('\n📤 Posting test message...');
      console.log('   Message:', testMessage);

      const success = await testPostMessage(pageId, accessToken, testMessage);

      if (success) {
        console.log('\n✅ All tests passed! Facebook integration is working correctly.');
        console.log('\n💡 Next steps:');
        console.log('   1. Go to /admin/organic/settings');
        console.log('   2. Connect your account via UI');
        console.log('   3. Or add SocialAccount record to database');
      } else {
        console.log('\n❌ Test posting failed');
        console.log('\n💡 Check that your token has pages_manage_posts permission');
      }
    } else {
      console.log('\n✅ Connection test passed! (skipped posting test)');
      console.log('\n💡 To complete setup:');
      console.log('   1. Go to /admin/organic/settings');
      console.log('   2. Click "Connect Account"');
      console.log('   3. Enter your credentials');
      console.log('   4. Start publishing posts!');
    }

    console.log('\n═'.repeat(60));
  });
}

main().catch(console.error);
