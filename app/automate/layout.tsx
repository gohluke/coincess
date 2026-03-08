import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automate | Coincess",
  description:
    "Automated trading strategies for Hyperliquid perpetuals and Polymarket predictions. DCA bots, grid trading, trailing stops, copy trading, and alerts.",
};

export default function AutomateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
