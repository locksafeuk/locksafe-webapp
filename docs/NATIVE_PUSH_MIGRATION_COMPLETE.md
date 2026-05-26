# Native Push Migration Complete

Status: Complete
Date: 2026-05-26

## Summary
Native push delivery for locksmith mobile devices is implemented and active in production code paths.

## What Is Implemented
- APNs delivery support in `src/lib/native-push.ts`.
- FCM v1 delivery support in `src/lib/native-push.ts`.
- Schedule-based availability cron sends shift lifecycle push alerts:
  - Shift start: "Your shift has started"
  - Shift end: "Your shift has ended"
- Locksmith token persistence fields in Prisma schema:
  - `nativeDeviceToken`
  - `nativeTokenType`
  - `nativeTokenPlatform`
  - `nativeTokenRegisteredAt`

## Related Runtime Flow
1. Availability schedule cron evaluates UK local time windows.
2. Cron toggles locksmith availability state when needed.
3. Push notification is emitted only when an actual state transition occurs.
4. Running cron repeatedly in the same window is idempotent and does not repeatedly flip state.

## Notes
- UK timezone behavior uses Europe/London semantics.
- This document confirms migration completion for the native push path used by schedule automation.
