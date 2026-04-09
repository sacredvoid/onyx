import { useCallback, useRef, useState } from "react";
import type {
  ModelVariant,
  GenerationStats,
  ChatMessage,
  ProgressInfo,
  WorkerResponse,
} from "../lib/types";

export interface ArenaRun {
  variant: ModelVariant;
  output: string;
  stats: GenerationStats;
}

export interface ArenaComparison {
  prompt: ChatMessage[];
  images?: string[];
  audios?: string[];
  runs: [ArenaRun, ArenaRun];
  timestamp: number;
}

type ArenaPhase = "idle" | "running-e2b" | "switching" | "running-e4b" | "done";

interface UseArenaReturn {
  phase: ArenaPhase;
  comparisons: ArenaComparison[];
  currentRun: {
    variant: ModelVariant;
    output: string;
    stats: GenerationStats | null;
  } | null;
  startRace: (
    messages: ChatMessage[],
    images?: string[],
    audios?: string[],
  ) => void;
  progress: ProgressInfo | null;
  error: string | null;
}

export function useArena(): UseArenaReturn {
  const workerRef = useRef<Worker | null>(null);
  const [phase, setPhase] = useState<ArenaPhase>("idle");
  const [comparisons, setComparisons] = useState<ArenaComparison[]>([]);
  const [currentRun, setCurrentRun] = useState<UseArenaReturn["currentRun"]>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track whether we need to load E4B after unload completes
  const pendingE4BLoadRef = useRef(false);
  // Track whether we need to load E2B after initial unload
  const pendingE2BLoadRef = useRef(false);

  const raceStateRef = useRef<{
    messages: ChatMessage[];
    images?: string[];
    audios?: string[];
    e2bRun: ArenaRun | null;
    currentOutput: string;
  } | null>(null);

  const resetRace = useCallback((errorMsg?: string) => {
    setPhase("idle");
    setCurrentRun(null);
    setProgress(null);
    pendingE4BLoadRef.current = false;
    pendingE2BLoadRef.current = false;
    raceStateRef.current = null;
    if (errorMsg) setError(errorMsg);
  }, []);

  const getOrCreateWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(
        new URL("../workers/model-worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        const state = raceStateRef.current;

        switch (data.status) {
          case "progress":
            setProgress({ file: data.file, loaded: data.loaded, total: data.total });
            break;

          case "ready":
            if (!state) break;
            setProgress(null);
            worker.postMessage({
              type: "generate",
              messages: state.messages,
              images: state.images,
              audios: state.audios,
            });
            break;

          case "update":
            if (!state) break;
            state.currentOutput += data.token;
            setCurrentRun({
              variant: state.e2bRun ? "E4B" : "E2B",
              output: state.currentOutput,
              stats: {
                numTokens: data.numTokens,
                tps: data.tps,
                totalTime: data.elapsed,
                ttft: data.ttft,
              },
            });
            break;

          case "complete": {
            if (!state) break;
            const run: ArenaRun = {
              variant: state.e2bRun ? "E4B" : "E2B",
              output: state.currentOutput,
              stats: {
                numTokens: data.numTokens,
                tps: data.tps,
                totalTime: data.totalTime,
                ttft: data.ttft,
              },
            };

            if (!state.e2bRun) {
              // E2B finished, switch to E4B
              state.e2bRun = run;
              state.currentOutput = "";
              setPhase("switching");
              setCurrentRun(null);
              pendingE4BLoadRef.current = true;
              worker.postMessage({ type: "unload" });
            } else {
              // E4B finished, race complete
              const comparison: ArenaComparison = {
                prompt: state.messages,
                images: state.images,
                audios: state.audios,
                runs: [state.e2bRun, run],
                timestamp: Date.now(),
              };
              setComparisons((prev) => [comparison, ...prev]);
              setPhase("done");
              setCurrentRun(null);
              raceStateRef.current = null;
            }
            break;
          }

          case "unloaded":
            setProgress(null);
            // Load E4B after E2B unloaded
            if (pendingE4BLoadRef.current) {
              pendingE4BLoadRef.current = false;
              setPhase("running-e4b");
              worker.postMessage({ type: "load", variant: "E4B" });
            }
            // Load E2B at race start after cleaning up
            if (pendingE2BLoadRef.current) {
              pendingE2BLoadRef.current = false;
              worker.postMessage({ type: "load", variant: "E2B" });
            }
            break;

          case "interrupted":
            resetRace();
            break;

          case "error":
            resetRace(data.error);
            break;
        }
      };

      worker.onerror = (event) => {
        resetRace(event.message || "Worker crashed unexpectedly. Try reloading the page.");
        workerRef.current = null;
      };

      workerRef.current = worker;
    }
    return workerRef.current;
  }, [resetRace]);

  const startRace = useCallback(
    (messages: ChatMessage[], images?: string[], audios?: string[]) => {
      const worker = getOrCreateWorker();
      setError(null);

      raceStateRef.current = {
        messages,
        images,
        audios,
        e2bRun: null,
        currentOutput: "",
      };

      setPhase("running-e2b");
      setCurrentRun(null);
      // Unload any existing model, then load E2B on "unloaded" confirmation
      pendingE2BLoadRef.current = true;
      worker.postMessage({ type: "unload" });
    },
    [getOrCreateWorker],
  );

  return { phase, comparisons, currentRun, startRace, progress, error };
}
