import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import { serperPlaces, buildPlacesQuery, hasSerper } from "@/lib/serper-places";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSerper()) return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  if (!b.keyword?.trim()) return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  const query = buildPlacesQuery(b);
  // One page tells us roughly how dense the area is; Serper returns ~10-20/page.
  const first = await serperPlaces(query, { gl: b.country || "uk" });
  const perPage = first.length;
  // Heuristic estimate: a full result is usually a few pages deep.
  const estimate = perPage >= 18 ? `${perPage * 3}+` : perPage >= 8 ? `~${perPage * 2}` : `${perPage}`;
  return NextResponse.json({ query, firstPageCount: perPage, estimate, sample: first.slice(0, 3).map((p) => p.title) });
}
