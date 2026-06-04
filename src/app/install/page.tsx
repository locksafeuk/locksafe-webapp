import { redirect } from "next/navigation";

export default function InstallPage() {
  redirect("/locksmith/dashboard?install=1");
}
