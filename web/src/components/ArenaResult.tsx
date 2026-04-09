import ReactMarkdown from "react-markdown";
import type { GenerationStats, ModelVariant } from "../lib/types";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";

interface ArenaResultProps {
  variant: ModelVariant;
  output: string;
  stats: GenerationStats | null;
  isStreaming?: boolean;
  isWaiting?: boolean;
  winner?: boolean;
  prefetchStatus?: "prefetching" | "prefetched" | null;
}

export function ArenaResult({
  variant,
  output,
  stats,
  isStreaming,
  isWaiting,
  winner,
  prefetchStatus,
}: ArenaResultProps) {
  return (
    <div
      className={`flex-1 flex flex-col rounded-xl overflow-hidden border transition-colors ${
        winner
          ? "border-green-500/40 bg-green-500/5"
          : "border-neutral-800 bg-neutral-900/50"
      }`}
    >
      {/* Header with inline stats */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-neutral-800/50 md:px-4">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="font-mono text-sm font-bold">{variant}</span>
          <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
            {variant === "E2B" ? "2.3B" : "4B"}
          </span>
          {winner && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium hidden sm:inline">
              FASTER (tok/s)
            </span>
          )}
          {winner && (
            <span className="w-2 h-2 rounded-full bg-green-400 sm:hidden" title="Faster" />
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {stats && (
            <div className="flex items-center gap-2 md:gap-3 text-[10px] font-mono text-neutral-400">
              <span className="hidden sm:inline">{stats.numTokens} tok</span>
              <span className={winner ? "text-green-400" : ""}>{formatTokensPerSecond(stats.tps)}</span>
              <span className="hidden sm:inline">{formatDuration(stats.totalTime)}</span>
              {stats.ttft !== null && <span className="hidden md:inline">TTFT {formatDuration(stats.ttft)}</span>}
            </div>
          )}
          {isStreaming && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400">generating</span>
            </div>
          )}
          {isWaiting && (
            <span className="text-xs text-neutral-600">up next</span>
          )}
        </div>
      </div>

      {/* Output with markdown rendering */}
      <div className="flex-1 p-3 overflow-y-auto min-h-[120px] md:p-4 md:min-h-[180px]">
        {output ? (
          <div className="text-sm text-neutral-200 leading-relaxed prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-headings:font-semibold prose-p:text-neutral-200 prose-strong:text-white prose-li:text-neutral-200 prose-code:text-indigo-300 prose-code:bg-neutral-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-neutral-800 prose-pre:border prose-pre:border-neutral-700">
            <ReactMarkdown>{output}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse" />
            )}
          </div>
        ) : isWaiting ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-2xl opacity-20 font-mono">
                {variant === "E4B" ? "4B" : "2B"}
              </div>
              <p className="text-xs text-neutral-600">Waiting for E2B to finish...</p>
              {prefetchStatus === "prefetching" && (
                <p className="text-[10px] text-indigo-400/60 animate-pulse">Pre-downloading model files...</p>
              )}
              {prefetchStatus === "prefetched" && (
                <p className="text-[10px] text-green-400/60">Model files cached, ready to load</p>
              )}
            </div>
          </div>
        ) : isStreaming && !output ? (
          <div className="flex items-center gap-2 text-neutral-500 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Preparing...
          </div>
        ) : null}
      </div>
    </div>
  );
}
