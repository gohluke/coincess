"use client";

import { useState, useCallback, useMemo } from "react";
import { LogOut, User, Copy, Check, ExternalLink, Settings } from "lucide-react";
import { usePrivyAuth } from "@/components/WalletProvider";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const BRAND_PALETTE = [
  "#FF455B",
  "#E63B50",
  "#CC3045",
  "#FF5C6E",
  "#B3283C",
  "#0b0e11",
  "#141620",
  "#1a1d26",
  "#FF7A8A",
  "#991E30",
];

function Identicon({ seed, size = 32 }: { seed: string; size?: number }) {
  const { bg, fg1, fg2 } = useMemo(() => {
    const h = hashCode(seed);
    const pick = (offset: number) => BRAND_PALETTE[(h + offset) % BRAND_PALETTE.length];
    return { bg: pick(0), fg1: pick(3), fg2: pick(7) };
  }, [seed]);

  const grid = useMemo(() => {
    const h = hashCode(seed);
    const h2 = hashCode(seed + "x");
    const cells: boolean[][] = [];
    for (let row = 0; row < 5; row++) {
      const r: boolean[] = [];
      for (let col = 0; col < 3; col++) {
        const bit = row < 3
          ? ((h >> (row * 3 + col)) & 1) === 1
          : ((h2 >> ((row - 3) * 3 + col)) & 1) === 1;
        r.push(bit);
      }
      r.push(r[1]);
      r.push(r[0]);
      cells.push(r);
    }
    return cells;
  }, [seed]);

  const cellSize = size / 5;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-full shrink-0">
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, ri) =>
        row.map((on, ci) =>
          on ? (
            <rect
              key={`${ri}-${ci}`}
              x={ci * cellSize}
              y={ri * cellSize}
              width={cellSize}
              height={cellSize}
              fill={ri % 2 === 0 ? fg1 : fg2}
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function AuthButton() {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  return <AuthButtonInner showMenu={showMenu} setShowMenu={setShowMenu} copied={copied} setCopied={setCopied} />;
}

function AuthButtonInner({
  showMenu,
  setShowMenu,
  copied,
  setCopied,
}: {
  showMenu: boolean;
  setShowMenu: (v: boolean) => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const privy = usePrivyAuth();

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [setCopied]);

  if (!privy.ready) {
    return <div className="h-9 w-9 rounded-full bg-[#141620] animate-pulse" />;
  }

  if (!privy.authenticated) {
    return (
      <button
        onClick={() => privy.login()}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand hover:bg-brand-hover text-white text-[13px] font-semibold transition-all hover:scale-[1.02] active:scale-95"
      >
        Connect
      </button>
    );
  }

  const user = privy.user;
  const email = user?.email?.address || user?.google?.email;
  const name = user?.google?.name;
  const walletAddr = user?.wallet?.address;
  const identiconSeed = walletAddr ?? user?.id ?? "default";

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center justify-center w-9 h-9 rounded-full hover:ring-2 hover:ring-brand/30 transition-all"
      >
        <Identicon seed={identiconSeed} size={34} />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#141620] border border-[#2a2e3e] rounded-2xl shadow-2xl shadow-black/40 min-w-[240px] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-[#2a2e3e]">
              <div className="flex items-center gap-3">
                <Identicon seed={identiconSeed} size={36} />
                <div className="min-w-0 flex-1">
                  {name && <p className="text-[13px] font-semibold text-white truncate">{name}</p>}
                  {email && !name && <p className="text-[13px] font-semibold text-white truncate">{email.split("@")[0]}</p>}
                  {walletAddr && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-[#848e9c]">
                        {walletAddr.slice(0, 8)}...{walletAddr.slice(-6)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(walletAddr); }}
                        className="p-0.5 text-[#848e9c] hover:text-white transition-colors"
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                  {email && name && <p className="text-[10px] text-[#5a6270] truncate">{email}</p>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <a
                href="/dashboard"
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-white hover:bg-[#1a1d26] transition-colors"
              >
                <User className="h-4 w-4 text-[#848e9c]" />
                Portfolio
              </a>
              {walletAddr && (
                <a
                  href={`https://arbiscan.io/address/${walletAddr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-white hover:bg-[#1a1d26] transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-[#848e9c]" />
                  View on Explorer
                </a>
              )}
              <a
                href="/settings"
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-white hover:bg-[#1a1d26] transition-colors"
              >
                <Settings className="h-4 w-4 text-[#848e9c]" />
                Settings
              </a>
              <div className="mx-3 my-1 border-t border-[#2a2e3e]" />
              <button
                onClick={async () => {
                  setShowMenu(false);
                  await privy.logout();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
