import { redirect } from "next/navigation";

export default function InstallPage() {
  const postLoginRedirect = encodeURIComponent("/locksmith/dashboard?install=1");
  redirect(`/locksmith/login?install=1&redirect=${postLoginRedirect}`);
}
