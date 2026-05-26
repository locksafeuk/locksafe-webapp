# Native Push Implementation Checklist

Status: Verified
Date: 2026-05-26

## Core Transport
- [x] APNs sending implemented.
- [x] FCM v1 sending implemented.
- [x] Shared push utility module exists (`src/lib/native-push.ts`).

## Data Model
- [x] Locksmith push token fields present in Prisma schema.
- [x] Token type/platform metadata captured.
- [x] Token registration timestamp supported.

## Schedule Automation Integration
- [x] Availability schedule cron exists.
- [x] Cron runs every 15 minutes via Vercel config.
- [x] Cron evaluates UK time windows.
- [x] Cron toggles availability only on transitions (idempotent behavior).
- [x] Shift-start push is sent when cron turns availability ON.
- [x] Shift-end push is sent when cron turns availability OFF.

## Override Behavior
- [x] Manual OFF sets schedule override flag.
- [x] Cron respects override and does not auto-enable while overridden.
- [x] Override clears automatically when shift window ends.

## API Contract Compatibility
- [x] Canonical route exists at `/api/locksmith/availability/schedule` (GET, POST).
- [x] Compatibility route exists at `/api/locksmith/schedule` (GET, PUT, POST).

## Web and Mobile
- [x] Web schedule management UI implemented.
- [x] Mobile schedule management screen implemented.
- [x] Both consume schedule API payload shape with weekly Mon-Sun windows and 30-minute increments.

## Operational Notes
- Keep APNs/FCM credentials current in deployment environment.
- Monitor cron execution and push delivery errors in logs.
