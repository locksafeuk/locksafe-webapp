# Bland.ai Voice Integration Setup

This guide explains how to set up the Bland.ai voice integration for LockSafe UK emergency phone calls.

## Overview

The Bland.ai integration allows customers to call a phone number and speak with an AI assistant that:
1. Assesses if they're in immediate danger
2. Collects their contact details (email is REQUIRED)
3. Creates/checks their account
4. Registers their emergency locksmith request
5. Sends them an SMS/email with a link to complete the request

## Important Notes

### UK Phone Numbers (BYOT)
Bland.ai's native phone numbers are US-only. For UK numbers, we use **Bring Your Own Twilio (BYOT)** integration:
- Purchase UK number from Twilio
- Connect Twilio to Bland.ai using encrypted key
- Import the number into Bland.ai
- Use for both inbound and outbound calls

### Email Requirement
Email is **REQUIRED** for registration. The pathway is designed to:
- Clearly ask for email
- Explain why it's needed (account creation, updates)
- Offer alternatives if customer refuses (website, callback)
- End call gracefully if no email provided

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BLAND.AI PLATFORM                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Pathway (Conversation Flow)                  │  │
│  │   • Greeting & Safety Check                               │  │
│  │   • Collect Details                                       │  │
│  │   • Account Check (API call)                              │  │
│  │   • Service Details                                       │  │
│  │   • Create Job (API call)                                 │  │
│  │   • Send Notification (API call)                          │  │
│  │   • Summary & End                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ HTTP Calls to LockSafe API       │
│                              ▼                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LOCKSAFE PLATFORM                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Endpoints                          │  │
│  │   POST /api/bland/check-user      → Check/Create user    │  │
│  │   POST /api/bland/create-user     → Create account       │  │
│  │   POST /api/bland/create-job      → Register job         │  │
│  │   POST /api/bland/send-notification → Send SMS/Email     │  │
│  │   POST /api/bland/webhook         → Post-call logging    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Continue Request Page                       │  │
│  │   /continue-request/[token]                               │  │
│  │   → Pre-filled from phone call                            │  │
│  │   → Customer completes service selection                  │  │
│  │   → Submits to get locksmith quotes                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Setup Steps

### 1. Get Bland.ai Account

1. Sign up at [https://app.bland.ai](https://app.bland.ai)
2. Get your API key from the dashboard
3. Add to `.env`:
   ```
   BLAND_API_KEY="your-api-key"
   ```

### 2. Set Up Twilio (REQUIRED for UK Numbers)

Since Bland.ai only provides US numbers natively, you MUST use Twilio for UK:

1. Sign up at [https://console.twilio.com](https://console.twilio.com)
2. Purchase a UK phone number (+44)
3. Get Account SID and Auth Token from console
4. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID="your-account-sid"
   TWILIO_AUTH_TOKEN="your-auth-token"
   TWILIO_PHONE_NUMBER="+44..."
   ```

### 3. Connect Twilio to Bland.ai (BYOT)

This is the critical step for UK numbers:

1. Go to Bland.ai Dashboard → Add-ons → BYOT
2. Click "Generate New Key" with your Twilio credentials
3. **SAVE THE ENCRYPTED KEY** - it's only shown once!
4. Add to `.env`:
   ```
   BLAND_ENCRYPTED_KEY="your-encrypted-key"
   ```

**Or via API:**
```bash
curl -X POST https://api.bland.ai/v1/accounts \
  -H "Authorization: Bearer YOUR_BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "twilio_account_sid": "YOUR_TWILIO_SID",
    "twilio_auth_token": "YOUR_TWILIO_TOKEN"
  }'
```

### 4. Import Twilio Number to Bland.ai

1. Go to Bland.ai Dashboard → Add-ons → BYOT
2. Your Twilio numbers will appear
3. Select your UK number and click "Import"
4. The number is now available in Bland.ai

**Or via API:**
```bash
curl -X POST https://api.bland.ai/v1/inbound/insert \
  -H "Authorization: Bearer YOUR_BLAND_API_KEY" \
  -H "encrypted_key: YOUR_ENCRYPTED_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+447123456789"
  }'
```

### 5. Upload Pathway to Bland.ai

You can either:

**Option A: Use the Bland.ai Dashboard (Recommended)**
1. Go to [https://app.bland.ai/dashboard/convo-pathways](https://app.bland.ai/dashboard/convo-pathways)
2. Click "Create Pathway"
3. Import the JSON from `docs/bland-ai-pathway.json`
4. Copy the Pathway ID

**Option B: Use the API**
```bash
# Create pathway
curl -X POST https://api.bland.ai/v1/pathway/create \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "LockSafe Emergency Intake",
    "description": "Emergency locksmith request intake flow"
  }'

# Save the pathway_id from the response
```

### 6. Configure Custom Tools

In the Bland.ai dashboard, set up Custom Tools for each API endpoint:

#### Tool 1: Check User
- **Name:** `check_user`
- **Description:** Check if customer has an existing account
- **URL:** `https://yourdomain.com/api/bland/check-user`
- **Method:** POST
- **Headers:** `Authorization: Bearer YOUR_BLAND_API_KEY`
- **Parameters:**
  - `email` (string, required) - Customer's email address (primary identifier for accounts)
  - `phone_number` (string, optional) - Customer's phone number (secondary check)

#### Tool 2: Create User
- **Name:** `create_user`
- **Description:** Create a new customer account
- **URL:** `https://yourdomain.com/api/bland/create-user`
- **Method:** POST
- **Headers:** `Authorization: Bearer YOUR_BLAND_API_KEY`
- **Parameters:**
  - `full_name` (string, required)
  - `phone_number` (string, required)
  - `email` (string, optional)
  - `postcode` (string, optional)
  - `bland_call_id` (string, from system)

#### Tool 3: Create Job
- **Name:** `create_job`
- **Description:** Register an emergency locksmith request
- **URL:** `https://yourdomain.com/api/bland/create-job`
- **Method:** POST
- **Headers:** `Authorization: Bearer YOUR_BLAND_API_KEY`
- **Parameters:**
  - `customer_id` (string, required)
  - `postcode` (string, required)
  - `address` (string, required)
  - `service_type` (string, required)
  - `property_type` (string, required)
  - `urgency` (string, optional)
  - `description` (string, optional)
  - `bland_call_id` (string, from system)

#### Tool 4: Send Notification
- **Name:** `send_notification`
- **Description:** Send SMS/email with continue link
- **URL:** `https://yourdomain.com/api/bland/send-notification`
- **Method:** POST
- **Headers:** `Authorization: Bearer YOUR_BLAND_API_KEY`
- **Parameters:**
  - `job_id` (string, required)
  - `customer_id` (string, required)
  - `customer_email` (string, required) - Customer's email for sending continuation link
  - `customer_phone` (string, optional) - For SMS notification
  - `customer_name` (string, optional)
  - `job_number` (string, optional)
  - `continue_url` (string, optional)

### 7. Configure Inbound Number with Pathway

Now link your imported Twilio number to the pathway:

1. In Bland.ai dashboard, go to Numbers → Inbound
2. Find your imported UK number
3. Click "Configure"
4. Select your LockSafe pathway
5. Save

**Or via API:**
```bash
curl -X POST https://api.bland.ai/v1/inbound/YOUR_PHONE_NUMBER/update \
  -H "Authorization: Bearer YOUR_BLAND_API_KEY" \
  -H "encrypted_key: YOUR_ENCRYPTED_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pathway_id": "YOUR_PATHWAY_ID"
  }'
```

Add to `.env`:
```
BLAND_INBOUND_NUMBER="+447123456789"
BLAND_PATHWAY_ID="your-pathway-id"
```

### 8. Configure Webhook

1. In Bland.ai dashboard, go to Settings -> Webhooks
2. Add webhook URL: `https://yourdomain.com/api/bland/webhook`
3. Select events: `call.completed`, `call.failed`

### 9. Test the Integration

1. Run the development server
2. Call your Twilio UK number
3. Go through the flow
4. Check that:
   - Customer provides email (required!)
   - Customer account is created
   - Job is created with status `PHONE_INITIATED`
   - SMS/Email is sent with continue link
   - Webhook receives post-call data
   - Continue request page works

## API Endpoints

### POST /api/bland/check-user

Check if a customer exists by phone number.

**Request:**
```json
{
  "phone_number": "+447123456789",
  "email": "customer@example.com"
}
```

**Response (exists):**
```json
{
  "success": true,
  "exists": true,
  "customer_id": "abc123",
  "customer_name": "John Smith",
  "message": "Welcome back, John Smith!"
}
```

**Response (new):**
```json
{
  "success": true,
  "exists": false,
  "message": "No existing account found."
}
```

### POST /api/bland/create-user

Create a new customer account.

**Request:**
```json
{
  "full_name": "John Smith",
  "phone_number": "+447123456789",
  "email": "john@example.com",
  "postcode": "SW1A 1AA",
  "bland_call_id": "call_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "customer_id": "abc123",
  "customer_name": "John Smith",
  "is_new": true,
  "message": "Perfect! I've created your account."
}
```

### POST /api/bland/create-job

Register an emergency locksmith request.

**Request:**
```json
{
  "customer_id": "abc123",
  "postcode": "SW1A 1AA",
  "address": "10 Downing Street, London",
  "service_type": "locked_out",
  "property_type": "house",
  "urgency": "immediate",
  "description": "Locked out, keys inside",
  "bland_call_id": "call_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "job123",
  "job_number": "LS-202603-1234",
  "continue_url": "https://locksafe.uk/continue-request/abc123xyz",
  "continue_token": "abc123xyz",
  "message": "I've registered your request. Reference: LS-202603-1234"
}
```

### POST /api/bland/send-notification

Send SMS/email with continue link.

**Request:**
```json
{
  "job_id": "job123",
  "customer_id": "abc123",
  "customer_phone": "+447123456789",
  "customer_email": "john@example.com",
  "customer_name": "John Smith",
  "job_number": "LS-202603-1234",
  "continue_url": "https://locksafe.uk/continue-request/abc123xyz"
}
```

**Response:**
```json
{
  "success": true,
  "notifications_sent": ["sms", "email"],
  "sms_sent": true,
  "email_sent": true,
  "message": "I've sent you an SMS and email with a link."
}
```

### POST /api/bland/webhook

Receives post-call data from Bland.ai.

**Payload from Bland.ai:**
```json
{
  "call_id": "call_xyz",
  "call_status": "completed",
  "call_length": 180,
  "from": "+447123456789",
  "to": "+448001234567",
  "completed": true,
  "transcripts": [...],
  "summary": "Customer locked out...",
  "variables": {
    "customer_name": "John Smith",
    "job_id": "job123",
    "job_number": "LS-202603-1234"
  }
}
```

## Customer Journey

1. **Customer calls emergency number**
   - AI greets and checks if they're safe

2. **AI collects information**
   - Name, phone, email, postcode
   - Service type (lockout, broken lock, etc.)
   - Property type (house, flat, etc.)
   - Full address

3. **AI creates request**
   - Creates/finds customer account
   - Registers job with status `PHONE_INITIATED`
   - Generates continue token

4. **AI sends notification**
   - SMS with continue link
   - Email with continue link

5. **Customer continues online**
   - Clicks link in SMS/email
   - Confirms address on map
   - Submits request

6. **Request goes live**
   - Job status changes to `PENDING`
   - Locksmiths notified
   - Customer receives quotes

## Database Changes

The integration adds these fields to the schema:

### Customer
- `createdVia: String` - "web" | "phone" | "app"

### Job
- `createdVia: String` - "web" | "phone"
- `blandCallId: String?` - Bland.ai call ID
- `phoneCollectedData: Json?` - Data from phone call
- `continueToken: String? @unique` - Token for continuing request
- `status: PHONE_INITIATED` - New status for phone-started jobs

## Knowledge Base Sections

The pathway includes a comprehensive Knowledge Base (node id "10") that the AI uses to answer customer questions. The KB is organized into **20 sections**:

### Section Overview

| Section | Content |
|---------|---------|
| 1 | **About LockSafe UK** - Company overview, contact info |
| 2 | **How Service Works** - Step-by-step process |
| 3 | **Required Information** - EMAIL mandatory, what we collect |
| 4 | **Service Types** - locked_out, broken_lock, key_stuck, etc. |
| 5 | **Property Types** - house, flat, commercial, car |
| 6 | **Pricing Information** - Assessment fee, quotes, payment |
| 7 | **Timing & Availability** - 24/7 service, response times |
| 8 | **Coverage Area** - UK-wide, postcode matching |
| 9 | **Customer Protection** - GPS, photos, signatures, disputes |
| 10 | **FAQ - Pricing** - Cost questions |
| 11 | **FAQ - Timing** - Response time questions |
| 12 | **FAQ - Trust & Safety** - Locksmith verification questions |
| 13 | **FAQ - Process** - What happens next questions |
| 14 | **FAQ - Coverage** - Area questions |
| 15 | **FAQ - Specific Situations** - Car, burglary, broken key, etc. |
| 16 | **FAQ - After Service** - Receipt, warranty, reviews |
| 17 | **Handling Difficult Situations** - Angry, confused, hesitant customers |
| 18 | **API Tools Reference** - Parameters for each tool |
| 19 | **Call Flow Checklist** - Required data at each step |
| 20 | **Emergency Protocols** - Danger situations, 999 redirect |

### FAQ Categories

The FAQs cover common customer questions:

**Pricing Questions:**
- How much will it cost?
- Why is there an assessment fee?
- Is £29 the total cost?
- Can I pay cash?
- Are there hidden fees?

**Timing Questions:**
- How long will someone take?
- Can I book for tomorrow?
- What if no one responds?

**Trust Questions:**
- Are your locksmiths trustworthy?
- What if they damage my door?
- Do you have reviews?

**Process Questions:**
- What happens after this call?
- Why do you need my email?
- Do I have to be present?

**Situation Questions:**
- Keys locked in car?
- I've been burgled?
- Key broke in lock?
- UPVC door won't lock?
- Safe won't open?

### Handling Difficult Situations

Section 17 provides scripts for common challenges:

- **Angry/frustrated customer** - Acknowledge, reassure, stay calm
- **Confused customer** - Simplify, explain step-by-step
- **Wants exact price** - Explain assessment fee, no promises
- **Hesitant about email** - Explain why, suggest alternatives
- **In a hurry** - Speed up without skipping info
- **Language difficulties** - Speak slowly, repeat, spell
- **Wants to complain** - Listen, direct to support
- **Changes their mind** - End gracefully

### Updating the Knowledge Base

To update the Knowledge Base:

1. Edit `docs/bland-ai-pathway.json`
2. Find node with `"id": "10"`
3. Modify the `"kb"` field (escaped newlines)
4. Re-import the pathway to Bland.ai

## Troubleshooting

### Call not connecting to pathway
- Check pathway ID is correct in Bland.ai inbound number config
- Verify API key is valid

### Tools not calling LockSafe API
- Check tool URLs are correct
- Verify BLAND_API_KEY is set in .env
- Check API is accessible from internet

### SMS not sending
- Verify Twilio credentials in .env
- Check Twilio phone number is SMS-capable
- Verify customer phone format

### Continue link not working
- Check `continueToken` is saved in job
- Verify NEXT_PUBLIC_BASE_URL is correct
- Check job status is still `PHONE_INITIATED`

## Cost Considerations

- **Bland.ai:** ~$0.10-0.15 per minute of call time
- **Twilio SMS:** ~£0.04 per SMS
- **Resend Email:** Free tier available

Estimate: £0.20-0.30 per phone-initiated request
