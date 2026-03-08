import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";

export async function GET() {
  try {
    const res = await fetch(`${GAMMA_API}/tags`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Gamma API returned ${res.status}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
