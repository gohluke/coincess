import type { StrategySignal, QuantStrategy, TickContext, MarketSnapshot } from "../types";

export interface GridConfig {
  coins: string[];
  gridLevels: number;        // number of levels each side (default 10)
  gridSpacing: number;       // spacing as % (default 0.001 = 0.1%)
  positionSizePct: number;   // % of account per grid level (default 0.01)
}

const DEFAULT_CONFIG: GridConfig = {
  coins: ["BTC", "ETH"],
  gridLevels: 10,
  gridSpacing: 0.001,
  positionSizePct: 0.01,
};

interface GridState {
  centerPrice: number;
  buyLevels: number[];       // prices where buy orders sit
  sellLevels: number[];      // prices where sell orders sit
  filledBuys: Set<number>;   // filled buy level indices
  filledSells: Set<number>;  // filled sell level indices
}

const gridStates: Map<string, GridState> = new Map();

function initGrid(coin: string, currentPrice: number, cfg: GridConfig): GridState {
  const buyLevels: number[] = [];
  const sellLevels: number[] = [];

  for (let i = 1; i <= cfg.gridLevels; i++) {
    buyLevels.push(currentPrice * (1 - cfg.gridSpacing * i));
    sellLevels.push(currentPrice * (1 + cfg.gridSpacing * i));
  }

  const state: GridState = {
    centerPrice: currentPrice,
    buyLevels,
    sellLevels,
    filledBuys: new Set(),
    filledSells: new Set(),
  };
  gridStates.set(coin, state);
  return state;
}

export function evaluate(
  strategy: QuantStrategy,
  markets: MarketSnapshot[],
  ctx: TickContext,
): StrategySignal[] {
  const cfg: GridConfig = { ...DEFAULT_CONFIG, ...(strategy.config as Partial<GridConfig>) };
  const signals: StrategySignal[] = [];

  for (const market of markets) {
    if (!cfg.coins.includes(market.coin)) continue;

    let grid = gridStates.get(market.coin);

    // Initialize or rebalance if price moved too far from center
    if (!grid) {
      grid = initGrid(market.coin, market.markPx, cfg);
    } else {
      const drift = Math.abs(market.markPx - grid.centerPrice) / grid.centerPrice;
      if (drift > cfg.gridSpacing * cfg.gridLevels * 0.5) {
        grid = initGrid(market.coin, market.markPx, cfg);
      }
    }

    const sizePerLevel = (ctx.accountValue * cfg.positionSizePct) / market.markPx;

    // Check buy levels — if price dropped below a level, trigger buy
    for (let i = 0; i < grid.buyLevels.length; i++) {
      if (grid.filledBuys.has(i)) continue;
      if (market.markPx <= grid.buyLevels[i]) {
        signals.push({
          coin: market.coin,
          side: "long",
          size: sizePerLevel,
          price: grid.buyLevels[i],
          assetIndex: market.assetIndex,
          reason: `GRID buy L${i + 1}: px=${grid.buyLevels[i].toFixed(2)}`,
        });
        grid.filledBuys.add(i);
        // Reset the corresponding sell level so it can be filled on the way up
        if (i < grid.sellLevels.length) grid.filledSells.delete(i);
      }
    }

    // Check sell levels — if price rose above a level, trigger sell
    for (let i = 0; i < grid.sellLevels.length; i++) {
      if (grid.filledSells.has(i)) continue;
      if (market.markPx >= grid.sellLevels[i]) {
        signals.push({
          coin: market.coin,
          side: "short",
          size: sizePerLevel,
          price: grid.sellLevels[i],
          assetIndex: market.assetIndex,
          reason: `GRID sell L${i + 1}: px=${grid.sellLevels[i].toFixed(2)}`,
        });
        grid.filledSells.add(i);
        if (i < grid.buyLevels.length) grid.filledBuys.delete(i);
      }
    }
  }

  return signals;
}

export function resetState(): void {
  gridStates.clear();
}
