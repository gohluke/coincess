import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { buildTraderPrompt } from "./prompts";
import type { MarketBrief, PositionInfo, TradeDecision, AiAgentConfig } from "../types";

function getModel(modelName: string) {
  if (modelName.startsWith("gpt-") || modelName.startsWith("o1") || modelName.startsWith("o3")) {
    return openai(modelName);
  }
  return google(modelName);
}

const TradeDecisionSchema = z.object({
  actions: z.array(
    z.object({
      action: z.enum(["open", "close", "adjust", "hold"]),
      coin: z.string(),
      side: z.enum(["long", "short"]),
      sizeUsd: z.number(),
      confidence: z.number().min(0).max(1),
      stopLoss: z.number(),
      takeProfit: z.number(),
      reasoning: z.string(),
    }),
  ),
  portfolioReasoning: z.string(),
});

let hourlyCallCount = 0;
let hourlyResetTime = Date.now();

function checkHourlyLimit(maxPerHour: number): boolean {
  const now = Date.now();
  if (now - hourlyResetTime > 3_600_000) {
    hourlyCallCount = 0;
    hourlyResetTime = now;
  }
  if (hourlyCallCount >= maxPerHour) return false;
  hourlyCallCount++;
  return true;
}

export async function makeTradeDecision(
  brief: MarketBrief,
  positions: PositionInfo[],
  accountValue: number,
  config: AiAgentConfig,
  model?: string,
): Promise<TradeDecision | null> {
  if (!checkHourlyLimit(config.maxTradesPerHour)) {
    console.log("[ai-trader] Hourly trade limit reached, skipping");
    return null;
  }

  const capitalBudget = accountValue * config.capitalAllocationPct;

  const prompt = buildTraderPrompt(
    brief,
    positions,
    accountValue,
    capitalBudget,
    config.maxPositions,
    config.defaultLeverage,
    config.stopLossPct,
  );

  try {
    const { object } = await generateObject({
      model: getModel(model ?? config.traderModel),
      schema: TradeDecisionSchema,
      prompt,
      maxRetries: 1,
    });

    const decision = object as TradeDecision;

    // Filter by confidence threshold
    decision.actions = decision.actions.filter(
      (a) => a.action === "hold" || a.action === "close" || a.confidence >= config.confidenceThreshold,
    );

    // Enforce capital limits
    let usedBudget = positions.reduce((s, p) => s + Math.abs(p.szi * p.entryPx), 0);
    decision.actions = decision.actions.filter((a) => {
      if (a.action !== "open") return true;
      if (usedBudget + a.sizeUsd > capitalBudget) {
        console.log(`[ai-trader] Budget exceeded for ${a.coin}, skipping`);
        return false;
      }
      usedBudget += a.sizeUsd;
      return true;
    });

    const actionCount = decision.actions.filter((a) => a.action !== "hold").length;
    console.log(
      `[ai-trader] Decision: ${actionCount} action(s) | ${decision.actions.filter((a) => a.action === "hold").length} hold(s) | ${decision.portfolioReasoning.slice(0, 100)}`,
    );

    return decision;
  } catch (err) {
    console.error("[ai-trader] Trade decision failed:", (err as Error).message);
    return null;
  }
}
