import type { TickContext, StrategySignal, QuantState } from "./types";

export interface RiskLimits {
  maxTotalExposurePct: number;
  maxPerPositionPct: number;
  dailyLossLimitPct: number;
  maxDrawdownPct: number;
  reserveUsd: number;
}

const DEFAULT_LIMITS: RiskLimits = {
  maxTotalExposurePct: 0.5,
  maxPerPositionPct: 0.1,
  dailyLossLimitPct: 0.05,
  maxDrawdownPct: 0.15,
  reserveUsd: 100,
};

export class RiskManager {
  private limits: RiskLimits;
  private paused = false;
  private pausedUntil: number | null = null;
  private killed = false;

  constructor(limits?: Partial<RiskLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  checkPreTrade(
    signal: StrategySignal,
    ctx: TickContext,
    state: QuantState,
  ): { allowed: boolean; reason?: string } {
    if (this.killed) {
      return { allowed: false, reason: "Kill switch triggered — max drawdown exceeded" };
    }

    if (this.paused && this.pausedUntil && Date.now() < this.pausedUntil) {
      return { allowed: false, reason: "Trading paused — daily loss limit hit" };
    }
    if (this.paused && this.pausedUntil && Date.now() >= this.pausedUntil) {
      this.paused = false;
      this.pausedUntil = null;
    }

    const tradableValue = ctx.accountValue - this.limits.reserveUsd;
    if (tradableValue <= 0) {
      return { allowed: false, reason: `Balance $${ctx.accountValue.toFixed(0)} below $${this.limits.reserveUsd} reserve` };
    }

    const positionValue = signal.size * signal.price;
    const maxPerPos = tradableValue * this.limits.maxPerPositionPct;
    if (positionValue > maxPerPos) {
      return {
        allowed: false,
        reason: `Position $${positionValue.toFixed(0)} exceeds ${(this.limits.maxPerPositionPct * 100).toFixed(0)}% limit ($${maxPerPos.toFixed(0)})`,
      };
    }

    const currentExposure = ctx.positions.reduce(
      (sum, p) => sum + Math.abs(p.szi * p.entryPx),
      0,
    );
    const maxExposure = tradableValue * this.limits.maxTotalExposurePct;
    if (currentExposure + positionValue > maxExposure) {
      return {
        allowed: false,
        reason: `Total exposure would exceed ${(this.limits.maxTotalExposurePct * 100).toFixed(0)}% limit`,
      };
    }

    return { allowed: true };
  }

  updatePostTick(state: QuantState, accountValue: number): {
    shouldPause: boolean;
    shouldKill: boolean;
    dailyPnl: number;
  } {
    const resetTime = new Date(state.daily_pnl_reset_at).getTime();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let dailyPnl = state.daily_pnl;
    if (now - resetTime > dayMs) {
      dailyPnl = 0;
    }

    const peakEquity = Math.max(state.peak_equity, accountValue);
    const drawdown = peakEquity > 0 ? (peakEquity - accountValue) / peakEquity : 0;

    const shouldKill = drawdown >= this.limits.maxDrawdownPct;
    if (shouldKill) this.killed = true;

    const dailyLoss = accountValue > 0 ? -dailyPnl / accountValue : 0;
    const shouldPause = dailyLoss >= this.limits.dailyLossLimitPct;
    if (shouldPause && !this.paused) {
      this.paused = true;
      this.pausedUntil = now + dayMs;
    }

    return { shouldPause, shouldKill, dailyPnl };
  }

  scaledPositionSize(
    baseSizePct: number,
    accountValue: number,
    state: QuantState,
  ): number {
    const peakEquity = Math.max(state.peak_equity, accountValue);
    const drawdown = peakEquity > 0 ? (peakEquity - accountValue) / peakEquity : 0;
    const scaleFactor = Math.max(0.25, 1 - drawdown * 4);
    return accountValue * baseSizePct * scaleFactor;
  }

  get isKilled(): boolean {
    return this.killed;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  reset(): void {
    this.killed = false;
    this.paused = false;
    this.pausedUntil = null;
  }
}
