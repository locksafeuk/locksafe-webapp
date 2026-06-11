import { redirect } from "next/navigation";

// The Live Ops dashboard moved to /admin/seo/ops. The old /admin/seo/coverage
// route had a stuck build-manifest entry on Vercel (it 404'd while every
// sibling route built fine), so the page was given a fresh path. This stub
// forwards any old bookmarks/links to the new location.
export const dynamic = "force-dynamic";

export default function CoverageMovedRedirect() {
  redirect("/admin/seo/ops");
}
