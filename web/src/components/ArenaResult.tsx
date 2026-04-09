import type { GenerationStats, ModelVariant } from "../lib/types";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";

interface ArenaResultProps {
  variant: ModelVariant;
  output: string;
  stats: GenerationStats | null;
  isStreaming?: boolean;
  isWaiting?: boolean;
}

export function ArenaResult({
  variant,
  output,
  stats,
  isStreaming,
  isWaiting,
}: ArenaResultProps) {
  return (
    <div className="flex-1 flex flex-col border border-neutral-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <span className="font-mono text-sm font-medium">{variant}</span>
        {isStreaming && (
          <span className="text-xs text-blue-400 animate-pulse">generating...</span>
        )}
        {isWaiting && (
          <span className="text-xs text-neutral-500">waiting...</span>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-[200px]">
        {output ? (
          <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
            {output}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-neutral-400 ml-0.5 animate-pulse" />
            )}
          </p>
        ) : isWaiting ? (
          <p className="text-sm text-neutral-600 italic">Waiting for turn...</p>
        ) : null}
      </div>

      {stats && (
        <div className="flex gap-4 px-4 py-2 bg-neutral-900 border-t border-neutral-800 text-xs text-neutral-400">
          <span>{stats.numTokens} tokens</span>
          <span>{formatTokensPerSecond(stats.tps)}</span>
          <span>{formatDuration(stats.totalTime)}</span>
          {stats.ttft !== null && <span>TTFT: {formatDuration(stats.ttft)}</span>}
        </div>
      )}
    </div>
  );
}
