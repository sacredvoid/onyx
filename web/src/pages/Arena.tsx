import { useState, useCallback, useRef, useEffect } from "react";
import { Header } from "../components/Header";
import { ArenaResult } from "../components/ArenaResult";
import { useArena, type ArenaComparison } from "../hooks/useArena";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";
import { getTextContent, progressPercent } from "../lib/types";
import type { MultimodalContent, ChatMessage } from "../lib/types";

export function Arena() {
  const { phase, comparisons, currentRun, startRace, progress, error } = useArena();
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleStart = useCallback(() => {
    if (!text.trim() && !imageFile) return;

    const content: MultimodalContent[] = [];
    const images: string[] = [];

    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      blobUrlsRef.current.push(url);
      content.push({ type: "image", image: url });
      images.push(url);
    }
    content.push({ type: "text", text: text.trim() });

    const messages: ChatMessage[] = [
      { role: "user", content: content.length === 1 ? text.trim() : content },
    ];

    startRace(messages, images.length > 0 ? images : undefined);
    setText("");
    setImageFile(null);
    setImagePreview(null);
  }, [text, imageFile, startRace]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.onerror = () => setImageFile(null);
    reader.readAsDataURL(file);
  };

  const isRunning = phase !== "idle" && phase !== "done";

  const e2bOutput = currentRun?.variant === "E2B" ? currentRun.output : "";
  const e2bStats = currentRun?.variant === "E2B" ? currentRun.stats : null;
  const e4bOutput = currentRun?.variant === "E4B" ? currentRun.output : "";
  const e4bStats = currentRun?.variant === "E4B" ? currentRun.stats : null;

  const latestComparison = comparisons[0];
  const showE2B =
    phase === "running-e2b"
      ? { output: e2bOutput, stats: e2bStats, streaming: true, waiting: false }
      : phase === "switching" || phase === "running-e4b" || phase === "done"
        ? latestComparison
          ? { output: latestComparison.runs[0].output, stats: latestComparison.runs[0].stats, streaming: false, waiting: false }
          : { output: e2bOutput, stats: e2bStats, streaming: false, waiting: false }
        : null;

  const showE4B =
    phase === "running-e4b"
      ? { output: e4bOutput, stats: e4bStats, streaming: true, waiting: false }
      : phase === "running-e2b" || phase === "switching"
        ? { output: "", stats: null, streaming: false, waiting: true }
        : phase === "done" && latestComparison
          ? { output: latestComparison.runs[1].output, stats: latestComparison.runs[1].stats, streaming: false, waiting: false }
          : null;

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-neutral-800 p-4">
          <div className="max-w-4xl mx-auto space-y-3">
            <h1 className="text-lg font-semibold">Arena: E2B vs E4B</h1>
            <p className="text-sm text-neutral-400">
              Same prompt, two models, sequential execution. Compare speed and quality.
            </p>

            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="preview" className="h-16 rounded-lg" />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center"
                >
                  x
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="arena-image" />
              <label htmlFor="arena-image" className="p-2.5 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white cursor-pointer transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="Enter a prompt to compare E2B vs E4B..."
                disabled={isRunning}
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleStart}
                disabled={isRunning || (!text.trim() && !imageFile)}
                className="px-6 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isRunning ? "Racing..." : "Start Race"}
              </button>
            </div>

            {progress && (
              <div className="space-y-1">
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPercent(progress)}%` }} />
                </div>
                <p className="text-xs text-neutral-500 font-mono">{progress.file}</p>
              </div>
            )}

            {phase === "switching" && (
              <p className="text-sm text-yellow-400 animate-pulse">Switching to E4B model...</p>
            )}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
        </div>

        {(showE2B || showE4B) && (
          <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            <ArenaResult variant="E2B" output={showE2B?.output ?? ""} stats={showE2B?.stats ?? null} isStreaming={showE2B?.streaming} isWaiting={showE2B?.waiting} />
            <ArenaResult variant="E4B" output={showE4B?.output ?? ""} stats={showE4B?.stats ?? null} isStreaming={showE4B?.streaming} isWaiting={showE4B?.waiting} />
          </div>
        )}

        {comparisons.length > 1 && (
          <div className="border-t border-neutral-800 p-4 overflow-y-auto max-h-64">
            <h2 className="text-sm font-medium text-neutral-400 mb-3">Previous Comparisons</h2>
            <div className="space-y-3">
              {comparisons.slice(1).map((comp) => (
                <ComparisonSummary key={comp.timestamp} comparison={comp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonSummary({ comparison }: { comparison: ArenaComparison }) {
  const promptText = getTextContent(comparison.prompt[0].content);

  return (
    <div className="bg-neutral-900 rounded-lg p-3 text-xs">
      <p className="text-neutral-300 mb-2 truncate">{promptText}</p>
      <div className="flex gap-4">
        {comparison.runs.map((run) => (
          <div key={run.variant} className="flex gap-3 text-neutral-500">
            <span className="font-mono font-medium text-neutral-400">{run.variant}</span>
            <span>{formatTokensPerSecond(run.stats.tps)}</span>
            <span>{formatDuration(run.stats.totalTime)}</span>
            <span>{run.stats.numTokens} tokens</span>
          </div>
        ))}
      </div>
    </div>
  );
}
