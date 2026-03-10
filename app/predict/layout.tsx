import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prediction Markets | Trade Real-World Events",
  description:
    "Trade prediction markets on politics, sports, crypto, and more. Powered by Polymarket.",
  keywords: [
    "prediction markets",
    "polymarket",
    "event trading",
    "binary options",
    "crypto predictions",
    "sports betting",
    "political predictions",
  ],
};

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
