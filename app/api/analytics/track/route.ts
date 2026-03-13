import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      path,
      referrer,
      wallet_address,
      session_id,
      event_name,
      target,
      metadata,
    } = body;

    const sb = getServiceClient();
    const ua = req.headers.get("user-agent") ?? undefined;
    const country =
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      undefined;

    if (type === "pageview") {
      const { error } = await sb.from("page_views").insert({
        path,
        referrer,
        user_agent: ua,
        wallet_address: wallet_address || null,
        session_id,
        country,
      });
      if (error) console.warn("[analytics] page_views insert failed:", error.message);
    } else if (type === "click") {
      const { error } = await sb.from("click_events").insert({
        event_name,
        path,
        target,
        wallet_address: wallet_address || null,
        session_id,
        metadata,
      });
      if (error) console.warn("[analytics] click_events insert failed:", error.message);
    } else if (type === "session") {
      const { error } = await sb.from("user_sessions").insert({
        wallet_address,
        session_id,
        path,
        duration_ms: body.duration_ms,
      });
      if (error) console.warn("[analytics] user_sessions insert failed:", error.message);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
