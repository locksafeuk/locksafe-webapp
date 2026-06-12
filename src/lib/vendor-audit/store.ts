/**
 * Async writer for VendorEvent rows. Fire-and-forget: errors logged
 * but never thrown back to the caller. We'd rather lose an audit row
 * than break a payment or an ad upload.
 */

import prisma from "@/lib/db";
import type { VendorEventCapture } from "./types";

const MAX_SAMPLE_BYTES = 8 * 1024; // 8 KB cap on stored request/response samples

function truncate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.length > MAX_SAMPLE_BYTES ? s.slice(0, MAX_SAMPLE_BYTES) + "…[truncated]" : s;
}

export function recordVendorEvent(evt: VendorEventCapture): void {
  // Hop off the request cycle so even a slow Mongo write never blocks
  // the caller. setImmediate is safer than queueMicrotask here because
  // microtasks still run before the response flushes.
  setImmediate(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = prisma as any;
      await p.vendorEvent.create({
        data: {
          vendor:    evt.vendor,
          direction: evt.direction,
          endpoint:  evt.endpoint.slice(0, 500),
          method:    evt.method,
          status:    evt.status ?? null,
          requestBytes:  evt.requestBytes  ?? null,
          responseBytes: evt.responseBytes ?? null,
          latencyMs:     evt.latencyMs     ?? null,
          fieldsShared:        evt.fieldsShared        ?? null,
          fieldsReceived:      evt.fieldsReceived      ?? null,
          identifiersShared:   evt.identifiersShared   ?? null,
          identifiersReceived: evt.identifiersReceived ?? null,
          requestSample:  truncate(evt.requestSample)  ?? null,
          responseSample: truncate(evt.responseSample) ?? null,
          callerRoute: evt.callerRoute ?? null,
          jobId:       evt.jobId       ?? null,
          customerId:  evt.customerId  ?? null,
          errorMessage: evt.errorMessage ?? null,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[vendor-audit] failed to persist event:",
        evt.vendor, evt.endpoint, err instanceof Error ? err.message : err,
      );
    }
  });
}
