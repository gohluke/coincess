import { NextResponse } from "next/server";

/**
 * POST /api/dayze/sync
 *
 * Proxies activity from the client to Dayze's API v1, keeping
 * the API key server-side only (passed from the client's settings).
 */
export async function POST(req: Request) {
  const { apiKey, baseUrl, activities } = await req.json();

  if (!apiKey || !baseUrl) {
    return NextResponse.json(
      { error: "Dayze API key and base URL are required" },
      { status: 400 },
    );
  }

  if (!Array.isArray(activities) || activities.length === 0) {
    return NextResponse.json(
      { error: "activities array is required" },
      { status: 400 },
    );
  }

  const results: { activity_type: string; ok: boolean; error?: string }[] = [];

  for (const activity of activities) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(activity),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        results.push({
          activity_type: activity.activity_type,
          ok: false,
          error: body.error || `HTTP ${res.status}`,
        });
      } else {
        results.push({ activity_type: activity.activity_type, ok: true });
      }
    } catch (err) {
      results.push({
        activity_type: activity.activity_type,
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    synced: successCount,
    total: results.length,
    results,
  });
}
