import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

/**
 * Mongo-safe "this optional field is absent" filter.
 *
 * Prisma + MongoDB treats a MISSING field and a present-but-null field as
 * distinct: `{ field: null }` matches ONLY present-and-null docs and silently
 * excludes docs where the field was never written. For optional fields that
 * aren't always initialised at create time, a bare `{ field: null }` filter
 * under-selects — e.g. SMS lead outreach was skipping 835 of 1561 leads whose
 * `email` was unset (not null). This matches both null AND missing.
 *
 * Returns an `OR` fragment — spread it into a `where` that does not already
 * declare a top-level `OR` (if it does, wrap both under `AND`).
 *
 *   where: { status: "new", phone: { not: null }, ...nullOrUnset("email") }
 */
export function nullOrUnset<F extends string>(
  field: F,
): { OR: [Record<F, null>, Record<F, { isSet: false }>] } {
  return {
    OR: [
      { [field]: null } as Record<F, null>,
      { [field]: { isSet: false } } as Record<F, { isSet: false }>,
    ],
  };
}
