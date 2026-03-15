import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { buildAnalystPrompt } from "./prompts";
import type { MarketSnapshot, PositionInfo, MarketBrief } from "../types";

const MarketBriefSchema = z.object({
  regime: z.enum(["trending", "ranging", "volatile", "quiet"]),
  topOpportunities: z.array(
    z.object({
      coin: z.string(),
      market: z.enum(["perp", "spot", "stock", "commodity"]),
      direction: z.enum(["long", "short", "neutral"]),
      strength: z.number().min(0).max(100),
      reasons: z.array(z.string()),
      keyLevels: z.object({
        support: z.number(),
        resistance: z.number(),
      }),
    }),
  ),
  warnings: z.array(z.string()),
});

let lastCallTime = 0;
const MIN_INTERVAL_MS = 5_000;

export async function analyzeMarkets(
  markets: MarketSnapshot[],
  positions: PositionInfo[],
  accountValue: number,
  model = "gemini-2.5-flash",
): Promise<MarketBrief | null> {
  const now = Date.now();
  if (now - lastCallTime < MIN_INTERVAL_MS) {
    console.log("[ai-analyst] Rate limited, skipping");
    return null;
  }
  lastCallTime = now;

  const prompt = buildAnalystPrompt(markets, positions, accountValue);

  try {
    const { object } = await generateObject({
      model: google(model),
      schema: MarketBriefSchema,
      prompt,
      maxRetries: 1,
    });

    const brief = object as MarketBrief;

    // Filter out weak opportunities
    brief.topOpportunities = brief.topOpportunities
      .filter((o) => o.strength >= 40)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);

    console.log(
      `[ai-analyst] Regime: ${brief.regime} | ${brief.topOpportunities.length} opportunities | ${brief.warnings.length} warnings`,
    );

    return brief;
  } catch (err) {
    console.error("[ai-analyst] Gemini call failed:", (err as Error).message);
    return null;
  }
}
