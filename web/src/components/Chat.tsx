import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, GenerationStats } from "../lib/types";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";

interface ChatProps {
  messages: ChatMessage[];
  streamingOutput?: string;
  isGenerating: boolean;
  stats: GenerationStats | null;
}

export function Chat({ messages, streamingOutput, isGenerating, stats }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingOutput]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {isGenerating && streamingOutput && (
          <MessageBubble
            message={{ role: "assistant", content: streamingOutput }}
            isStreaming
          />
        )}

        {stats && !isGenerating && (
          <div className="flex gap-4 text-xs text-neutral-500 pl-1">
            <span>{stats.numTokens} tokens</span>
            <span>{formatTokensPerSecond(stats.tps)}</span>
            <span>{formatDuration(stats.totalTime)}</span>
            {stats.ttft !== null && (
              <span>TTFT: {formatDuration(stats.ttft)}</span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
