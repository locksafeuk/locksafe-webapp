import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Home, Search, Phone, ArrowLeft, Key, MapPin, HelpCircle } from "lucide-react";
import { postcodeData } from "@/lib/postcode-data";

export default function NotFound() {
  // Get a few popular areas for quick links
  const popularAreas = ["wd17", "wd3", "wd6", "al1", "wd23"].map(
    (code) => postcodeData[code]
  ).filter(Boolean).slice(0, 4);

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-gradient-to-b from-slate-50 to-white">
        <div className="section-container py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            {/* 404 Icon */}
            <div className="relative inline-flex mb-8">
              <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center">
                <Key className="w-16 h-16 text-orange-500" />
              </div>
              <div className="absolute -top-2 -right-2 w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-lg">
                404
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Page Not Found
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Looks like this page has been locked away! Don't worry, we'll help you
              find your way back.
            </p>

            {/* Primary Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-5 rounded-full">
                  <Home className="w-5 h-5 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Link href="/request">
                <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-5 rounded-full">
                  <Search className="w-5 h-5 mr-2" />
                  Find a Locksmith
                </Button>
              </Link>
            </div>

            {/* Need Emergency Help Banner */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white text-left mb-12">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">Need Emergency Locksmith Help?</h2>
                  <p className="text-slate-300 text-sm mb-3">
                    If you're locked out or need urgent assistance, we're here 24/7.
                  </p>
                  <a
                    href="tel:07818333989"
                    className="inline-flex items-center text-orange-400 hover:text-orange-300 font-semibold transition-colors"
                  >
                    Call 07818 333 989
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </a>
                </div>
              </div>
            </div>

            {/* Popular Areas */}
            {popularAreas.length > 0 && (
              <div className="text-left">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  Popular Service Areas
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {popularAreas.map((area) => (
                    <Link
                      key={area.postcode}
                      href={`/emergency-locksmith-${area.slug}`}
                      className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-orange-50 rounded-xl border border-slate-200 hover:border-orange-200 transition-colors"
                    >
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-sm font-bold text-orange-500">{area.postcode}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{area.area}</p>
                        <p className="text-xs text-slate-500">{area.county}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="mt-12 pt-8 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center justify-center gap-2">
                <HelpCircle className="w-5 h-5 text-orange-500" />
                Helpful Links
              </h3>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link href="/request" className="text-orange-600 hover:text-orange-700 hover:underline">
                  Request a Locksmith
                </Link>
                <span className="text-slate-300">•</span>
                <Link href="/locksmith-signup" className="text-orange-600 hover:text-orange-700 hover:underline">
                  Join as Locksmith
                </Link>
                <span className="text-slate-300">•</span>
                <Link href="/blog" className="text-orange-600 hover:text-orange-700 hover:underline">
                  Security Blog
                </Link>
                <span className="text-slate-300">•</span>
                <Link href="/help" className="text-orange-600 hover:text-orange-700 hover:underline">
                  Help Center
                </Link>
                <span className="text-slate-300">•</span>
                <Link href="/about" className="text-orange-600 hover:text-orange-700 hover:underline">
                  About Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
