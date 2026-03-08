import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Coincess",
  description: "Your unified crypto portfolio. View Hyperliquid perpetual positions, Polymarket predictions, PnL, and account balances in one place.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
