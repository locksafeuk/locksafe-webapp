import { NextRequest } from "next/server";
import {
  GET as getAvailabilitySchedule,
  POST as saveAvailabilitySchedule,
} from "@/app/api/locksmith/availability/schedule/route";

// Compatibility endpoint expected by external clients:
// GET /api/locksmith/schedule?locksmithId=...
export async function GET(request: NextRequest) {
  return getAvailabilitySchedule(request);
}

// Compatibility endpoint expected by external clients:
// PUT /api/locksmith/schedule
export async function PUT(request: NextRequest) {
  return saveAvailabilitySchedule(request);
}

// Keep POST support for clients already using POST semantics.
export async function POST(request: NextRequest) {
  return saveAvailabilitySchedule(request);
}
