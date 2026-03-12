import { getServiceClient } from "@/lib/supabase/client";
import { blogPosts as staticPosts } from "@/lib/blog-posts";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  author: string;
  read_time: string;
  featured: boolean;
  published: boolean;
  published_at: string | null;
  updated_at: string;
  keywords: string[];
  canonical_url: string | null;
  og_image: string | null;
  structured_data: Record<string, unknown> | null;
  view_count: number;
  cta_type: string;
  cta_coins: string[];
  created_at: string;
}

export type BlogPostInsert = Omit<BlogPost, "id" | "created_at" | "updated_at" | "view_count">;

const COLUMNS =
  "id, slug, title, description, content, category, author, read_time, featured, published, published_at, updated_at, keywords, canonical_url, og_image, structured_data, view_count, cta_type, cta_coins, created_at";

function staticToDbPost(
  sp: (typeof staticPosts)[0],
): BlogPost {
  return {
    id: sp.slug,
    slug: sp.slug,
    title: sp.title,
    description: sp.description,
    content: "",
    category: sp.category,
    author: sp.author,
    read_time: sp.readTime,
    featured: sp.featured,
    published: true,
    published_at: sp.publishedAt,
    updated_at: sp.publishedAt,
    keywords: sp.keywords,
    canonical_url: null,
    og_image: null,
    structured_data: null,
    view_count: 0,
    cta_type: "swap",
    cta_coins: [],
    created_at: sp.publishedAt,
  };
}

const fallbackPosts = staticPosts.map(staticToDbPost);

export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("blog_posts")
      .select(COLUMNS)
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch {
    // Supabase unavailable or table not in schema cache yet
  }
  return fallbackPosts;
}

export async function getFeaturedPosts(): Promise<BlogPost[]> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("blog_posts")
      .select(COLUMNS)
      .eq("published", true)
      .eq("featured", true)
      .order("published_at", { ascending: false })
      .limit(6);
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch {
    // fallback
  }
  return fallbackPosts.filter((p) => p.featured);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("blog_posts")
      .select(COLUMNS)
      .eq("slug", slug)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    if (data) return data;
  } catch {
    // fallback
  }
  return fallbackPosts.find((p) => p.slug === slug) ?? null;
}

export async function getAllPosts(): Promise<BlogPost[]> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("blog_posts")
      .select(COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch {
    // fallback
  }
  return fallbackPosts;
}

export async function getAllSlugs(): Promise<string[]> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("blog_posts")
      .select("slug")
      .eq("published", true);
    if (error) throw error;
    if (data && data.length > 0) return data.map((r) => r.slug);
  } catch {
    // fallback
  }
  return fallbackPosts.map((p) => p.slug);
}

export async function createPost(
  post: Partial<BlogPostInsert>,
): Promise<BlogPost> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("blog_posts")
    .insert(post)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(
  id: string,
  updates: Partial<BlogPost>,
): Promise<BlogPost> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("blog_posts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function incrementViewCount(id: string): Promise<void> {
  try {
    const sb = getServiceClient();
    const { error } = await sb.rpc("increment_blog_view_count", {
      post_id: id,
    });
    if (error) {
      await sb
        .from("blog_posts")
        .update({ view_count: 0 })
        .eq("id", id);
    }
  } catch {
    // silently fail view counting
  }
}

export function getArticleJsonLd(post: BlogPost, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Coincess",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/icon-512.png`,
      },
    },
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${post.slug}`,
    },
    keywords: post.keywords.join(", "),
    ...(post.og_image ? { image: post.og_image } : {}),
  };
}
