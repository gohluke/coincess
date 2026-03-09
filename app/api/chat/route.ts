import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, walletAddress } = await req.json();

    const system = buildSystemPrompt(walletAddress ?? null);
    const tools = createTools(
      walletAddress ?? null,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    );

    const modelMessages = await convertToModelMessages(messages as UIMessage[]);

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system,
      messages: modelMessages,
      tools,
      maxRetries: 1,
    });

    return result.toUIMessageStreamResponse();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
