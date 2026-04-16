# Admin Job Assignment Flow - Implementation Summary

## Overview
Implemented a complete admin-to-locksmith job assignment workflow that allows admins to directly assign jobs to specific locksmiths, requiring the locksmith to accept or decline before the job proceeds.

## Implementation Date
April 14, 2026

## Feature Description
Previously, when an admin assigned a locksmith to a job, the job was immediately set to ACCEPTED status without notifying the locksmith or requiring their consent. The new flow:

1. **Admin assigns locksmith** → System creates a special application with `status: "admin_assigned"`
2. **Locksmith is notified** via SMS, email, and push notifications
3. **Locksmith reviews and responds** via dashboard (accept or decline)
4. **If accepted** → Customer receives payment link for assessment fee
5. **If declined** → Admin is notified to reassign the job

---

## Backend Implementation

### API Endpoints Created

#### 1. Accept Admin Assignment
**File:** `/src/app/api/locksmith/applications/[id]/accept/route.ts`

**Method:** `POST`

**Endpoint:** `/api/locksmith/applications/[id]/accept`

**Flow:**
- Validates application is in `admin_assigned` status
- Updates status to `accepted`
- Sends payment link to customer (SMS, email, push)
- Creates in-app notification for customer
- Returns payment URL

#### 2. Decline Admin Assignment
**File:** `/src/app/api/locksmith/applications/[id]/decline/route.ts`

**Method:** `POST`

**Endpoint:** `/api/locksmith/applications/[id]/decline`

**Body:** `{ reason?: string }`

**Flow:**
- Validates application is in `admin_assigned` status
- Updates status to `declined`
- Sends Telegram notification to admin with decline reason
- Returns success response

### API Endpoints Modified

#### 3. Admin Assignment Endpoint
**File:** `/src/app/api/admin/jobs/[id]/assign/route.ts`

**Already Implemented Features:**
- Creates `LocksmithApplication` with `status: "admin_assigned"`
- Pre-populates assessment fee from locksmith profile
- Sends SMS to locksmith
- Sends email to locksmith via `sendLocksmithAssignmentEmail()`
- Sends push notification via OneSignal
- Creates in-app notification

#### 4. Locksmith Applications Endpoint
**File:** `/src/app/api/locksmith/applications/route.ts`

**Modification:**
```typescript
// Before: Only fetched "pending" applications
whereClause.status = "pending";

// After: Fetches both "pending" and "admin_assigned" applications
whereClause.status = { in: ["pending", "admin_assigned"] };
```

---

## Email Templates

### 1. Locksmith Assignment Email
**Function:** `sendLocksmithAssignmentEmail()`

**File:** `/src/lib/email.ts`

**Features:**
- Orange-themed urgent design
- Action required alert banner
- Pre-filled assessment fee display
- Direct link to job details
- Clear next steps explanation

**Sent when:** Admin assigns a job to a locksmith

### 2. Customer Payment Link Email
**Function:** `sendCustomerPaymentLinkEmail()`

**File:** `/src/lib/email.ts`

**Features:**
- Job details summary
- Locksmith information
- Assessment fee amount
- Prominent "Pay Assessment Fee" button
- Explanation of assessment fee purpose

**Sent when:** Locksmith accepts admin assignment

---

## Telegram Notifications

### Function Added
**Function:** `notifyLocksmithDeclinedAssignment()`

**File:** `/src/lib/telegram.ts`

**Message includes:**
- Job number and details
- Locksmith name and phone
- Location and problem type
- Decline reason
- Action required prompt for admin

**Sent when:** Locksmith declines an admin-assigned job

---

## Frontend Implementation

### Locksmith Dashboard
**File:** `/src/app/locksmith/dashboard/page.tsx`

**New Features:**

1. **Admin-Assigned Jobs Section**
   - Prominent orange/amber gradient design
   - Appears above active jobs when assignments exist
   - Shows count of pending assignments
   - Alert badge for urgency

2. **Job Card Display**
   - Job number and problem type
   - Location and time ago
   - Assessment fee (pre-populated)
   - Full address display
   - "ADMIN ASSIGNED" status badge

3. **Action Buttons**
   - Green "Accept Job" button
   - Red outlined "Decline" button
   - Buttons side-by-side on each card

4. **Accept Handler**
   ```typescript
   handleAcceptAssignment(applicationId)
   ```
   - Calls `/api/locksmith/applications/[id]/accept`
   - Refreshes dashboard on success
   - Shows confirmation alert

5. **Decline Handler**
   ```typescript
   handleDeclineAssignment(applicationId, jobNumber)
   ```
   - Prompts for decline reason
   - Calls `/api/locksmith/applications/[id]/decline`
   - Refreshes dashboard on success
   - Shows confirmation alert

---

## Data Model

### LocksmithApplication Status Values
- `"pending"` - Normal locksmith application
- `"admin_assigned"` - Admin assigned, awaiting locksmith response
- `"accepted"` - Locksmith accepted (payment pending from customer)
- `"rejected"` - Application was rejected
- `"declined"` - Locksmith declined admin assignment

### Assessment Fee
Pre-populated from `locksmith.defaultAssessmentFee` when admin assigns the job.

---

## Notification Flow

### When Admin Assigns Locksmith

#### Locksmith Receives:
1. **SMS** - Job details + link to respond
2. **Email** - Full job details with action required banner
3. **Push** - OneSignal notification (if enabled)
4. **In-App** - Dashboard notification with accept/decline UI

### When Locksmith Accepts

#### Customer Receives:
1. **SMS** - Locksmith assigned + payment link
2. **Email** - Booking details with "Pay Assessment Fee" button
3. **Push** - OneSignal notification
4. **In-App** - Notification with payment link

### When Locksmith Declines

#### Admin Receives:
1. **Telegram** - Notification with locksmith name, job details, and decline reason

---

## User Experience

### Admin Perspective
1. Views unassigned job in admin panel
2. Clicks "Assign Locksmith" button
3. Selects locksmith from dropdown
4. Clicks "Assign Job"
5. Sees success message: "Locksmith has been notified. They must accept or decline."
6. If declined, receives Telegram notification to reassign

### Locksmith Perspective
1. Receives notifications (SMS, email, push)
2. Opens dashboard → sees prominent orange section with pending assignments
3. Reviews job details and pre-filled assessment fee
4. Clicks "Accept Job" or "Decline"
   - If declining, prompted for optional reason
5. Sees confirmation message
6. If accepted, job appears in active jobs once customer pays

### Customer Perspective
1. Waits for locksmith assignment
2. Receives notification when locksmith accepts
3. Clicks payment link
4. Pays assessment fee
5. Job proceeds normally

---

## Testing Checklist

- [x] Admin can assign locksmith to job
- [x] Locksmith receives all notifications (SMS, email, push, in-app)
- [x] Admin-assigned jobs appear prominently in dashboard
- [x] Locksmith can accept assignment
- [x] Customer receives payment link when locksmith accepts
- [x] Locksmith can decline assignment
- [x] Admin receives Telegram notification on decline
- [x] Assessment fee pre-populated from locksmith profile
- [x] Applications API filters admin_assigned status
- [x] Dashboard refreshes after accept/decline

---

## Files Modified

### Backend
1. `/src/app/api/locksmith/applications/route.ts` - Added admin_assigned filter
2. `/src/app/api/locksmith/applications/[id]/accept/route.ts` - **NEW**
3. `/src/app/api/locksmith/applications/[id]/decline/route.ts` - **NEW**
4. `/src/lib/email.ts` - Added 2 new email templates
5. `/src/lib/telegram.ts` - Added decline notification
6. `/src/lib/notifications.ts` - Added "job_assigned" and "locksmith_accepted" types

### Frontend
1. `/src/app/locksmith/dashboard/page.tsx` - Added admin-assigned section

### Documentation
1. `/.same/todos.md` - Marked all tasks complete
2. `/.same/ADMIN_ASSIGNMENT_IMPLEMENTATION.md` - **NEW** (this file)

---

## Future Enhancements

### Potential Improvements
1. **Auto-decline timer** - Auto-decline if no response in 15 minutes
2. **Reassignment suggestions** - Suggest alternative locksmiths if declined
3. **Batch assignment** - Assign multiple jobs to one locksmith at once
4. **Assignment history** - Track which admin assigned which jobs
5. **Decline analytics** - Track most common decline reasons
6. **Priority assignments** - Mark certain assignments as urgent
7. **Push back to admin** - Allow locksmith to suggest different fee

### Performance Optimizations
1. Add index on `status` column in LocksmithApplication
2. Cache locksmith availability status
3. Batch notification sending for multiple assignments

---

## Security Considerations

✅ **Authentication:** All endpoints verify locksmith/admin identity
✅ **Authorization:** Locksmiths can only accept/decline their own assignments
✅ **Validation:** Status checks prevent invalid state transitions
✅ **Rate Limiting:** Standard API rate limits apply
✅ **Data Privacy:** Customer info only shown after acceptance

---

## Support & Troubleshooting

### Common Issues

**Issue:** Locksmith doesn't see assigned jobs
**Solution:** Check that `/api/locksmith/applications` is returning admin_assigned applications

**Issue:** Customer doesn't receive payment link
**Solution:** Verify email/SMS services are configured and locksmith accepted (not just pending)

**Issue:** Admin doesn't get decline notification
**Solution:** Check Telegram bot configuration and TELEGRAM_NOTIFICATIONS_ENABLED env var

---

## Conclusion

The admin job assignment feature is now fully implemented with:
- ✅ Complete backend API endpoints
- ✅ Rich notification system (SMS, email, push, Telegram)
- ✅ Prominent UI in locksmith dashboard
- ✅ Accept/decline workflow
- ✅ Customer payment link generation
- ✅ Admin feedback on declines

The system maintains proper job status flow and ensures all parties are notified at each step of the process.
