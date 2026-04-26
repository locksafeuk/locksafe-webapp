import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SITE_URL } from "@/lib/config";
import {
  blogPosts,
  categoryLabels,
  getFeaturedPosts,
  getAllCategories,
  type BlogPost,
  type BlogCategory,
} from "@/lib/blog-data";
import {
  ArrowRight,
  Clock,
  Calendar,
  Tag,
  Search,
  ChevronRight,
  BookOpen,
  Shield,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogSearch } from "@/components/blog/BlogSearch";
import { BlogCategoryFilter } from "@/components/blog/BlogCategoryFilter";

export const metadata: Metadata = {
  title: "Locksmith Blog UK | Security Tips, Guides & Expert Advice | LockSafe",
  description:
    "Expert locksmith advice, home security guides, and tips from UK professionals. Learn about lock types, security upgrades, emergency lockouts, and how to protect your property.",
  keywords: [
    "locksmith blog",
    "home security tips",
    "lock guides UK",
    "emergency locksmith advice",
    "door security",
    "anti-snap locks",
    "smart locks",
    "burglary prevention",
  ],
  openGraph: {
    title: "Locksmith Blog UK | Security Tips & Expert Guides",
    description:
      "Expert locksmith advice and home security guides from UK professionals. Protect your property with our in-depth articles.",
    url: `${SITE_URL}/blog`,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-blog.jpg`,
        width: 1200,
        height: 630,
        alt: "LockSafe UK Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Locksmith Blog UK | Security Tips & Expert Guides",
    description:
      "Expert locksmith advice and home security guides from UK professionals.",
  },
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
};

// Structured data for blog listing
function generateBlogListingSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "LockSafe UK Blog",
    description:
      "Expert locksmith advice, home security guides, and tips from UK professionals",
    url: `${SITE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "LockSafe UK",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    blogPost: blogPosts.slice(0, 10).map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: {
        "@type": "Person",
        name: post.author.name,
      },
      image: post.image,
    })),
  };
}

// Breadcrumb schema
function generateBreadcrumbSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${SITE_URL}/blog`,
      },
    ],
  };
}

// FAQ Schema for AEO
function generateFAQSchema() {
  const topFaqs = blogPosts
    .flatMap((post) => post.faqs)
    .slice(0, 10);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: topFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const categoryInfo = categoryLabels[post.category];

  return (
    <article
      className={`group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all duration-300 ${
        featured ? "md:col-span-2 md:grid md:grid-cols-2" : ""
      }`}
      itemScope
      itemType="https://schema.org/BlogPosting"
    >
      {/* Image */}
      <Link
        href={`/blog/${post.slug}`}
        className={`block relative overflow-hidden ${featured ? "h-64 md:h-full" : "h-48"}`}
      >
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          itemProp="image"
          loading={featured ? "eager" : "lazy"}
          fetchPriority={featured ? "high" : "auto"}
          decoding="async"
        />
        <div className="absolute top-3 left-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}
            itemProp="articleSection"
          >
            {categoryInfo.label}
          </span>
        </div>
        {featured && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-medium">
              Featured
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className={`p-5 ${featured ? "md:p-6 flex flex-col justify-center" : ""}`}>
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          <time dateTime={post.publishedAt} itemProp="datePublished" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(post.publishedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </time>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {post.readTime} min read
          </span>
        </div>

        <Link href={`/blog/${post.slug}`}>
          <h2
            className={`font-bold text-slate-900 group-hover:text-orange-600 transition-colors mb-2 line-clamp-2 ${
              featured ? "text-xl md:text-2xl" : "text-lg"
            }`}
            itemProp="headline"
          >
            {post.title}
          </h2>
        </Link>

        <p
          className={`text-slate-600 mb-4 line-clamp-2 ${featured ? "md:line-clamp-3" : ""}`}
          itemProp="description"
        >
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2" itemProp="author" itemScope itemType="https://schema.org/Person">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {post.author.avatar}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900" itemProp="name">
                {post.author.name}
              </div>
              <div className="text-xs text-slate-500">{post.author.role}</div>
            </div>
          </div>

          <Link
            href={`/blog/${post.slug}`}
            className="text-orange-600 hover:text-orange-700 font-medium text-sm flex items-center gap-1 group/link"
          >
            Read more
            <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function BlogPage() {
  const featuredPosts = getFeaturedPosts();
  const categories = getAllCategories();
  const recentPosts = blogPosts.slice(0, 9);

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBlogListingSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema()) }}
      />

      <Header />

      <main itemScope itemType="https://schema.org/Blog">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 md:py-20 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="section-container relative">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-2 text-sm text-slate-400">
                <li>
                  <Link href="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="w-4 h-4" />
                </li>
                <li>
                  <span className="text-orange-400">Blog</span>
                </li>
              </ol>
            </nav>

            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2 text-sm text-orange-300 mb-6">
                <BookOpen className="w-4 h-4" />
                Expert Security Advice
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4" itemProp="name">
                Locksmith & Security
                <br />
                <span className="text-orange-500">Expert Blog</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl" itemProp="description">
                In-depth guides, expert advice, and practical tips from professional
                locksmiths. Learn how to protect your home, choose the right locks, and
                handle emergencies.
              </p>

              {/* Search */}
              <BlogSearch />
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="border-b bg-white sticky top-[64px] md:top-[80px] z-30">
          <div className="section-container py-4">
            <Suspense fallback={<div className="h-10 bg-slate-100 rounded-full animate-pulse" />}>
              <BlogCategoryFilter categories={categories} />
            </Suspense>
          </div>
        </section>

        {/* Featured Posts */}
        <section className="py-10 md:py-16 bg-slate-50">
          <div className="section-container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Featured Articles
              </h2>
              <Link
                href="#all-posts"
                className="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
              >
                View all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredPosts.slice(0, 3).map((post, index) => (
                <BlogCard key={post.slug} post={post} featured={index === 0} />
              ))}
            </div>
          </div>
        </section>

        {/* All Posts */}
        <section id="all-posts" className="py-10 md:py-16 bg-white">
          <div className="section-container">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
              Latest Articles
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>

            {/* Load More */}
            {blogPosts.length > 9 && (
              <div className="text-center mt-10">
                <Button variant="outline" className="px-8 py-3">
                  Load More Articles
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-10 md:py-16 bg-slate-50">
          <div className="section-container">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8 text-center">
              Browse by Category
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categoryLabels).map(([key, value]) => {
                const count = blogPosts.filter((p) => p.category === key).length;
                return (
                  <Link
                    key={key}
                    href={`/blog/category/${key}`}
                    className="bg-white rounded-xl p-5 border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                          {value.label}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{value.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{count} articles</span>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Popular Questions Section (AEO Optimization) */}
        <section className="py-10 md:py-16 bg-white">
          <div className="section-container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 text-center">
                Frequently Asked Questions
              </h2>
              <p className="text-slate-600 text-center mb-8">
                Quick answers to common locksmith and security questions
              </p>

              <div className="space-y-4">
                {blogPosts
                  .flatMap((post) =>
                    post.faqs.slice(0, 1).map((faq) => ({
                      ...faq,
                      postSlug: post.slug,
                      postTitle: post.title,
                    }))
                  )
                  .slice(0, 6)
                  .map((faq, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 rounded-xl p-5 hover:bg-slate-100 transition-colors"
                      itemScope
                      itemProp="mainEntity"
                      itemType="https://schema.org/Question"
                    >
                      <h3 className="font-semibold text-slate-900 mb-2" itemProp="name">
                        {faq.question}
                      </h3>
                      <div
                        itemScope
                        itemProp="acceptedAnswer"
                        itemType="https://schema.org/Answer"
                      >
                        <p className="text-slate-600 text-sm mb-3" itemProp="text">
                          {faq.answer}
                        </p>
                      </div>
                      <Link
                        href={`/blog/${faq.postSlug}`}
                        className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center gap-1"
                      >
                        Read full article
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
              </div>

              <div className="text-center mt-8">
                <Link href="/help">
                  <Button variant="outline" className="px-6">
                    View All FAQs
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16 bg-gradient-to-br from-orange-500 to-amber-500">
          <div className="section-container">
            <div className="max-w-3xl mx-auto text-center text-white">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-90" />
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Need a Locksmith Right Now?
              </h2>
              <p className="text-lg text-white/90 mb-6">
                Get instant quotes from verified locksmiths in your area.
                24/7 emergency service with transparent pricing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/request">
                  <Button className="bg-white text-orange-600 hover:bg-slate-100 font-semibold px-8 py-3 rounded-full">
                    Get Emergency Help
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a href="tel:07818333989">
                  <Button className="bg-white/20 text-white hover:bg-white/30 font-semibold px-8 py-3 rounded-full border border-white/30">
                    <Phone className="w-5 h-5 mr-2" />
                    07818 333 989
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Signup */}
        <section className="py-10 md:py-16 bg-slate-900 text-white">
          <div className="section-container">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Get Security Tips in Your Inbox
              </h2>
              <p className="text-slate-400 mb-6">
                Join thousands of UK homeowners receiving our monthly security newsletter.
                Expert advice, new product reviews, and exclusive guides.
              </p>
              <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium">
                  Subscribe
                </Button>
              </form>
              <p className="text-xs text-slate-500 mt-3">
                No spam, unsubscribe anytime. Read our{" "}
                <Link href="/privacy" className="underline hover:text-slate-300">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
