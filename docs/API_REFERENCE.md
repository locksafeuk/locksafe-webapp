# LockSafe UK API Reference

## Base URL

**Development:** `http://localhost:3000`
**Production:** `https://locksafe.uk`

---

## Authentication

### Customer/Locksmith Auth
Uses JWT tokens stored in HTTP-only cookies.

```typescript
// Login sets cookie automatically
POST /api/auth/login
POST /api/locksmiths/auth
```

### Admin Auth
```typescript
POST /api/admin/auth
Authorization: Bearer <jwt_token>
```

### Webhook Auth
Webhooks use signature verification:
- **Stripe**: `stripe-signature` header
- **Telegram**: Authorized chat ID verification
- **WhatsApp**: `hub.verify_token` verification
- **Bland.ai**: `X-Bland-Webhook-Secret` header

---

## Jobs API

### Create Job
```http
POST /api/jobs
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "07123456789",
  "postcode": "SW1A 1AA",
  "address": "10 Downing Street, London",
  "problemType": "lockout",
  "propertyType": "house",
  "description": "Locked out of front door"
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "65f...",
    "jobNumber": "LS-2026-0001",
    "status": "PENDING"
  }
}
```

### Get Job
```http
GET /api/jobs/[id]
```

### List Jobs
```http
GET /api/jobs?status=PENDING&limit=10&skip=0
```

### Update Job Status
```http
PUT /api/jobs/[id]/status
Content-Type: application/json

{
  "status": "EN_ROUTE",
  "gps": { "lat": 51.5074, "lng": -0.1278 }
}
```

### Submit Application
```http
POST /api/jobs/[id]/applications
Content-Type: application/json

{
  "assessmentFee": 29,
  "eta": 15,
  "message": "I can be there in 15 minutes"
}
```

### Submit Quote
```http
POST /api/jobs/[id]/quote
Content-Type: application/json

{
  "lockType": "cylinder",
  "defect": "Broken mechanism",
  "difficulty": "medium",
  "parts": [
    { "name": "Euro Cylinder", "quantity": 1, "unitPrice": 35 }
  ],
  "labourCost": 65,
  "labourTime": 30
}
```

### Submit Signature
```http
POST /api/jobs/[id]/signature
Content-Type: application/json

{
  "signatureData": "data:image/png;base64,...",
  "signerName": "John Smith",
  "confirmsWork": true,
  "confirmsPrice": true,
  "confirmsSatisfied": true
}
```

---

## Payments API

### Create Payment Intent
```http
POST /api/payments/create-intent
Content-Type: application/json

{
  "jobId": "65f...",
  "type": "assessment",
  "amount": 2900
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### Setup Card for Later
```http
POST /api/payments/setup-card
Content-Type: application/json

{
  "customerId": "65f..."
}
```

### Charge Saved Card
```http
POST /api/payments/charge-saved-card
Content-Type: application/json

{
  "customerId": "65f...",
  "jobId": "65f...",
  "amount": 15000
}
```

---

## Locksmith API

### Register
```http
POST /api/locksmiths/register
Content-Type: application/json

{
  "name": "Mike's Locks",
  "email": "mike@mikeslocks.com",
  "phone": "07987654321",
  "password": "secure123",
  "baseLat": 51.5074,
  "baseLng": -0.1278,
  "coverageRadius": 10,
  "services": ["emergency", "commercial", "automotive"]
}
```

### Get Dashboard
```http
GET /api/locksmiths/[id]/dashboard
```

**Response:**
```json
{
  "locksmith": { ... },
  "stats": {
    "activeJobs": 2,
    "completedJobs": 45,
    "totalEarnings": 12500,
    "averageRating": 4.8
  },
  "recentJobs": [ ... ]
}
```

### Update Availability
```http
PUT /api/locksmith/availability
Content-Type: application/json

{
  "isAvailable": true
}
```

### Update Profile
```http
PUT /api/locksmith/profile
Content-Type: application/json

{
  "coverageRadius": 15,
  "services": ["emergency", "residential"]
}
```

---

## Customer API

### Get Profile
```http
GET /api/customer/profile
```

### Update Profile
```http
PUT /api/customer/profile
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john@example.com"
}
```

### Accept Terms
```http
POST /api/customer/accept-terms
```

---

## Admin API

### Login
```http
POST /api/admin/auth
Content-Type: application/json

{
  "email": "admin@locksafe.uk",
  "password": "admin123"
}
```

### Get Stats
```http
GET /api/admin/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "jobs": {
    "total": 500,
    "pending": 5,
    "active": 12,
    "completed": 480
  },
  "revenue": {
    "today": 1500,
    "week": 8500,
    "month": 35000
  },
  "locksmiths": {
    "total": 25,
    "active": 15,
    "available": 8
  }
}
```

### List Jobs (Admin)
```http
GET /api/admin/jobs?status=PENDING&limit=50
Authorization: Bearer <token>
```

### Manage Payouts
```http
GET /api/admin/payouts
POST /api/admin/payouts/generate
Authorization: Bearer <token>
```

---

## Agent API (Telegram Bot)

### Get Stats
```http
GET /api/agent/stats
X-Telegram-Chat-ID: <chat_id>
```

### List Jobs
```http
GET /api/agent/jobs?status=active
X-Telegram-Chat-ID: <chat_id>
```

### Dispatch Job
```http
POST /api/agent/dispatch
Content-Type: application/json
X-Telegram-Chat-ID: <chat_id>

{
  "jobId": "65f...",
  "locksmithId": "65f..."
}
```

### NLP Query
```http
POST /api/agent/nlp
Content-Type: application/json

{
  "query": "How many jobs today?",
  "context": "admin"
}
```

---

## Webhook Endpoints

### Stripe Webhook
```http
POST /api/webhooks/stripe
stripe-signature: <signature>

Handles:
- payment_intent.succeeded
- payment_intent.payment_failed
- account.updated (Connect)
```

### WhatsApp Webhook
```http
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=xxx
POST /api/webhooks/whatsapp
```

### Telegram Admin Bot
```http
GET /api/agent/telegram?setup=true
POST /api/agent/telegram
```

### Telegram Locksmith Bot
```http
GET /api/locksmith/bot?setup=true
POST /api/locksmith/bot
```

### Bland.ai Voice Webhook
```http
POST /api/bland/webhook
X-Bland-Webhook-Secret: <secret>
```

---

## Cron Endpoints

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`

### Generate Payouts
```http
GET /api/cron/generate-payouts
```

### Signature Reminders
```http
GET /api/cron/signature-reminders
```

### Insurance Reminders
```http
GET /api/cron/insurance-reminders
```

### Availability Schedule
```http
GET /api/cron/availability-schedule
```

### Sync Meta Performance
```http
GET /api/cron/sync-meta-performance
```

### Publish Organic Posts
```http
GET /api/cron/publish-organic
```

---

## Marketing API

### Track Session
```http
POST /api/marketing/session
Content-Type: application/json

{
  "visitorId": "xxx",
  "deviceType": "mobile",
  "referrer": "https://google.com",
  "utmSource": "facebook"
}
```

### Track Event
```http
POST /api/marketing/track
Content-Type: application/json

{
  "sessionId": "xxx",
  "type": "form_start",
  "element": "request_form",
  "data": { ... }
}
```

### Get Modals
```http
GET /api/marketing/modals?sessionId=xxx
```

---

## AI/Content API

### Generate Ad Copy
```http
POST /api/admin/ai/generate-copy
Authorization: Bearer <token>
Content-Type: application/json

{
  "objective": "LEADS",
  "targetAudience": "Homeowners in London",
  "emotionalAngle": "urgency"
}
```

### AI Chat
```http
POST /api/admin/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What's our best performing ad?",
  "context": { ... }
}
```

---

## Job Status Flow

```
PHONE_INITIATED → PENDING → ACCEPTED → EN_ROUTE → ARRIVED
                     ↓
                 DIAGNOSING → QUOTED → QUOTE_ACCEPTED → IN_PROGRESS
                                ↓
                         QUOTE_DECLINED
                                           ↓
                 PENDING_CUSTOMER_CONFIRMATION → COMPLETED → SIGNED
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Server Error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Public APIs | 100/min |
| Auth APIs | 10/min |
| Admin APIs | 300/min |
| Webhook APIs | 1000/min |

---

## Testing

### Stripe Test Cards
- Success: `4242424242424242`
- Declined: `4000000000000002`
- Auth Required: `4000002760003184`

### Test Phone Numbers
- WhatsApp test: Use Meta's test numbers in dev
- Twilio test: Use `+15005550006` (magic number)
