import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/config";
import {
  blogPosts,
  getPostBySlug,
  getRelatedPosts,
  categoryLabels,
} from "@/lib/blog-data";
import {
  ArrowRight,
  Clock,
  Calendar,
  Tag,
  ChevronRight,
  Share2,
  Shield,
  Phone,
} from "lucide-react";
import { BlogPostContent } from "@/components/blog/BlogPostContent";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { BlogFAQ } from "@/components/blog/BlogFAQ";
import { ShareButtons } from "@/components/blog/ShareButtons";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | LockSafe Blog",
    };
  }

  return {
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: post.tags,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      url: `${SITE_URL}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      section: categoryLabels[post.category].label,
      tags: post.tags,
      images: [
        {
          url: post.image,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.metaDescription,
      images: [post.image],
    },
    alternates: {
      canonical: `${SITE_URL}/blog/${post.slug}`,
    },
  };
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

// Article structured data
function generateArticleSchema(post: NonNullable<ReturnType<typeof getPostBySlug>>) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
      jobTitle: post.author.role,
    },
    publisher: {
      "@type": "Organization",
      name: "LockSafe UK",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    articleSection: categoryLabels[post.category].label,
    keywords: post.tags.join(", "),
    wordCount: post.content.split(/\s+/).length,
    timeRequired: `PT${post.readTime}M`,
  };
}

// FAQ structured data for AEO
function generateFAQSchema(post: NonNullable<ReturnType<typeof getPostBySlug>>) {
  if (post.faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// Breadcrumb schema
function generateBreadcrumbSchema(post: NonNullable<ReturnType<typeof getPostBySlug>>) {
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
      {
        "@type": "ListItem",
        position: 3,
        name: categoryLabels[post.category].label,
        item: `${SITE_URL}/blog/category/${post.category}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: post.title,
        item: `${SITE_URL}/blog/${post.slug}`,
      },
    ],
  };
}

// HowTo schema for certain posts (GEO optimization)
function generateHowToSchema(post: NonNullable<ReturnType<typeof getPostBySlug>>) {
  if (!post.slug.includes("how-to") && !post.slug.includes("what-to-do")) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: post.title,
    description: post.excerpt,
    image: post.image,
    totalTime: `PT${post.readTime}M`,
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "GBP",
      value: "0",
    },
    supply: [],
    tool: [],
    step: [
      {
        "@type": "HowToStep",
        name: "Assess the situation",
        text: "Stay calm and check all possible entry points.",
      },
      {
        "@type": "HowToStep",
        name: "Contact a professional",
        text: "Call a verified locksmith service like LockSafe.",
      },
      {
        "@type": "HowToStep",
        name: "Wait for help",
        text: "Stay safe and wait for the locksmith to arrive.",
      },
    ],
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(post);
  const categoryInfo = categoryLabels[post.category];
  const faqSchema = generateFAQSchema(post);
  const howToSchema = generateHowToSchema(post);

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateArticleSchema(post)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(post)) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      {howToSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        />
      )}

      <Header />

      <main>
        {/* Hero Section */}
        <article
          className="relative"
          itemScope
          itemType="https://schema.org/Article"
        >
          {/* Article Header */}
          <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-10 md:py-16 relative overflow-hidden">
            {/* Background Image Overlay */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url(${post.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/60" />

            <div className="section-container relative">
              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                  <li>
                    <Link href="/" className="hover:text-white transition-colors">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true" className="flex items-center">
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  </li>
                  <li>
                    <Link href="/blog" className="hover:text-white transition-colors">
                      Blog
                    </Link>
                  </li>
                  <li aria-hidden="true" className="flex items-center">
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  </li>
                  <li>
                    <Link
                      href={`/blog/category/${post.category}`}
                      className="hover:text-white transition-colors"
                    >
                      {categoryInfo.label}
                    </Link>
                  </li>
                </ol>
              </nav>

              <div className="max-w-4xl">
                {/* Category Tag */}
                <div className="mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}
                    itemProp="articleSection"
                  >
                    {categoryInfo.label}
                  </span>
                </div>

                {/* Title */}
                <h1
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight"
                  itemProp="headline"
                >
                  {post.title}
                </h1>

                {/* Excerpt */}
                <p
                  className="text-lg text-slate-300 mb-6 max-w-3xl"
                  itemProp="description"
                >
                  {post.excerpt}
                </p>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                  {/* Author */}
                  <div
                    className="flex items-center gap-2"
                    itemProp="author"
                    itemScope
                    itemType="https://schema.org/Person"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {post.author.avatar}
                    </div>
                    <div>
                      <div className="font-medium text-white" itemProp="name">
                        {post.author.name}
                      </div>
                      <div className="text-xs" itemProp="jobTitle">
                        {post.author.role}
                      </div>
                    </div>
                  </div>

                  <span className="text-slate-600">•</span>

                  {/* Date */}
                  <time
                    dateTime={post.publishedAt}
                    itemProp="datePublished"
                    className="flex items-center gap-1"
                  >
                    <Calendar className="w-4 h-4" />
                    {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>

                  <span className="text-slate-600">•</span>

                  {/* Read Time */}
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.readTime} min read
                  </span>

                  {/* Updated date */}
                  {post.updatedAt !== post.publishedAt && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs">
                        Updated:{" "}
                        <time dateTime={post.updatedAt} itemProp="dateModified">
                          {new Date(post.updatedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Article Content */}
          <div className="py-8 md:py-12 bg-white">
            <div className="section-container">
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-8">
                  {/* Featured Image */}
                  <figure className="mb-8 -mt-16 md:-mt-24 relative z-10">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-64 md:h-96 object-cover rounded-2xl shadow-xl"
                      itemProp="image"
                    />
                  </figure>

                  {/* Article Body */}
                  <div
                    className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl"
                    itemProp="articleBody"
                  >
                    <BlogPostContent content={post.content} />
                  </div>

                  {/* Tags */}
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-4 h-4 text-slate-400" />
                      {post.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/blog?tag=${encodeURIComponent(tag)}`}
                          className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Share */}
                  <div className="mt-8 p-6 bg-slate-50 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Share2 className="w-5 h-5" />
                      Share this article
                    </h3>
                    <ShareButtons
                      url={`${SITE_URL}/blog/${post.slug}`}
                      title={post.title}
                    />
                  </div>

                  {/* FAQ Section */}
                  {post.faqs.length > 0 && (
                    <section className="mt-12">
                      <h2 className="text-2xl font-bold text-slate-900 mb-6">
                        Frequently Asked Questions
                      </h2>
                      <BlogFAQ faqs={post.faqs} />
                    </section>
                  )}

                  {/* Author Bio */}
                  <div className="mt-12 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                        {post.author.avatar}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{post.author.name}</h3>
                        <p className="text-sm text-orange-600 mb-2">{post.author.role}</p>
                        <p className="text-slate-600 text-sm">
                          With years of experience in the locksmith industry, our experts
                          provide practical advice to help you protect your home and handle
                          lock emergencies safely.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <aside className="lg:col-span-4">
                  <div className="sticky top-24 space-y-6">
                    {/* Table of Contents */}
                    <BlogTableOfContents content={post.content} />

                    {/* CTA Box */}
                    <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
                      <Shield className="w-10 h-10 mb-4 opacity-90" />
                      <h3 className="text-lg font-bold mb-2">Need a Locksmith?</h3>
                      <p className="text-sm text-white/90 mb-4">
                        Get instant quotes from verified locksmiths in your area.
                      </p>
                      <Link href="/request">
                        <Button className="w-full bg-white text-orange-600 hover:bg-orange-50 font-semibold">
                          Get Help Now
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                      <a
                        href="tel:07818333989"
                        className="block text-center mt-3 text-sm text-white/90 hover:text-white"
                      >
                        Or call: 07818 333 989
                      </a>
                    </div>

                    {/* Related Posts */}
                    {relatedPosts.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <h3 className="font-bold text-slate-900 mb-4">Related Articles</h3>
                        <div className="space-y-4">
                          {relatedPosts.slice(0, 3).map((relatedPost) => (
                            <Link
                              key={relatedPost.slug}
                              href={`/blog/${relatedPost.slug}`}
                              className="group flex gap-3"
                            >
                              <img
                                src={relatedPost.image}
                                alt={relatedPost.title}
                                className="w-20 h-16 object-cover rounded-lg flex-shrink-0"
                              />
                              <div>
                                <h4 className="text-sm font-medium text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                                  {relatedPost.title}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1">
                                  {relatedPost.readTime} min read
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Newsletter */}
                    <div className="bg-slate-900 rounded-2xl p-5 text-white">
                      <h3 className="font-bold mb-2">Get Security Tips</h3>
                      <p className="text-sm text-slate-400 mb-4">
                        Monthly security advice straight to your inbox.
                      </p>
                      <form className="space-y-2">
                        <input
                          type="email"
                          placeholder="Enter your email"
                          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                        <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm">
                          Subscribe
                        </Button>
                      </form>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </article>

        {/* More Articles */}
        <section className="py-12 bg-slate-50">
          <div className="section-container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">More Articles</h2>
              <Link
                href="/blog"
                className="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
              >
                View all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {blogPosts
                .filter((p) => p.slug !== post.slug)
                .slice(0, 3)
                .map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all"
                  >
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="p-5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${
                          categoryLabels[p.category].color
                        }`}
                      >
                        {categoryLabels[p.category].label}
                      </span>
                      <h3 className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                        {p.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-2">
                        {p.readTime} min read
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 bg-gradient-to-br from-orange-500 to-amber-500">
          <div className="section-container">
            <div className="max-w-3xl mx-auto text-center text-white">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Need Professional Locksmith Help?
              </h2>
              <p className="text-lg text-white/90 mb-6">
                Connect with verified locksmiths in your area. Transparent pricing, GPS
                tracking, and anti-fraud protection.
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
      </main>

      <Footer />
    </>
  );
}
