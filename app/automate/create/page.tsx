"use client";

import { useState } from "react";
import { ArrowLeft, RefreshCw, Grid3X3, ShieldAlert, Bot, Clock, Copy } from "lucide-react";
import { DCAForm } from "@/components/automate/DCAForm";
import { GridForm } from "@/components/automate/GridForm";
import { TrailingStopForm } from "@/components/automate/TrailingStopForm";
import { PredictionBetForm } from "@/components/automate/PredictionBetForm";
import { PredictionExitForm } from "@/components/automate/PredictionExitForm";
import { CopyTradeForm } from "@/components/automate/CopyTradeForm";

type StrategyOption = "dca" | "grid" | "trailing_stop" | "prediction_auto_bet" | "prediction_exit" | "copy_trade";

const OPTIONS: { id: StrategyOption; label: string; desc: string; icon: React.ReactNode; platform: string }[] = [
  { id: "dca", label: "DCA Bot", desc: "Buy or sell a fixed amount at regular intervals", icon: <RefreshCw className="h-5 w-5" />, platform: "Hyperliquid" },
  { id: "grid", label: "Grid Trading", desc: "Place buy and sell orders at price intervals", icon: <Grid3X3 className="h-5 w-5" />, platform: "Hyperliquid" },
  { id: "trailing_stop", label: "Trailing Stop", desc: "Dynamic stop-loss that follows price movement", icon: <ShieldAlert className="h-5 w-5" />, platform: "Hyperliquid" },
  { id: "prediction_auto_bet", label: "Auto Bet", desc: "Bet when prediction odds cross your threshold", icon: <Bot className="h-5 w-5" />, platform: "Polymarket" },
  { id: "prediction_exit", label: "Auto Exit", desc: "Exit prediction positions before market closes", icon: <Clock className="h-5 w-5" />, platform: "Polymarket" },
  { id: "copy_trade", label: "Copy Trading", desc: "Mirror trades from any Hyperliquid wallet", icon: <Copy className="h-5 w-5" />, platform: "Hyperliquid" },
];

export default function CreateStrategyPage() {
  const [selected, setSelected] = useState<StrategyOption | null>(null);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {!selected ? (
          <>
            <h1 className="text-xl font-bold mb-6">Choose a Strategy</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelected(opt.id)}
                  className="text-left bg-[#141620] rounded-xl p-4 hover:border-brand/50 hover:bg-[#1a1d2e] transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-brand">{opt.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold">{opt.label}</h3>
                      <span className="text-[10px] text-[#848e9c] uppercase">{opt.platform}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#848e9c]">{opt.desc}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-[#848e9c] hover:text-white mb-6 transition-colors">
              <ArrowLeft className="h-3 w-3" /> Back to strategy selection
            </button>
            <h1 className="text-xl font-bold mb-6">{OPTIONS.find((o) => o.id === selected)?.label}</h1>
            {selected === "dca" && <DCAForm />}
            {selected === "grid" && <GridForm />}
            {selected === "trailing_stop" && <TrailingStopForm />}
            {selected === "prediction_auto_bet" && <PredictionBetForm />}
            {selected === "prediction_exit" && <PredictionExitForm />}
            {selected === "copy_trade" && <CopyTradeForm />}
          </>
        )}
      </div>
    </div>
  );
}
