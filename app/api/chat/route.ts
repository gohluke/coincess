import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, walletAddress } = await req.json();

  const system = buildSystemPrompt(walletAddress ?? null);
  const tools = createTools(
    walletAddress ?? null,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  );

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system,
    messages,
    tools,
  });

  return result.toUIMessageStreamResponse();
}
