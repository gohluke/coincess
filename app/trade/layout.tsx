import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade Perpetuals | Coincess",
  description:
    "Trade crypto perpetual futures on Hyperliquid DEX. No KYC required. Long or short BTC, ETH, and 100+ assets with up to 50x leverage.",
  keywords: [
    "crypto trading",
    "perpetual futures",
    "hyperliquid",
    "decentralized exchange",
    "no kyc trading",
    "leverage trading",
    "crypto derivatives",
  ],
};

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
