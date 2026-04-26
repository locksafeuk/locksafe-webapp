import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/config";
import {
  blogPosts,
  getPostsByCategory,
  categoryLabels,
  getAllCategories,
  type BlogCategory,
} from "@/lib/blog-data";
import {
  ArrowRight,
  Clock,
  Calendar,
  ChevronRight,
  BookOpen,
  Shield,
  Phone,
} from "lucide-react";
import { BlogCategoryFilter } from "@/components/blog/BlogCategoryFilter";

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const categoryKey = category as BlogCategory;
  const categoryInfo = categoryLabels[categoryKey];

  if (!categoryInfo) {
    return {
      title: "Category Not Found | LockSafe Blog",
    };
  }

  return {
    title: `${categoryInfo.label} Articles | Locksmith Blog UK | LockSafe`,
    description: `${categoryInfo.description}. Expert articles and guides from professional locksmiths in the UK.`,
    openGraph: {
      title: `${categoryInfo.label} - Locksmith Blog UK`,
      description: categoryInfo.description,
      url: `${SITE_URL}/blog/category/${category}`,
      type: "website",
    },
    alternates: {
      canonical: `${SITE_URL}/blog/category/${category}`,
    },
  };
}

export async function generateStaticParams() {
  return getAllCategories().map((category) => ({
    category,
  }));
}

// Breadcrumb schema
function generateBreadcrumbSchema(categoryKey: BlogCategory) {
  const categoryInfo = categoryLabels[categoryKey];
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
        name: categoryInfo.label,
        item: `${SITE_URL}/blog/category/${categoryKey}`,
      },
    ],
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;
  const categoryKey = category as BlogCategory;
  const categoryInfo = categoryLabels[categoryKey];

  if (!categoryInfo) {
    notFound();
  }

  const posts = getPostsByCategory(categoryKey);
  const categories = getAllCategories();

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(categoryKey)) }}
      />

      <Header />

      <main>
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 md:py-16">
          <div className="section-container">
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
                  <Link href="/blog" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="w-4 h-4" />
                </li>
                <li>
                  <span className="text-orange-400">{categoryInfo.label}</span>
                </li>
              </ol>
            </nav>

            <div className="max-w-3xl">
              <div
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${categoryInfo.color}`}
              >
                {posts.length} Articles
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                {categoryInfo.label}
              </h1>

              <p className="text-lg text-slate-300 max-w-2xl">
                {categoryInfo.description}. Expert articles and guides from professional
                locksmiths to help you make informed decisions.
              </p>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="border-b bg-white sticky top-[64px] md:top-[80px] z-30">
          <div className="section-container py-4">
            <Suspense fallback={<div className="h-10 bg-slate-100 rounded-full animate-pulse" />}>
              <BlogCategoryFilter categories={categories} activeCategory={categoryKey} />
            </Suspense>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="py-10 md:py-16 bg-slate-50">
          <div className="section-container">
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  No articles yet
                </h2>
                <p className="text-slate-600 mb-6">
                  We're working on new content for this category.
                </p>
                <Link href="/blog">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    View All Articles
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post, idx) => (
                  <article
                    key={post.slug}
                    className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all"
                  >
                    <Link href={`/blog/${post.slug}`} className="block relative h-48 overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading={idx < 3 ? "eager" : "lazy"}
                        fetchPriority={idx === 0 ? "high" : "auto"}
                        decoding="async"
                      />
                      {post.featured && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-medium">
                            Featured
                          </span>
                        </div>
                      )}
                    </Link>

                    <div className="p-5">
                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                        <time dateTime={post.publishedAt} className="flex items-center gap-1">
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
                        <h2 className="font-bold text-lg text-slate-900 group-hover:text-orange-600 transition-colors mb-2 line-clamp-2">
                          {post.title}
                        </h2>
                      </Link>

                      <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {post.author.avatar}
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {post.author.name}
                          </span>
                        </div>

                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-orange-600 hover:text-orange-700 font-medium text-sm flex items-center gap-1"
                        >
                          Read
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-gradient-to-br from-orange-500 to-amber-500">
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
      </main>

      <Footer />
    </>
  );
}
