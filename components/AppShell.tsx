"use client";

import dynamic from "next/dynamic";

const MobileNav = dynamic(() => import("@/components/MobileNav").then((m) => m.MobileNav), { ssr: false });
const AlertBanner = dynamic(() => import("@/components/automate/AlertBanner").then((m) => m.AlertBanner), { ssr: false });
const WalletProvider = dynamic(() => import("@/components/WalletProvider").then((m) => m.WalletProvider), { ssr: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="pb-14 md:pb-0">{children}</div>
      <MobileNav />
      <AlertBanner />
    </WalletProvider>
  );
}
