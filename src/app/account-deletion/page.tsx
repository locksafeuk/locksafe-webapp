import Link from "next/link";
import { Metadata } from "next";
import { Trash2, Smartphone, Mail, AlertTriangle, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Account Deletion | LockSafe",
  description:
    "How to delete your LockSafe account and all associated data.",
  robots: { index: true, follow: true },
};

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to LockSafe
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Account Deletion</h1>
        </div>
        <p className="text-slate-500 mb-10 text-sm">
          Last updated: June 2026 · LockSafe UK
        </p>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Account deletion is <strong>permanent and irreversible</strong>. All
            your data — profile, job history, earnings records, and uploaded
            documents — will be permanently removed from our systems.
          </p>
        </div>

        {/* Method 1 — in-app */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-5 h-5 text-slate-700" />
            <h2 className="font-semibold text-slate-900">
              Option 1 — Delete from the app (recommended)
            </h2>
          </div>
          <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>Open the <strong>LockSafe – Locksmith Partner</strong> app</li>
            <li>
              Tap <strong>Settings</strong> (bottom navigation bar, cog icon)
            </li>
            <li>
              Scroll down to <strong>Account</strong> and tap{" "}
              <span className="text-red-600 font-medium">Delete Account</span>
            </li>
            <li>
              Type <code className="bg-slate-100 px-1 rounded font-mono text-xs">DELETE</code> to
              confirm, then tap <strong>Delete My Account</strong>
            </li>
          </ol>
          <p className="text-xs text-slate-400 mt-3">
            Your account and all associated data are deleted immediately and
            cannot be recovered.
          </p>
        </section>

        {/* Method 2 — email */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-slate-700" />
            <h2 className="font-semibold text-slate-900">
              Option 2 — Request by email
            </h2>
          </div>
          <p className="text-sm text-slate-600 mb-3">
            If you no longer have access to the app, email us and we will delete
            your account within <strong>30 days</strong>.
          </p>
          <a
            href="mailto:contact@locksafe.uk?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20LockSafe%20account.%0A%0AEmail%20address%20on%20account%3A%20"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email contact@locksafe.uk
          </a>
          <p className="text-xs text-slate-400 mt-3">
            Please send from the email address associated with your account so we
            can verify your identity.
          </p>
        </section>

        {/* What gets deleted */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">
            What data is deleted
          </h2>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {[
              "Account credentials and profile information",
              "Contact details (name, phone, email)",
              "Location and coverage area data",
              "Job history and earnings records",
              "Uploaded documents (insurance, DBS certificates)",
              "Notification tokens and device identifiers",
              "Stripe Connect payment account link",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">✕</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-4">
            We may retain minimal anonymised audit records (e.g. transaction
            references) as required by applicable law or for fraud-prevention
            purposes. These records cannot be linked back to you.
          </p>
        </section>

        {/* Footer links */}
        <div className="flex gap-4 text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-slate-600 transition-colors">
            Terms of Service
          </Link>
          <a
            href="mailto:contact@locksafe.uk"
            className="hover:text-slate-600 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </div>
    </main>
  );
}
