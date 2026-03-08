import { NextRequest, NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json([], { status: 200 });
  }

  const url = new URL(`${GAMMA_API}/public-search`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit_per_type", "20");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(data.events ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
