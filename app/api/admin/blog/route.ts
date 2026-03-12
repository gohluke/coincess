import { NextRequest, NextResponse } from "next/server";
import { BRAND_CONFIG } from "@/lib/brand.config";
import { getAllPosts, createPost, updatePost, deletePost } from "@/lib/blog";

function isAdmin(address: string | null): boolean {
  if (!address) return false;
  return BRAND_CONFIG.admin.addresses.includes(address.toLowerCase());
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!isAdmin(address))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const posts = await getAllPosts();
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, ...postData } = body;
  if (!isAdmin(address))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const post = await createPost(postData);
  return NextResponse.json(post);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { address, id, ...updates } = body;
  if (!isAdmin(address))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const post = await updatePost(id, updates);
  return NextResponse.json(post);
}

export async function DELETE(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const id = req.nextUrl.searchParams.get("id");
  if (!isAdmin(address))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await deletePost(id);
  return NextResponse.json({ deleted: true });
}
