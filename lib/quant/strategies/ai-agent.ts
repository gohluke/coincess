import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { analyzeMarkets } from "../ai/analyst";
import { makeTradeDecision } from "../ai/trader";
import type { RecentTradeResult } from "../ai/prompts";
import { selectTopCoins, buildTechnicalSnapshots } from "../market-analysis";
import { buildMicrostructure, recordFundingOi } from "../market-microstructure";
import type {
  QuantStrategy,
  StrategySignal,
  TickContext,
  MarketSnapshot,
  AiAgentConfig,
  MarketBrief,
  TradeDecision,
} from "../types";
import { AI_AGENT_DEFAULTS } from "../types";

export interface AiDecisionLog {
  timestamp: number;
  brief: MarketBrief | null;
  decision: TradeDecision | null;
  signalsGenerated: number;
}

const recentLogs: AiDecisionLog[] = [];
const MAX_LOGS = 50;

export function getRecentLogs(): AiDecisionLog[] {
  return recentLogs;
}

let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key);
  return _sb;
}

async function fetchRecentTrades(): Promise<RecentTradeResult[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("quant_trades")
      .select("coin, side, entry_px, exit_px, pnl, meta, closed_at")
      .eq("status", "closed")
      .not("pnl", "is", null)
      .order("closed_at", { ascending: false })
      .limit(15);
    if (!data) return [];
    return data.map((t) => ({
      coin: t.coin,
      side: t.side as "long" | "short",
      entryPx: Number(t.entry_px),
      exitPx: Number(t.exit_px),
      pnl: Number(t.pnl),
      reason: (t.meta as Record<string, unknown>)?.close_reason as string ?? "unknown",
      closedAt: t.closed_at ?? "",
    }));
  } catch {
    return [];
  }
}

async function persistLog(
  strategyId: string,
  brief: MarketBrief | null,
  decision: TradeDecision | null,
  signalsGenerated: number,
  config: AiAgentConfig,
  error?: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("ai_agent_logs").insert({
      strategy_id: strategyId,
      event_type: error ? "error" : decision ? "trade_decision" : brief ? "analysis" : "cycle",
      market_sentiment: brief?.regime ?? null,
      opportunities: brief?.topOpportunities ?? [],
      decision: decision ?? null,
      signals_generated: signalsGenerated,
      analyst_model: config.analystModel,
      trader_model: config.traderModel,
      error_message: error ?? null,
    });
  } catch (e) {
    console.error("[ai-agent] Failed to persist log:", (e as Error).message);
  }
}

function resolveConfig(raw: Record<string, unknown>): AiAgentConfig {
  return {
    allowedMarkets: (raw.allowedMarkets as AiAgentConfig["allowedMarkets"]) ?? AI_AGENT_DEFAULTS.allowedMarkets,
    capitalAllocationPct: (raw.capitalAllocationPct as number) ?? AI_AGENT_DEFAULTS.capitalAllocationPct,
    maxTradesPerHour: (raw.maxTradesPerHour as number) ?? AI_AGENT_DEFAULTS.maxTradesPerHour,
    confidenceThreshold: (raw.confidenceThreshold as number) ?? AI_AGENT_DEFAULTS.confidenceThreshold,
    maxPositions: (raw.maxPositions as number) ?? AI_AGENT_DEFAULTS.maxPositions,
    defaultLeverage: (raw.defaultLeverage as number) ?? AI_AGENT_DEFAULTS.defaultLeverage,
    stopLossPct: (raw.stopLossPct as number) ?? AI_AGENT_DEFAULTS.stopLossPct,
    takeProfitPct: (raw.takeProfitPct as number) ?? AI_AGENT_DEFAULTS.takeProfitPct,
    analystModel: (raw.analystModel as string) ?? AI_AGENT_DEFAULTS.analystModel,
    traderModel: (raw.traderModel as string) ?? AI_AGENT_DEFAULTS.traderModel,
  };
}

function filterMarketsByConfig(markets: MarketSnapshot[], config: AiAgentConfig): MarketSnapshot[] {
  return markets.filter((m) => {
    if (m.dex === "perp" && !m.coin.startsWith("xyz:") && config.allowedMarkets.includes("perps")) return true;
    if (m.dex === "spot" && config.allowedMarkets.includes("stocks")) return true;
    if (m.coin.startsWith("xyz:") && config.allowedMarkets.includes("commodities")) return true;
    return false;
  });
}

/**
 * Risk-based position sizing: AI picks direction + confidence, this function
 * determines how much capital to allocate.
 *
 * budget_per_slot = accountValue * capitalAllocationPct / maxPositions
 * final_size     = budget_per_slot * confidence   (clamped to $10 minimum)
 */
function calculateRiskAdjustedSize(
  config: AiAgentConfig,
  accountValue: number,
  confidence: number,
): number {
  const perSlotBudget = (accountValue * config.capitalAllocationPct) / config.maxPositions;
  const clamped = Math.max(0.1, Math.min(1.0, confidence));
  return Math.max(10, perSlotBudget * clamped);
}

export async function evaluate(
  strategy: QuantStrategy,
  markets: MarketSnapshot[],
  ctx: TickContext,
): Promise<StrategySignal[]> {
  const config = resolveConfig(strategy.config as Record<string, unknown>);
  const filteredMarkets = filterMarketsByConfig(markets, config);

  if (filteredMarkets.length === 0) {
    console.log("[ai-agent] No markets match config filters");
    return [];
  }

  // Build enriched technical data for top coins (parallel candle fetches)
  const topCoins = selectTopCoins(filteredMarkets, 15);
  const [technicals, recentTrades] = await Promise.all([
    buildTechnicalSnapshots(topCoins),
    fetchRecentTrades(),
  ]);
  console.log(`[ai-agent] Built technical snapshots for ${technicals.length} coins`);

  if (recentTrades.length > 0) {
    const wins = recentTrades.filter((t) => t.pnl > 0).length;
    console.log(`[ai-agent] Feeding ${recentTrades.length} recent trades (${wins}W/${recentTrades.length - wins}L) to AI`);
  }

  // Record funding/OI snapshots for delta tracking
  for (const m of filteredMarkets) {
    if (m.dex === "perp" && !m.coin.startsWith("xyz:")) {
      recordFundingOi(m.coin, m.funding, m.openInterest);
    }
  }

  // Fetch order book imbalance + funding/OI deltas for top coins
  const microstructure = await buildMicrostructure(
    topCoins.map((m) => ({ coin: m.coin, funding: m.funding, openInterest: m.openInterest })),
  );
  const crowded = microstructure.filter((m) => m.crowdedLong || m.crowdedShort);
  if (crowded.length > 0) {
    console.log(`[ai-agent] Crowded trades detected: ${crowded.map((m) => `${m.coin}(${m.crowdedLong ? "LONG" : "SHORT"})`).join(", ")}`);
  }
  console.log(`[ai-agent] Microstructure data for ${microstructure.length} coins (book + flow)`);

  // Step 1: Analyst scans markets with full technical + microstructure data
  const brief = await analyzeMarkets(
    filteredMarkets,
    ctx.positions,
    ctx.accountValue,
    config.analystModel,
    technicals,
    recentTrades,
    microstructure,
  );

  if (!brief || brief.topOpportunities.length === 0) {
    recentLogs.unshift({ timestamp: Date.now(), brief, decision: null, signalsGenerated: 0 });
    if (recentLogs.length > MAX_LOGS) recentLogs.pop();
    await persistLog(strategy.id, brief, null, 0, config);
    return [];
  }

  // Skip trader call if no opportunity is strong enough (raised to 60)
  const strongOpps = brief.topOpportunities.filter((o) => o.strength >= 60);
  if (strongOpps.length === 0) {
    console.log("[ai-agent] No strong opportunities (all below 60), skipping trader");
    recentLogs.unshift({ timestamp: Date.now(), brief, decision: null, signalsGenerated: 0 });
    if (recentLogs.length > MAX_LOGS) recentLogs.pop();
    await persistLog(strategy.id, brief, null, 0, config);
    return [];
  }

  // Step 2: Trader makes decisions with performance context
  const decision = await makeTradeDecision(
    brief,
    ctx.positions,
    ctx.accountValue,
    config,
    undefined,
    recentTrades,
  );

  if (!decision || decision.actions.length === 0) {
    recentLogs.unshift({ timestamp: Date.now(), brief, decision, signalsGenerated: 0 });
    if (recentLogs.length > MAX_LOGS) recentLogs.pop();
    await persistLog(strategy.id, brief, decision, 0, config);
    return [];
  }

  // Step 3: Convert decisions to StrategySignals
  const signals: StrategySignal[] = [];

  for (const action of decision.actions) {
    if (action.action === "hold") continue;

    const market = filteredMarkets.find((m) => {
      const baseCoin = m.coin.startsWith("xyz:") ? m.coin.replace("xyz:", "") : m.coin;
      return baseCoin === action.coin || m.coin === action.coin;
    });

    if (!market) {
      console.log(`[ai-agent] Coin ${action.coin} not found in markets, skipping`);
      continue;
    }

    if (action.action === "close") {
      const pos = ctx.positions.find((p) => p.coin === market.coin);
      if (!pos) continue;
      signals.push({
        coin: market.coin,
        side: pos.szi > 0 ? "short" : "long",
        size: 0,
        price: market.markPx,
        assetIndex: market.assetIndex,
        reason: `AI close: ${action.reasoning}`,
      });
      continue;
    }

    // "open" or "adjust" — override AI sizeUsd with risk-adjusted sizing
    const riskSizeUsd = calculateRiskAdjustedSize(config, ctx.accountValue, action.confidence);
    const effectiveSizeUsd = Math.min(action.sizeUsd, riskSizeUsd);
    const sizeInCoins = effectiveSizeUsd / market.markPx;
    if (sizeInCoins * market.markPx < 10) {
      console.log(`[ai-agent] ${action.coin} notional too small ($${effectiveSizeUsd.toFixed(2)}), skipping`);
      continue;
    }

    signals.push({
      coin: market.coin,
      side: action.side,
      size: sizeInCoins,
      price: market.markPx,
      assetIndex: market.assetIndex,
      reason: `AI ${action.action} (${(action.confidence * 100).toFixed(0)}%, $${effectiveSizeUsd.toFixed(0)}): ${action.reasoning}`,
      stopLoss: action.stopLoss > 0 ? action.stopLoss : undefined,
      takeProfit: action.takeProfit,
    });
  }

  recentLogs.unshift({ timestamp: Date.now(), brief, decision, signalsGenerated: signals.length });
  if (recentLogs.length > MAX_LOGS) recentLogs.pop();
  await persistLog(strategy.id, brief, decision, signals.length, config);

  console.log(`[ai-agent] Generated ${signals.length} signal(s) from AI pipeline`);
  return signals;
}
