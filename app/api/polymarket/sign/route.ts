import { NextRequest, NextResponse } from "next/server";
import { signBuilderRequest, isBuilderConfigured } from "@/lib/polymarket/builder";

export async function POST(request: NextRequest) {
  if (!isBuilderConfigured()) {
    return NextResponse.json(
      { error: "Builder not configured" },
      { status: 503 },
    );
  }

  try {
    const { method, path, body } = await request.json();
    if (!method || !path) {
      return NextResponse.json(
        { error: "Missing method or path" },
        { status: 400 },
      );
    }

    const headers = signBuilderRequest(
      method,
      path,
      body || "",
      process.env.POLYMARKET_BUILDER_KEY!,
      process.env.POLYMARKET_BUILDER_SECRET!,
      process.env.POLYMARKET_BUILDER_PASSPHRASE!,
    );

    return NextResponse.json(headers);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
