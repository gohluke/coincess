"use client";

import { useState } from "react";
import { Shield, ShieldAlert, ShieldCheck, Search, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { checkTokenSecurity, scoreColor, scoreLabel, getSupportedChains, type SecurityResult } from "@/lib/goplus/api";

export function SecurityCheck() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await checkTokenSecurity(chain, address.trim());
      if (!res.data) {
        setError("Token not found or not supported on this chain.");
      } else {
        setResult(res);
      }
    } catch {
      setError("Failed to check token security. Try again.");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-[#FF455B]" />
        <h2 className="text-sm font-semibold">Token Security Check</h2>
        <span className="text-[10px] text-[#848e9c]">powered by GoPlus</span>
      </div>

      <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-4 sm:p-6">
        <p className="text-xs text-[#848e9c] mb-4">
          Paste a contract address to check for honeypots, rug pulls, hidden owners, and other risks.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="bg-[#0b0e11] border border-[#2a2e3e] rounded-lg px-3 py-2 text-xs text-white sm:w-36"
          >
            {getSupportedChains().map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              placeholder="0x... or token address"
              className="flex-1 bg-[#0b0e11] border border-[#2a2e3e] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#848e9c] focus:outline-none focus:border-[#FF455B]"
            />
            <button
              onClick={handleCheck}
              disabled={loading || !address.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#FF455B] hover:bg-[#E63B50] disabled:opacity-40 rounded-lg text-xs font-semibold text-white transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Check
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Score */}
            <div className="flex items-center gap-4 bg-[#0b0e11] rounded-lg p-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#2a2e3e" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke={scoreColor(result.score)}
                    strokeWidth="3"
                    strokeDasharray={`${result.score * 0.975} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: scoreColor(result.score) }}>{result.score}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {result.score >= 60 ? (
                    <ShieldCheck className="h-5 w-5" style={{ color: scoreColor(result.score) }} />
                  ) : (
                    <ShieldAlert className="h-5 w-5" style={{ color: scoreColor(result.score) }} />
                  )}
                  <span className="font-semibold text-sm" style={{ color: scoreColor(result.score) }}>
                    {scoreLabel(result.score)}
                  </span>
                </div>
                {result.data && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold">{result.data.token_symbol}</span>
                    <span className="text-[10px] text-[#848e9c]">{result.data.token_name}</span>
                  </div>
                )}
                {result.data?.holder_count && (
                  <p className="text-[10px] text-[#848e9c] mt-0.5">
                    {parseInt(result.data.holder_count).toLocaleString()} holders · {result.data.lp_holder_count} LP holders
                  </p>
                )}
              </div>
            </div>

            {/* Risks */}
            {result.risks.length > 0 && (
              <div>
                <h3 className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-2">Risks ({result.risks.length})</h3>
                <div className="space-y-1">
                  {result.risks.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div>
                <h3 className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-2">Warnings ({result.warnings.length})</h3>
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safe signals */}
            {result.safe.length > 0 && (
              <div>
                <h3 className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide mb-2">Safe ({result.safe.length})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.safe.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">
                      <CheckCircle className="h-3 w-3" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
