import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your wallets, API keys, and trading preferences on Coincess.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
