import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // For dynamic locksmith profiles, we'll use generic metadata
  // The actual name would require fetching from API
  return {
    title: `Verified Locksmith Profile | ${SITE_NAME}`,
    description: `View verified locksmith profile on ${SITE_NAME}. See reviews, ratings, services offered, and coverage areas.`,
    openGraph: {
      title: `Verified Locksmith Profile | ${SITE_NAME}`,
      description: `View verified locksmith profile on ${SITE_NAME}. See reviews, ratings, and coverage areas.`,
      url: `${SITE_URL}/locksmith/${id}`,
      siteName: SITE_NAME,
      locale: "en_GB",
      type: "profile",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function LocksmithProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
