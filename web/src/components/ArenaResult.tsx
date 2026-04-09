import type { GenerationStats, ModelVariant } from "../lib/types";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";

interface ArenaResultProps {
  variant: ModelVariant;
  output: string;
  stats: GenerationStats | null;
  isStreaming?: boolean;
  isWaiting?: boolean;
  winner?: boolean;
}

export function ArenaResult({
  variant,
  output,
  stats,
  isStreaming,
  isWaiting,
  winner,
}: ArenaResultProps) {
  return (
    <div
      className={`flex-1 flex flex-col rounded-xl overflow-hidden border transition-colors ${
        winner
          ? "border-green-500/40 bg-green-500/5"
          : "border-neutral-800 bg-neutral-900/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold">{variant}</span>
          <span className="text-[10px] text-neutral-500 font-mono">
            {variant === "E2B" ? "2.3B params" : "4B params"}
          </span>
          {winner && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
              FASTER
            </span>
          )}
        </div>
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

      {/* Output */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[180px]">
        {output ? (
          <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
            {output}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse" />
            )}
          </p>
        ) : isWaiting ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-2xl opacity-20">
                {variant === "E4B" ? "4B" : "2B"}
              </div>
              <p className="text-xs text-neutral-600">Waiting for E2B to finish...</p>
            </div>
          </div>
        ) : isStreaming && !output ? (
          <div className="flex items-center gap-2 text-neutral-500 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Preparing...
          </div>
        ) : null}
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-1 px-4 py-2.5 border-t border-neutral-800/50 bg-neutral-900/80">
          <StatCell label="Tokens" value={String(stats.numTokens)} />
          <StatCell label="Speed" value={formatTokensPerSecond(stats.tps)} />
          <StatCell label="Total" value={formatDuration(stats.totalTime)} />
          <StatCell label="TTFT" value={stats.ttft !== null ? formatDuration(stats.ttft) : "-"} />
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-mono text-neutral-300">{value}</div>
    </div>
  );
}
