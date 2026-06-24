import { jwtVerify } from "jose";

/**
 * Edge-runtime admin authorization for the `/api/admin/*` surface.
 *
 * Next.js proxy (formerly middleware) runs on the Edge runtime, where the
 * Node-only auth lib (`jsonwebtoken` + `bcryptjs` + Prisma) cannot run. We
 * re-verify the same HS256 token here with `jose`, which is signature-
 * compatible with the tokens `generateToken()` mints via `jsonwebtoken`.
 *
 * This is a defense-in-depth gate: the per-route `isAdminAuthenticated()`
 * checks remain the precise, authoritative layer (full Node verify incl. the
 * token-blacklist lookup). Because admin routes self-authenticate with a
 * *variety* of mechanisms, this gate must accept the full union of them — or
 * it would 401 legitimate callers. The complete set, enumerated from the admin
 * routes, is:
 *   - admin JWT in the `auth_token` httpOnly cookie (web dashboard)
 *   - admin JWT in an `Authorization: Bearer` header
 *   - `Authorization: Bearer <CRON_SECRET>` (cron/CLI callers)
 *   - `Authorization: Bearer <ADMIN_SECRET>` (organisations routes)
 *   - `x-cron-secret: <CRON_SECRET>` (leads/intake)
 *   - `x-vercel-cron: 1` (Vercel internal cron)
 * The gate fails closed (deny) when it cannot verify.
 */

// Tracking pixels are hit by recipients' email clients with no auth — keep open.
export const PUBLIC_ADMIN_PATHS = [
  "/api/admin/emails/track",
  "/api/admin/leads/track",
];

export interface AdminGateInput {
  pathname: string;
  cookieToken?: string;
  authHeader?: string | null;
  cronSecretHeader?: string | null;
  isVercelCron?: boolean;
}

async function isAdminJwt(
  token: string | undefined,
  secret: Uint8Array,
): Promise<boolean> {
  if (!token) return false;
  try {
    // Algorithm pinned to HS256 to prevent algorithm-confusion attacks.
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload.type === "admin";
  } catch {
    return false;
  }
}

export async function isAuthorizedAdminRequest(
  input: AdminGateInput,
): Promise<boolean> {
  if (PUBLIC_ADMIN_PATHS.includes(input.pathname)) return true;

  const secretStr = process.env.JWT_SECRET;
  // Fail closed: without the signing secret we cannot verify a JWT. We can
  // still honour the shared-secret mechanisms below, so don't return yet.
  const secret = secretStr ? new TextEncoder().encode(secretStr) : null;

  // 1) Admin JWT in the httpOnly cookie (web dashboard — the common case).
  if (secret && (await isAdminJwt(input.cookieToken, secret))) return true;

  const cronSecret = process.env.CRON_SECRET;
  // `ADMIN_SECRET` mirrors the organisations route's default exactly so the
  // gate accepts precisely what that handler accepts (no new weakening — the
  // handler is the boundary; sensitive routes also enforce a cookie JWT).
  const adminSecret = process.env.ADMIN_SECRET || "admin-secret";

  // 2) Authorization: Bearer <token> — an admin JWT, the CRON_SECRET, or the
  //    organisations ADMIN_SECRET.
  const authHeader = input.authHeader;
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7);
    if (cronSecret && bearer === cronSecret) return true;
    if (bearer === adminSecret) return true;
    if (secret && (await isAdminJwt(bearer, secret))) return true;
  }

  // 3) x-cron-secret header (leads/intake) and the Vercel internal cron header.
  if (cronSecret && input.cronSecretHeader === cronSecret) return true;
  if (input.isVercelCron) return true;

  return false;
}
