import { useCallback, useRef, useState } from "react";
import type { ModelVariant, GenerationStats, ChatMessage } from "../lib/types";

export interface ArenaRun {
  variant: ModelVariant;
  output: string;
  stats: GenerationStats;
}

export interface ArenaComparison {
  prompt: ChatMessage[];
  images?: string[];
  audios?: string[];
  runs: ArenaRun[];
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
  progress: { file: string; loaded: number; total: number } | null;
}

export function useArena(): UseArenaReturn {
  const workerRef = useRef<Worker | null>(null);
  const [phase, setPhase] = useState<ArenaPhase>("idle");
  const [comparisons, setComparisons] = useState<ArenaComparison[]>([]);
  const [currentRun, setCurrentRun] = useState<UseArenaReturn["currentRun"]>(null);
  const [progress, setProgress] = useState<UseArenaReturn["progress"]>(null);

  const raceStateRef = useRef<{
    messages: ChatMessage[];
    images?: string[];
    audios?: string[];
    e2bRun: ArenaRun | null;
    currentOutput: string;
  } | null>(null);

  const getOrCreateWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(
        new URL("../workers/model-worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (event) => {
        const data = event.data;
        const state = raceStateRef.current;
        if (!state) return;

        switch (data.status) {
          case "progress":
            setProgress({ file: data.file, loaded: data.loaded, total: data.total });
            break;

          case "ready":
            setProgress(null);
            worker.postMessage({
              type: "generate",
              messages: state.messages,
              images: state.images,
              audios: state.audios,
            });
            break;

          case "update":
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
              state.e2bRun = run;
              state.currentOutput = "";
              setPhase("switching");
              setCurrentRun(null);

              worker.postMessage({ type: "unload" });
              setTimeout(() => {
                setPhase("running-e4b");
                worker.postMessage({ type: "load", variant: "E4B" });
              }, 500);
            } else {
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

          case "error":
            setPhase("idle");
            setCurrentRun(null);
            raceStateRef.current = null;
            break;
        }
      };

      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  const startRace = useCallback(
    (messages: ChatMessage[], images?: string[], audios?: string[]) => {
      const worker = getOrCreateWorker();

      raceStateRef.current = {
        messages,
        images,
        audios,
        e2bRun: null,
        currentOutput: "",
      };

      setPhase("running-e2b");
      setCurrentRun(null);
      worker.postMessage({ type: "unload" });
      setTimeout(() => {
        worker.postMessage({ type: "load", variant: "E2B" });
      }, 200);
    },
    [getOrCreateWorker],
  );

  return { phase, comparisons, currentRun, startRace, progress };
}
