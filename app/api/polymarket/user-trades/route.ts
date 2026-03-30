import { NextRequest, NextResponse } from "next/server";

const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

async function resolveProxyWallet(address: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GAMMA_API}/public-profile?address=${address}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.proxyWallet ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = params.get("address");
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const proxyWallet = await resolveProxyWallet(address);
  if (!proxyWallet) {
    return NextResponse.json({ trades: [], proxyWallet: null });
  }

  try {
    const url = new URL(`${DATA_API}/trades`);
    url.searchParams.set("user", proxyWallet);
    url.searchParams.set("limit", params.get("limit") ?? "100");
    if (params.has("offset")) url.searchParams.set("offset", params.get("offset")!);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Data API returned ${res.status}` },
        { status: res.status },
      );
    }

    const trades = await res.json();
    return NextResponse.json({ trades, proxyWallet });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
