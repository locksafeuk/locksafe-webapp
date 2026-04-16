# Bland.ai Webhook Authentication

This document explains how to configure authentication for Bland.ai webhook endpoints.

## Overview

All Bland.ai webhook endpoints require authentication to prevent unauthorized access. The authentication system supports multiple methods:

1. **Webhook Secret** (Recommended) - A shared secret sent in headers
2. **HMAC Signature** - Cryptographic signature of the request body
3. **Bearer Token** - API key in Authorization header

## Quick Setup

### 1. Generate a Webhook Secret

Run this command to generate a secure random string:

```bash
openssl rand -hex 32
```

Example output: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

### 2. Add to Environment Variables

Add the secret to your `.env` file:

```env
BLAND_WEBHOOK_SECRET="your-generated-secret-here"
```

### 3. Configure Bland.ai Pathway

In your `bland-ai-pathway.json`, the tools are configured to send the secret header:

```json
{
  "headers": {
    "Content-Type": "application/json",
    "X-Bland-Webhook-Secret": "{{BLAND_WEBHOOK_SECRET}}"
  }
}
```

**Before uploading to Bland.ai**, replace `{{BLAND_WEBHOOK_SECRET}}` with your actual secret:

```json
{
  "headers": {
    "Content-Type": "application/json",
    "X-Bland-Webhook-Secret": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
  }
}
```

### 4. Configure Post-Call Webhook in Bland.ai

When setting up the post-call webhook in Bland.ai dashboard:

1. Go to **Pathways** → Your Pathway → **Settings**
2. Set **Webhook URL**: `https://locksafe.uk/api/bland/webhook`
3. Add **Custom Headers**:
   - Header Name: `X-Bland-Webhook-Secret`
   - Header Value: Your secret

## Security Features

### Rate Limiting

Each endpoint has built-in rate limiting:
- **Limit**: 60 requests per minute per IP
- **Response**: 429 Too Many Requests

### Request Logging

All authenticated requests are logged with:
- Timestamp
- Authentication method used
- Redacted sensitive data (phone numbers)

### Development Mode

If `BLAND_WEBHOOK_SECRET` is not set, authentication is **bypassed** with a warning. This is useful for local development but **never run production without a secret**.

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/bland/check-user` | Check if customer exists |
| `/api/bland/create-user` | Create new customer account |
| `/api/bland/create-job` | Create phone-initiated job |
| `/api/bland/send-notification` | Send SMS/email with continue link |
| `/api/bland/webhook` | Receive post-call data |

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Invalid webhook secret",
  "message": "Authentication failed. Please check your webhook configuration."
}
```

### 429 Too Many Requests

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in a moment."
}
```

## Testing Authentication

### Test with cURL

```bash
curl -X POST https://locksafe.uk/api/bland/check-user \
  -H "Content-Type: application/json" \
  -H "X-Bland-Webhook-Secret: your-secret-here" \
  -d '{"email": "test@example.com"}'
```

### Expected Response (Success)

```json
{
  "success": true,
  "exists": false,
  "message": "No existing account found. I'll create one for you."
}
```

## Troubleshooting

### "Authentication required" Error

- Check that `BLAND_WEBHOOK_SECRET` is set in your environment
- Verify the secret in the pathway JSON matches your env variable
- Check that the header name is exactly `X-Bland-Webhook-Secret`

### Rate Limit Exceeded

- Wait 60 seconds and try again
- Check for loops in your pathway that may cause excessive requests

### Tool Calls Failing in Bland.ai

1. Test the endpoints directly with cURL
2. Check the Bland.ai pathway logs for error messages
3. Verify the webhook secret is correctly configured in all tool headers

## Updating the Secret

If you need to rotate the webhook secret:

1. Generate a new secret: `openssl rand -hex 32`
2. Update `.env` with the new secret
3. Redeploy your application
4. Update the secret in Bland.ai pathway tool headers
5. Update the post-call webhook header in Bland.ai dashboard
