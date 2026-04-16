# Welcome Email Test Plan

## Test Overview
This document outlines the test plan for verifying that locksmith welcome emails are now being sent correctly.

## Test Cases

### 1. New Locksmith Registration Test
**Objective**: Verify that new locksmiths receive a welcome email upon registration

**Steps**:
1. Navigate to `/locksmith-signup` or `/for-locksmiths`
2. Fill out the registration form with valid data
3. Submit the form
4. Check the email inbox for the registered email address

**Expected Result**:
- Registration succeeds
- Welcome email is received within 1-2 minutes
- Email contains:
  - Welcome message with locksmith name
  - Getting started checklist
  - How LockSafe works
  - Commission structure
  - Links to dashboard and settings

**Status**: Ready to test

---

### 2. Bulk Welcome Email Test (All Locksmiths)
**Objective**: Send welcome emails to all existing locksmiths on the platform

**Steps**:
1. Log in to the admin panel at `/admin/login`
2. Navigate to `/admin/locksmiths`
3. Locate the "Send Welcome Emails" button in the filters section
4. Click the button
5. Confirm the action in the confirmation dialog
6. Wait for the success message

**Expected Result**:
- Success message shows:
  - Total number of locksmiths
  - Number of emails sent successfully
  - Number of failed emails (if any)
  - List of failed email addresses (if any)
- All active locksmiths receive the welcome email

**Status**: Ready to execute

---

### 3. API Endpoint Test
**Objective**: Test the API endpoint directly

**Steps**:
1. Use a tool like Postman or curl
2. Send POST request to `/api/admin/locksmiths/send-welcome-emails`
3. Include admin authentication token in headers

**cURL Example**:
```bash
curl -X POST https://your-domain.com/api/admin/locksmiths/send-welcome-emails \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Sent welcome emails to N locksmiths",
  "totalLocksmiths": N,
  "totalSent": N,
  "failed": 0,
  "failedEmails": []
}
```

**Status**: Ready to test

---

## Monitoring & Debugging

### Server Logs
Check the application logs for:
- ✅ Success: `Successfully sent N welcome emails to locksmiths`
- ❌ Errors: `Failed to send welcome email: [error details]`

### Email Service Logs (Resend)
1. Log in to Resend dashboard
2. Check the "Emails" section
3. Verify emails were sent to locksmith addresses
4. Check delivery status

### Database Verification
Query to count locksmiths:
```sql
SELECT COUNT(*) FROM "Locksmith";
```

Query to get locksmith emails:
```sql
SELECT id, email, name, "companyName", "createdAt"
FROM "Locksmith"
ORDER BY "createdAt" DESC;
```

---

## Pre-Test Checklist

- [ ] Environment variables are set:
  - `RESEND_API_KEY` is configured
  - `NEXT_PUBLIC_SITE_URL` is correct
- [ ] Admin account has valid authentication
- [ ] Application is running and accessible
- [ ] Email service (Resend) is operational
- [ ] Test email account is ready to receive emails

---

## Post-Test Verification

- [ ] Check server logs for any errors
- [ ] Verify email delivery in Resend dashboard
- [ ] Confirm email content is correct
- [ ] Verify all links in email work correctly
- [ ] Check spam folder if emails not received
- [ ] Confirm no duplicate emails were sent

---

## Rollback Plan

If issues occur:
1. The fix is non-breaking (emails are sent asynchronously)
2. Failed registrations will still complete successfully
3. To disable, remove or comment out the welcome email call
4. No database changes were made that need rollback

---

## Success Criteria

✅ New locksmith registrations trigger welcome emails
✅ Bulk send feature works for all existing locksmiths
✅ Email content renders correctly
✅ All links in emails are functional
✅ No registration failures due to email sending
✅ Proper error logging for debugging
