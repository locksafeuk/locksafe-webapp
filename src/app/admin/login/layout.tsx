import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login | LockSafe UK",
  description: "LockSafe UK Admin Portal Login",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
