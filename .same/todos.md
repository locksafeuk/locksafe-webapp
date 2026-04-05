# AI Agents - ENABLED with Rate Limiting & Cost Controls

## Issue Identified & Fixed (April 5, 2026)
The AI agent system was:
1. Spamming Telegram notifications
2. Consuming OpenAI API credits without doing useful work
3. Missing critical core files (`src/agents/core/` folder was empty)

## Solution Implemented
Implemented full `src/agents/core/` modules with proper functionality:

### Core Modules Created
1. **types.ts** - Complete type definitions for agents, tasks, memory, budget
2. **orchestrator.ts** - Full orchestrator with:
   - Rate limiting (max 20 Telegram msgs/hour, 10 OpenAI calls/min)
   - Heartbeat interval enforcement
   - Concurrent agent limit (max 3)
   - Proper error handling and logging
3. **memory.ts** - Memory system with:
   - Short-term memories (24-hour expiry)
   - Long-term memories (no expiry)
   - Relevance scoring for retrieval
   - Automatic cleanup of expired memories
4. **budget.ts** - Budget tracking with:
   - Per-agent monthly budgets
   - Cost recording per action
   - Warning threshold (80%)
   - Pause threshold (95%)
   - Auto-pause when budget exceeded
   - Monthly budget reset
5. **skill-parser.ts** - SKILL.md parser:
   - Extracts role, mission, responsibilities
   - Parses tools and subagents
   - Generates system prompts

### Rate Limiting Features
- **Telegram**: Max 20 messages per hour
- **OpenAI**: Max 10 calls per minute
- **Heartbeats**: Respect cron intervals (e.g., every 5 min for COO, every 4 hours for CEO)
- **Concurrency**: Max 3 agents running simultaneously

### Cost Controls
- Each agent has a monthly budget (CEO: $100, CMO: $75, COO: $40, CTO: $40)
- Agents auto-pause at 95% budget usage
- Budget resets on 1st of each month
- All costs logged to database

## Current Status: ENABLED
- Set `AGENTS_ENABLED=true` in `.env`
- Agents will run heartbeats according to their schedules
- Basic heartbeats (metric checks) don't call OpenAI to save costs

---

# Admin Create Job Feature

## In Progress
- [ ] Test full flow with existing customer
- [ ] Test full flow with new customer
- [ ] Test notifications (SMS, email, push)

## Completed
- [x] Analyzed existing codebase structure
- [x] Reviewed admin jobs page
- [x] Reviewed customer request flow
- [x] Reviewed email templates
- [x] Reviewed notification setup
- [x] Create admin job creation page with multi-step form
- [x] Create API endpoint for admin job creation
- [x] Add onboarding email template for new customers
- [x] Implement customer search/creation in form
- [x] Add onboarding confirmation page for new customers
- [x] Add "Create Job" button to admin jobs page

## Files Created/Modified
- `src/app/admin/jobs/create/page.tsx` - Admin job creation form (multi-step)
- `src/app/api/admin/jobs/create/route.ts` - API endpoint for job creation
- `src/app/onboard/[token]/page.tsx` - Customer onboarding page
- `src/app/api/customer/onboard/route.ts` - Onboarding API endpoint
- `src/lib/email.ts` - Added onboarding email templates
- `src/app/admin/jobs/page.tsx` - Added Create Job button

## Flow Summary

### For Existing Customers:
1. Admin searches for customer by name/phone/email
2. Admin selects customer and enters job details
3. Job is created and locksmith notifications sent immediately

### For New Customers:
1. Admin enters new customer details (name, phone, optional email)
2. Admin enters job details
3. Customer account created with onboarding token
4. Customer receives SMS (and email if provided) with onboarding link
5. Customer clicks link, sets password, confirms address
6. Job becomes active and locksmiths are notified

## API Endpoints

### POST /api/admin/jobs/create
Creates a new job for existing or new customer.

Body:
```json
{
  "customerId": "existing-customer-id", // OR:
  "customerName": "John Doe",
  "customerPhone": "07123456789",
  "customerEmail": "john@example.com", // optional
  "problemType": "lockout",
  "propertyType": "house",
  "urgency": "emergency",
  "postcode": "SW1A 1AA",
  "address": "123 Main Street",
  "description": "Additional details",
  "assessmentFee": 29
}
```

### GET /api/admin/jobs/create?search=query
Search for existing customers by name, phone, or email.

### GET /api/customer/onboard?token=xyz
Get onboarding data for new customer.

### POST /api/customer/onboard
Complete customer onboarding (set password, confirm address).

## Email Templates Added
- `sendCustomerOnboardingEmail` - Sent to new customers with onboarding link
- `sendOnboardingCompleteEmail` - Sent after customer completes onboarding

## OneSignal Integration Tasks (Previous)

### Completed
- [x] Analyzed existing push notification setup
- [x] Update Prisma schema with OneSignal player IDs
- [x] Create OneSignal server-side library (`src/lib/onesignal.ts`)
- [x] Create OneSignal service worker (`public/OneSignalSDKWorker.js`)
- [x] Create useOneSignal hook (`src/hooks/useOneSignal.ts`)
- [x] Create OneSignal provider component
- [x] Update PushNotificationBanner to use OneSignal
- [x] Add API routes for OneSignal subscription
- [x] Integrate with job notification system
- [x] Add push notifications to job status changes
- [x] Add push notifications to quote events
- [x] Add push notifications to application acceptance
- [x] Set up notification segments configuration
- [x] Create comprehensive setup guide

## Environment Variables Required
```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-onesignal-app-id
ONESIGNAL_REST_API_KEY=your-rest-api-key
NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID=web.onesignal.auto.xxxxx
```

## Push Notification Events Now Active
1. **EN_ROUTE** - Customer notified when locksmith starts traveling
2. **ARRIVED** - Customer notified when locksmith arrives
3. **QUOTE_READY** - Customer notified when quote is ready
4. **QUOTE_ACCEPTED** - Locksmith notified when quote is accepted
5. **QUOTE_DECLINED** - Locksmith notified when quote is declined
6. **WORK_COMPLETE** - Customer notified when work is finished
7. **CUSTOMER_SIGNED** - Locksmith notified when customer signs
8. **LOCKSMITH_ASSIGNED** - Customer notified when locksmith assigned
9. **JOB_ACCEPTED** - Locksmith notified when selected for job
10. **NEW_JOB_AVAILABLE** - Locksmiths notified of new jobs in area
