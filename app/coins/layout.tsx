import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover Tokens | Coincess",
  description: "Trending tokens, new token launches, security checks, and top 100 cryptocurrencies. Your GMGN-style token discovery hub.",
};

export default function CoinsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
