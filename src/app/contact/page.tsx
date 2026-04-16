import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SITE_NAME, getFullUrl } from "@/lib/config";
import { ContactPageContent } from "./ContactPageContent";

export const metadata: Metadata = {
  title: `Contact Us | ${SITE_NAME} - Get in Touch`,
  description:
    "Contact LockSafe UK for support, questions, or feedback. Reach us by phone, email, or our contact form. 24/7 emergency line available.",
  keywords: [
    "contact LockSafe",
    "locksmith support",
    "locksmith UK contact",
    "emergency locksmith phone",
  ],
  openGraph: {
    title: `Contact Us | ${SITE_NAME}`,
    description:
      "Get in touch with LockSafe UK. 24/7 emergency line, email support, and contact form.",
    url: getFullUrl("/contact"),
  },
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <ContactPageContent />
      <Footer />
    </>
  );
}
