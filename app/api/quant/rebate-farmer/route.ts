import { NextResponse } from "next/server";

const STATS_URL = process.env.QUANT_STATS_URL ?? "http://184.174.37.31:3099";

export async function GET() {
  try {
    const res = await fetch(`${STATS_URL}/stats/rebate-farmer`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Stats server: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, status: "offline" },
      { status: 502 },
    );
  }
}
