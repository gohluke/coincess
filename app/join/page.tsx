import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BRAND_CONFIG } from "@/lib/brand.config";

export const metadata: Metadata = {
  title: "Join Coincess — Get 4% Fee Discount",
  description:
    "Join Coincess on Hyperliquid and get a 4% discount on all trading fees. Trade perpetual futures, prediction markets, and automate your strategies.",
  openGraph: {
    title: "Join Coincess — Get 4% Fee Discount",
    description:
      "Trade perpetual futures on Hyperliquid with a 4% fee discount. Sign up through Coincess.",
    url: `${BRAND_CONFIG.url}/join`,
    images: [{ url: `${BRAND_CONFIG.url}${BRAND_CONFIG.assets.og}`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join Coincess — 4% Fee Discount on Hyperliquid",
    description:
      "Trade perpetual futures on Hyperliquid with a 4% fee discount. Sign up through Coincess.",
    images: [`${BRAND_CONFIG.url}${BRAND_CONFIG.assets.og}`],
  },
};

export default function JoinPage() {
  redirect(BRAND_CONFIG.referral.link);
}
