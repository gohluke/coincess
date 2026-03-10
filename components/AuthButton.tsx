"use client";

import { useState, useEffect, useCallback } from "react";
import { LogOut, User, Wallet, Copy, Check, ExternalLink } from "lucide-react";

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

export function AuthButton() {
  const [privyState, setPrivyState] = useState<PrivyHook | null>(null);
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
      <div className="h-9 w-20 rounded-xl bg-[#141620] animate-pulse" />
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
      <div className="h-9 w-20 rounded-xl bg-[#141620] animate-pulse" />
    );
  }

  if (!privy.authenticated) {
    return (
      <button
        onClick={() => privy!.login()}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF455B] hover:bg-[#E63B50] text-white text-[13px] font-semibold transition-all hover:scale-[1.02] active:scale-95"
      >
        Sign In
      </button>
    );
  }

  const user = privy.user;
  const email = user?.email?.address || user?.google?.email;
  const name = user?.google?.name;
  const walletAddr = user?.wallet?.address;
  const displayName = name || (email ? email.split("@")[0] : null) || (walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : "User");
  const avatarLetter = displayName[0]?.toUpperCase() ?? "U";

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[#FF455B] to-[#FF5C6E] hover:opacity-90 transition-opacity"
        title={displayName}
      >
        <span className="text-xs font-bold text-white leading-none">{avatarLetter}</span>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#141620] border border-[#2a2e3e] rounded-xl shadow-2xl shadow-black/40 min-w-[220px] overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-[#2a2e3e]">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF455B] to-[#FF5C6E] flex items-center justify-center text-xs font-bold text-white">
                  {avatarLetter}
                </div>
                <div className="min-w-0">
                  {name && <p className="text-xs font-semibold truncate">{name}</p>}
                  {email && <p className="text-[10px] text-[#848e9c] truncate">{email}</p>}
                </div>
              </div>
            </div>

            {/* Wallet */}
            {walletAddr && (
              <div className="px-4 py-2.5 border-b border-[#2a2e3e]">
                <p className="text-[10px] text-[#848e9c] mb-1 flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Wallet
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-white">
                    {walletAddr.slice(0, 8)}...{walletAddr.slice(-6)}
                  </span>
                  <button
                    onClick={() => handleCopy(walletAddr)}
                    className="p-0.5 text-[#848e9c] hover:text-white transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-1">
              <a
                href="/dashboard"
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white hover:bg-[#1a1d26] transition-colors"
              >
                <User className="h-3.5 w-3.5 text-[#848e9c]" />
                Portfolio
              </a>
              {walletAddr && (
                <a
                  href={`https://arbiscan.io/address/${walletAddr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white hover:bg-[#1a1d26] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#848e9c]" />
                  View on Explorer
                </a>
              )}
              <button
                onClick={async () => {
                  setShowMenu(false);
                  await privy!.logout();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
