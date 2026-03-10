import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automate | Coincess",
  description:
    "Automated trading — 24/7 server-side quant strategies and browser-based bots for Hyperliquid perpetuals and Polymarket predictions.",
};

export default function AutomateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
