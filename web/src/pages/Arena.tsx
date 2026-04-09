import { useState, useCallback, useRef, useEffect } from "react";
import { Header } from "../components/Header";
import { ArenaResult } from "../components/ArenaResult";
import { useArena, type ArenaComparison } from "../hooks/useArena";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";
import { getTextContent, progressPercent } from "../lib/types";
import type { MultimodalContent, ChatMessage } from "../lib/types";

const SAMPLE_PROMPTS = [
  "Explain quantum entanglement in simple terms",
  "Write a haiku about programming",
  "What are the three laws of thermodynamics?",
  "Compare Python and Rust in 3 sentences",
];

export function Arena() {
  const { phase, comparisons, currentRun, e2bResult, e4bPrefetched, startRace, progress, error } = useArena();
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleStart = useCallback((promptOverride?: string) => {
    const prompt = promptOverride ?? text.trim();
    if (!prompt && !imageFile) return;

    const content: MultimodalContent[] = [];
    const images: string[] = [];

    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      blobUrlsRef.current.push(url);
      content.push({ type: "image", image: url });
      images.push(url);
    }
    content.push({ type: "text", text: prompt });

    const messages: ChatMessage[] = [
      { role: "user", content: content.length === 1 ? prompt : content },
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

  const e2bLive = currentRun?.variant === "E2B" ? currentRun : null;
  const e4bLive = currentRun?.variant === "E4B" ? currentRun : null;
  const latestComparison = comparisons[0];

  const showE2B =
    phase === "running-e2b"
      ? { output: e2bLive?.output ?? "", stats: e2bLive?.stats ?? null, streaming: true, waiting: false }
      : phase === "switching" || phase === "running-e4b"
        ? e2bResult
          ? { output: e2bResult.output, stats: e2bResult.stats, streaming: false, waiting: false }
          : { output: "", stats: null, streaming: false, waiting: false }
        : phase === "done" && latestComparison
          ? { output: latestComparison.runs[0].output, stats: latestComparison.runs[0].stats, streaming: false, waiting: false }
          : null;

  const showE4B =
    phase === "running-e4b"
      ? { output: e4bLive?.output ?? "", stats: e4bLive?.stats ?? null, streaming: true, waiting: false }
      : phase === "running-e2b" || phase === "switching"
        ? { output: "", stats: null, streaming: false, waiting: true }
        : phase === "done" && latestComparison
          ? { output: latestComparison.runs[1].output, stats: latestComparison.runs[1].stats, streaming: false, waiting: false }
          : null;

  const e2bWins = !!(
    phase === "done" &&
    latestComparison &&
    latestComparison.runs[0].stats.tps > latestComparison.runs[1].stats.tps
  );
  const e4bWins = !!(
    phase === "done" &&
    latestComparison &&
    latestComparison.runs[1].stats.tps > latestComparison.runs[0].stats.tps
  );

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Empty state with centered prompt */}
        {phase === "idle" && comparisons.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-3 md:p-4">
            <div className="max-w-2xl w-full space-y-6 md:space-y-8">
              <div className="text-center space-y-2">
                <img
                  src={`${import.meta.env.BASE_URL}onix.webp`}
                  alt="Onix"
                  className="w-14 h-14 mx-auto object-contain opacity-60"
                />
                <h1 className="text-2xl font-bold md:text-3xl">E2B vs E4B</h1>
                <p className="text-neutral-400">
                  Same prompt, two models. See how they compare on speed and quality.
                </p>
              </div>

              {/* Input area */}
              <div className="space-y-3">
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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex gap-2 flex-1 min-w-0">
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="arena-image" />
                    <label htmlFor="arena-image" className="p-2.5 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white cursor-pointer transition-colors border border-neutral-700 shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </label>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleStart()}
                      placeholder="Enter a prompt to race..."
                      className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => handleStart()}
                    disabled={!text.trim() && !imageFile}
                    className="px-6 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    Start Race
                  </button>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              {/* Sample prompts */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Try a sample</p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleStart(p)}
                      className="px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-neutral-800/50 sm:grid-cols-3">
                <StepCard step="1" title="Load E2B" desc="~3.2 GB model loads and runs your prompt" />
                <StepCard step="2" title="Switch to E4B" desc="Unloads E2B, loads the larger ~5 GB model" />
                <StepCard step="3" title="Compare" desc="Side-by-side results with speed and quality stats" />
              </div>
            </div>
          </div>
        ) : (
          /* Active race / results view */
          <>
            {/* Compact top bar with input when race is active */}
            <div className="border-b border-neutral-800 px-4 py-3">
              <div className="max-w-5xl mx-auto">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">Arena</span>
                    {phase === "running-e2b" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono">E2B running</span>
                    )}
                    {phase === "switching" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-mono animate-pulse">switching</span>
                    )}
                    {phase === "running-e4b" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono">E4B running</span>
                    )}
                    {phase === "done" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-mono">done</span>
                    )}
                  </div>

                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleStart()}
                      placeholder="New prompt..."
                      disabled={isRunning}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                    />
                    <button
                      onClick={() => handleStart()}
                      disabled={isRunning || (!text.trim() && !imageFile)}
                      className="px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isRunning ? "Racing..." : "Race"}
                    </button>
                  </div>
                </div>

                {progress && (
                  <div className="mt-2">
                    <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent(progress)}%` }} />
                    </div>
                  </div>
                )}

                {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
              </div>
            </div>

            {/* Side-by-side results */}
            <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden md:flex-row">
              <ArenaResult
                variant="E2B"
                output={showE2B?.output ?? ""}
                stats={showE2B?.stats ?? null}
                isStreaming={showE2B?.streaming}
                isWaiting={showE2B?.waiting}
                winner={e2bWins}
              />
              <ArenaResult
                variant="E4B"
                output={showE4B?.output ?? ""}
                stats={showE4B?.stats ?? null}
                isStreaming={showE4B?.streaming}
                isWaiting={showE4B?.waiting}
                winner={e4bWins}
                prefetchStatus={
                  showE4B?.waiting
                    ? e4bPrefetched ? "prefetched" : "prefetching"
                    : null
                }
              />
            </div>

            {/* Previous comparisons */}
            {comparisons.length > 1 && (
              <div className="border-t border-neutral-800 px-4 py-3 overflow-y-auto max-h-48">
                <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Previous Races</h2>
                <div className="space-y-2">
                  {comparisons.slice(1).map((comp) => (
                    <ComparisonSummary key={comp.timestamp} comparison={comp} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="text-center space-y-1">
      <div className="w-7 h-7 rounded-full bg-neutral-800 text-neutral-400 text-xs font-mono flex items-center justify-center mx-auto">
        {step}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-neutral-500">{desc}</p>
    </div>
  );
}

function ComparisonSummary({ comparison }: { comparison: ArenaComparison }) {
  const promptText = getTextContent(comparison.prompt[0].content);
  const faster = comparison.runs[0].stats.tps > comparison.runs[1].stats.tps ? 0 : 1;

  return (
    <div className="bg-neutral-900/50 rounded-lg px-3 py-2 text-xs flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <p className="text-neutral-400 truncate sm:flex-1">{promptText}</p>
      <div className="flex items-center gap-4">
        {comparison.runs.map((run, i) => (
          <div key={run.variant} className={`flex items-center gap-2 shrink-0 ${i === faster ? "text-green-400" : "text-neutral-500"}`}>
            <span className="font-mono font-medium">{run.variant}</span>
            <span>{formatTokensPerSecond(run.stats.tps)}</span>
            <span>{formatDuration(run.stats.totalTime)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
