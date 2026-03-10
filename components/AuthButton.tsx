"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LogOut, User, Copy, Check, ExternalLink } from "lucide-react";

interface PrivyHook {
  ready: boolean;
  authenticated: boolean;
  user: {
    id: string;
    email?: { address: string };
    google?: { email: string; name?: string };
    wallet?: { address: string; chainType?: string };
    linkedAccounts?: Array<{ type: string; address?: string; email?: string; name?: string }>;
  } | null;
  login: () => void;
  logout: () => Promise<void>;
}

let usePrivyHook: (() => PrivyHook) | null = null;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function Identicon({ seed, size = 32 }: { seed: string; size?: number }) {
  const colors = useMemo(() => {
    const h = hashCode(seed);
    const hue1 = h % 360;
    const hue2 = (h * 7 + 137) % 360;
    const hue3 = (h * 13 + 53) % 360;
    return [
      `hsl(${hue1}, 70%, 55%)`,
      `hsl(${hue2}, 65%, 45%)`,
      `hsl(${hue3}, 75%, 60%)`,
    ];
  }, [seed]);

  const grid = useMemo(() => {
    const h = hashCode(seed);
    const cells: boolean[][] = [];
    for (let row = 0; row < 5; row++) {
      const r: boolean[] = [];
      for (let col = 0; col < 3; col++) {
        r.push(((h >> (row * 3 + col)) & 1) === 1);
      }
      r.push(r[1]);
      r.push(r[0]);
      cells.push(r);
    }
    return cells;
  }, [seed]);

  const cellSize = size / 5;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-full">
      <rect width={size} height={size} fill={colors[2]} />
      {grid.map((row, ri) =>
        row.map((on, ci) =>
          on ? (
            <rect
              key={`${ri}-${ci}`}
              x={ci * cellSize}
              y={ri * cellSize}
              width={cellSize}
              height={cellSize}
              fill={ri % 2 === 0 ? colors[0] : colors[1]}
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
      setLoaded(true);
      return;
    }

    import("@privy-io/react-auth")
      .then((mod) => {
        usePrivyHook = mod.usePrivy as unknown as () => PrivyHook;
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  if (!loaded) {
    return (
      <div className="h-9 w-20 rounded-full bg-[#141620] animate-pulse" />
    );
  }

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
  let privy: PrivyHook | null = null;
  try {
    if (usePrivyHook) privy = usePrivyHook();
  } catch {
    privy = null;
  }

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [setCopied]);

  if (!privy || !privy.ready) {
    return (
      <div className="h-9 w-20 rounded-full bg-[#141620] animate-pulse" />
    );
  }

  if (!privy.authenticated) {
    return (
      <button
        onClick={() => privy!.login()}
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
  const shortAddr = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : null;
  const identiconSeed = walletAddr ?? user?.id ?? "default";

  return (
    <div className="relative">
      {/* Trigger: avatar + address pill (based.app style) */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-full bg-[#1a1d26] border border-[#2a2e3e] hover:border-[#3a3e4e] pl-1 pr-3 py-1 transition-colors"
      >
        <Identicon seed={identiconSeed} size={28} />
        <span className="text-[12px] font-mono text-[#c0c4cc]">
          {shortAddr ?? "Connected"}
        </span>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#141620] border border-[#2a2e3e] rounded-2xl shadow-2xl shadow-black/40 min-w-[240px] overflow-hidden">
            {/* Header: identicon + address */}
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
              <button
                onClick={async () => {
                  setShowMenu(false);
                  await privy!.logout();
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
