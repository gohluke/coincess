"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Save,
  X,
  Loader2,
  ShieldAlert,
  FileText,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { BRAND_CONFIG } from "@/lib/brand.config";

interface BlogPost {
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
  keywords: string[];
  cta_type: string;
  cta_coins: string[];
  view_count: number;
  created_at: string;
}

const CATEGORIES = [
  "Intelligence",
  "Tutorial",
  "Guide",
  "Security",
  "Privacy",
  "Beginner",
];

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-500/20 text-blue-400",
  Security: "bg-red-500/20 text-red-400",
  Guide: "bg-green-500/20 text-green-400",
  Privacy: "bg-rose-500/20 text-rose-400",
  Beginner: "bg-orange-500/20 text-orange-400",
  Intelligence: "bg-amber-500/20 text-amber-400",
};

export default function AdminBlogPage() {
  const { address } = useEffectiveAddress();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin =
    address && BRAND_CONFIG.admin.addresses.includes(address.toLowerCase());

  const fetchPosts = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog?address=${address}`);
      if (res.ok) setPosts(await res.json());
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isAdmin) fetchPosts();
  }, [isAdmin, fetchPosts]);

  const handleSave = async () => {
    if (!editing || !address) return;
    setSaving(true);
    try {
      const method = isNew ? "POST" : "PUT";
      const body = { ...editing, address };
      const res = await fetch("/api/admin/blog", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditing(null);
        setIsNew(false);
        fetchPosts();
      }
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!address || !confirm("Delete this post?")) return;
    await fetch(`/api/admin/blog?address=${address}&id=${id}`, {
      method: "DELETE",
    });
    fetchPosts();
  };

  const handleToggle = async (
    post: BlogPost,
    field: "published" | "featured",
  ) => {
    if (!address) return;
    await fetch("/api/admin/blog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        id: post.id,
        [field]: !post[field],
        ...(field === "published" && !post.published
          ? { published_at: new Date().toISOString() }
          : {}),
      }),
    });
    fetchPosts();
  };

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: "",
      slug: "",
      title: "",
      description: "",
      content: "",
      category: "Intelligence",
      author: "Coincess Intelligence",
      read_time: "5 min",
      featured: false,
      published: false,
      published_at: null,
      keywords: [],
      cta_type: "swap",
      cta_coins: [],
      view_count: 0,
      created_at: "",
    });
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-[#848e9c]" />
        <p className="text-[#848e9c] text-sm">
          Connect wallet to access Blog CMS.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-[#f6465d]" />
        <p className="text-[#f6465d] text-sm font-semibold">Access Denied</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {isNew ? "New Article" : "Edit Article"}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#141620] text-[#848e9c] text-xs hover:text-white transition-colors flex items-center gap-1.5"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editing.slug || !editing.title}
              className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {isNew ? "Create" : "Save"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Title"
            value={editing.title}
            onChange={(v) => setEditing({ ...editing, title: v })}
          />
          <Field
            label="Slug"
            value={editing.slug}
            onChange={(v) =>
              setEditing({
                ...editing,
                slug: v
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
              })
            }
            placeholder="auto-generated-from-title"
          />
          <Field
            label="Author"
            value={editing.author}
            onChange={(v) => setEditing({ ...editing, author: v })}
          />
          <Field
            label="Read Time"
            value={editing.read_time}
            onChange={(v) => setEditing({ ...editing, read_time: v })}
          />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#848e9c] mb-1 block">
              Category
            </label>
            <select
              value={editing.category}
              onChange={(e) =>
                setEditing({ ...editing, category: e.target.value })
              }
              className="w-full bg-[#141620] text-white text-sm rounded-lg border border-[#2a2e3e] px-3 py-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#848e9c] mb-1 block">
              CTA Type
            </label>
            <select
              value={editing.cta_type}
              onChange={(e) =>
                setEditing({ ...editing, cta_type: e.target.value })
              }
              className="w-full bg-[#141620] text-white text-sm rounded-lg border border-[#2a2e3e] px-3 py-2"
            >
              <option value="swap">Swap Guide</option>
              <option value="trade">Trade</option>
            </select>
          </div>
        </div>

        {editing.cta_type === "trade" && (
          <Field
            label="CTA Coins (comma-separated)"
            value={editing.cta_coins.join(", ")}
            onChange={(v) =>
              setEditing({
                ...editing,
                cta_coins: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="CL, BRENTOIL"
          />
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#848e9c] mb-1 block">
            Description (SEO meta, ~155 chars)
          </label>
          <textarea
            value={editing.description}
            onChange={(e) =>
              setEditing({ ...editing, description: e.target.value })
            }
            rows={2}
            className="w-full bg-[#141620] text-white text-sm rounded-lg border border-[#2a2e3e] px-3 py-2 resize-none"
          />
          <span className="text-[10px] text-[#555a66]">
            {editing.description.length}/155
          </span>
        </div>

        <Field
          label="Keywords (comma-separated)"
          value={editing.keywords.join(", ")}
          onChange={(v) =>
            setEditing({
              ...editing,
              keywords: v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="oil prices, crude oil trading, Iran war"
        />

        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#848e9c] mb-1 block">
            Content (HTML)
          </label>
          <textarea
            value={editing.content}
            onChange={(e) =>
              setEditing({ ...editing, content: e.target.value })
            }
            rows={20}
            className="w-full bg-[#141620] text-white text-xs font-mono rounded-lg border border-[#2a2e3e] px-3 py-2 resize-y"
            placeholder="<h2>Introduction</h2><p>Your article content here...</p>"
          />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-[#848e9c] cursor-pointer">
            <input
              type="checkbox"
              checked={editing.featured}
              onChange={(e) =>
                setEditing({ ...editing, featured: e.target.checked })
              }
              className="rounded"
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-[#848e9c] cursor-pointer">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  published: e.target.checked,
                  published_at: e.target.checked
                    ? new Date().toISOString()
                    : editing.published_at,
                })
              }
              className="rounded"
            />
            Published
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-[#848e9c] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Blog CMS</h1>
            <p className="text-xs text-[#848e9c]">
              {posts.length} article{posts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={startNew}
          className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors flex items-center gap-1.5"
        >
          <Plus className="h-3 w-3" /> New Article
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-brand animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-[#848e9c]">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No articles yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-[#141620] rounded-xl p-4 flex items-center gap-4 group hover:bg-[#1a1d2e] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[post.category] || "bg-gray-500/20 text-gray-400"}`}
                  >
                    {post.category}
                  </span>
                  {post.featured && (
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  )}
                  {!post.published && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2a2e3e] text-[#848e9c]">
                      Draft
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white truncate">
                  {post.title}
                </h3>
                <p className="text-[10px] text-[#555a66] mt-0.5">
                  /{post.slug} · {post.read_time} ·{" "}
                  {post.view_count.toLocaleString()} views
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToggle(post, "published")}
                  className="p-1.5 rounded-lg hover:bg-[#2a2e3e] transition-colors"
                  title={post.published ? "Unpublish" : "Publish"}
                >
                  {post.published ? (
                    <Eye className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-[#848e9c]" />
                  )}
                </button>
                <button
                  onClick={() => handleToggle(post, "featured")}
                  className="p-1.5 rounded-lg hover:bg-[#2a2e3e] transition-colors"
                  title={post.featured ? "Unfeature" : "Feature"}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${post.featured ? "text-amber-400 fill-amber-400" : "text-[#848e9c]"}`}
                  />
                </button>
                <a
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-[#2a2e3e] transition-colors"
                  title="Preview"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#848e9c]" />
                </a>
                <button
                  onClick={() => {
                    setIsNew(false);
                    setEditing(post);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#2a2e3e] transition-colors"
                  title="Edit"
                >
                  <Edit3 className="h-3.5 w-3.5 text-brand" />
                </button>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="p-1.5 rounded-lg hover:bg-[#2a2e3e] transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#f6465d]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[#848e9c] mb-1 block">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#141620] text-white text-sm rounded-lg border border-[#2a2e3e] px-3 py-2"
      />
    </div>
  );
}
