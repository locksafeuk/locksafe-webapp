"use client";

import Link from "next/link";
import { Facebook, Instagram, Linkedin, Twitter, Mail, Phone, MapPin } from "lucide-react";

const footerLinks = {
  company: [
    { label: "About Us", href: "/about" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Services", href: "/services" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
  ],
  resources: [
    { label: "Security Checklist", href: "/security-checklist" },
    { label: "Blog", href: "/blog" },
    { label: "Help Centre", href: "/help" },
    { label: "For Locksmiths", href: "/for-locksmiths" },
    { label: "Locksmith Sign Up", href: "/locksmith-signup" },
  ],
  legal: [
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Cooling-Off Rights", href: "/cooling-off" },
    { label: "Vulnerable Customers", href: "/vulnerable-customers" },
    { label: "Accessibility", href: "/accessibility" },
  ],
};

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com/locksafeuk", label: "Facebook" },
  { icon: Instagram, href: "https://instagram.com/locksafeuk", label: "Instagram" },
  { icon: Twitter, href: "https://twitter.com/locksafeuk", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com/company/locksafeuk", label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="section-container py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-6 h-6 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-2xl font-bold">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>
            <p className="text-slate-400 mb-6 max-w-sm">
              The UK's most transparent locksmith platform. Complete anti-fraud
              protection with GPS tracking, digital documentation, and verified
              professionals.
            </p>

            {/* Contact info */}
            <div className="space-y-3">
              <a
                href="tel:07818333989"
                className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
              >
                <Phone className="w-5 h-5 text-orange-500" />
                07818 333 989
              </a>
              <a
                href="mailto:contact@locksafe.uk"
                className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
              >
                <Mail className="w-5 h-5 text-orange-500" />
                contact@locksafe.uk
              </a>
              <div className="flex items-center gap-3 text-slate-300">
                <MapPin className="w-5 h-5 text-orange-500" />
                Nationwide UK Coverage
              </div>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-slate-800 hover:bg-orange-500 rounded-full flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links columns */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="section-container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
            <p>&copy; 2026 LockSafe UK. All rights reserved.</p>
            <p>
              Emergency locksmith services with complete fraud protection.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
