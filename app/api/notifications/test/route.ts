import { NextRequest, NextResponse } from "next/server";
import { sendPush } from "@/lib/push/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const ok = await sendPush(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      {
        title: "Coincess",
        body: "Push notifications are working!",
        tag: "coincess-test",
        url: "/dashboard",
      },
    );

    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
