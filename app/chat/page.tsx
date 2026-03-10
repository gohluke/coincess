"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  BarChart3,
  BookOpen,
  TrendingUp,
  LogIn,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";

const QUICK_ACTIONS = [
  { label: "Analyze my trades today", icon: BarChart3, prompt: "Analyze my trades from today. What did I do well and what mistakes did I make?" },
  { label: "Check my positions", icon: TrendingUp, prompt: "What are my current open positions? Am I overexposed anywhere?" },
  { label: "Review my journal", icon: BookOpen, prompt: "Read my recent journal entries and summarize the key lessons I've written down." },
  { label: "Market overview", icon: Sparkles, prompt: "Give me a quick overview of the top markets right now. What's trending?" },
];

function getTextContent(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function getToolParts(msg: UIMessage) {
  return msg.parts.filter((p) => p.type === "tool-invocation") as unknown as Array<{
    type: "tool-invocation";
    toolInvocation: { toolName: string; state: string; toolCallId: string };
  }>;
}

export default function ChatPage() {
  const { address, connect, loading: walletLoading } = useEffectiveAddress();
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<{ id: string; preview: string; createdAt: number }[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { walletAddress: address } }),
    [address],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `chat-${chatKey}`,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        const preview = getTextContent(firstUserMsg).slice(0, 60);
        const id = `conv-${chatKey}`;
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === id);
          if (existing) {
            return prev.map((c) => (c.id === id ? { ...c, preview } : c));
          }
          return [{ id, preview, createdAt: Date.now() }, ...prev];
        });
      }
    }
  }, [messages, chatKey]);

  const startNewConversation = () => {
    setChatKey((k) => k + 1);
    setMessages([]);
    setShowSidebar(false);
  };

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  if (!address && !walletLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white flex items-center justify-center pb-20">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-[#2a2e3e] mx-auto" />
          <h2 className="text-lg font-semibold">AI Trading Coach</h2>
          <p className="text-sm text-[#848e9c]">Connect a wallet to get personalized trading advice</p>
          <button onClick={connect} className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors flex items-center gap-2 mx-auto">
            <LogIn className="h-4 w-4" /> Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <div className="border-b border-[#2a2e3e] px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-[#848e9c] hover:text-white transition-colors md:hidden"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              <Bot className="h-4 w-4 text-brand" />
              AI Trading Coach
            </h1>
            <p className="text-[10px] text-[#848e9c]">Powered by Gemini with live Hyperliquid data</p>
          </div>
        </div>
        <button
          onClick={startNewConversation}
          className="px-3 py-1.5 text-xs text-[#848e9c] border border-[#2a2e3e] rounded-lg hover:text-white hover:border-[#3a3e4e] transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> New Chat
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        {showSidebar && (
          <div className="absolute inset-0 z-10 bg-black/50 md:hidden" onClick={() => setShowSidebar(false)} />
        )}
        <div className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } absolute md:relative z-20 w-64 bg-[#0b0e11] border-r border-[#2a2e3e] h-full overflow-y-auto transition-transform duration-200`}>
          <div className="p-3 space-y-1">
            <button
              onClick={startNewConversation}
              className="w-full px-3 py-2 text-xs text-[#848e9c] border border-[#2a2e3e] border-dashed rounded-lg hover:text-white hover:border-[#3a3e4e] transition-colors flex items-center gap-2"
            >
              <Plus className="h-3 w-3" /> New conversation
            </button>
            {conversations.map((c) => (
              <button
                key={c.id}
                className={`w-full px-3 py-2 text-xs rounded-lg text-left truncate transition-colors ${
                  `conv-${chatKey}` === c.id
                    ? "bg-brand/10 text-brand"
                    : "text-[#848e9c] hover:bg-[#141620] hover:text-white"
                }`}
              >
                {c.preview || "New chat"}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bot className="h-12 w-12 text-[#2a2e3e] mb-4" />
                <h2 className="text-base font-semibold mb-1">How can I help you trade better?</h2>
                <p className="text-xs text-[#848e9c] mb-6 max-w-sm">
                  I can analyze your trades, check your positions, read your journal, and give you real-time market insights.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleSend(action.prompt)}
                        disabled={isLoading}
                        className="flex items-center gap-2.5 px-4 py-3 bg-[#141620] border border-[#2a2e3e] rounded-xl text-left hover:border-brand/30 hover:bg-[#1a1d2e] transition-colors disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 text-brand shrink-0" />
                        <span className="text-xs text-[#c0c4cc]">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const text = getTextContent(msg);
                const toolParts = getToolParts(msg);

                return (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-brand/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-4 w-4 text-brand" />
                      </div>
                    )}
                    <div className={`max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-brand text-white rounded-2xl rounded-br-md px-4 py-2.5"
                        : "bg-[#141620] border border-[#2a2e3e] rounded-2xl rounded-bl-md px-4 py-2.5"
                    }`}>
                      {text && (
                        <div className={msg.role === "assistant" ? "journal-prose text-xs" : "text-xs leading-relaxed whitespace-pre-wrap"}>
                          {msg.role === "assistant" ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                          ) : (
                            text
                          )}
                        </div>
                      )}
                      {toolParts.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {toolParts.map((tp) => (
                            <div key={tp.toolInvocation.toolCallId} className="flex items-center gap-1.5 text-[10px] text-[#848e9c] bg-[#0b0e11] rounded px-2 py-1">
                              <Sparkles className="h-3 w-3 text-brand" />
                              <span>
                                {tp.toolInvocation.toolName === "getPositions" && "Fetching positions..."}
                                {tp.toolInvocation.toolName === "getRecentFills" && "Fetching trade history..."}
                                {tp.toolInvocation.toolName === "getMarketData" && "Fetching market data..."}
                                {tp.toolInvocation.toolName === "readJournal" && "Reading journal..."}
                              </span>
                              {tp.toolInvocation.state === "result" ? (
                                <span className="text-emerald-400/70">done</span>
                              ) : (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-lg bg-[#2a2e3e] flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-[#848e9c]" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-brand" />
                </div>
                <div className="bg-[#141620] border border-[#2a2e3e] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-[#848e9c]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[#2a2e3e] px-4 sm:px-6 py-3">
            <form onSubmit={handleFormSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your trades, positions, or market..."
                disabled={isLoading}
                className="flex-1 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
