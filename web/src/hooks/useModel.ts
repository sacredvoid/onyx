import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ModelVariant,
  ModelStatus,
  ProgressInfo,
  GenerationStats,
  ChatMessage,
  WorkerResponse,
} from "../lib/types";

interface UseModelReturn {
  status: ModelStatus;
  progress: ProgressInfo | null;
  output: string;
  stats: GenerationStats | null;
  loadModel: (variant: ModelVariant) => void;
  generate: (
    messages: ChatMessage[],
    images?: string[],
    audios?: string[],
  ) => void;
  interrupt: () => void;
  unload: () => void;
  error: string | null;
  currentVariant: ModelVariant | null;
}

export function useModel(): UseModelReturn {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [output, setOutput] = useState("");
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentVariant, setCurrentVariant] = useState<ModelVariant | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/model-worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;

      switch (data.status) {
        case "loading":
          setStatus("loading");
          setProgress(null);
          break;
        case "progress":
          setProgress({
            file: data.file,
            loaded: data.loaded,
            total: data.total,
          });
          break;
        case "ready":
          setStatus("ready");
          setProgress(null);
          setCurrentVariant(data.variant);
          break;
        case "update":
          setOutput((prev) => prev + data.token);
          setStats({
            numTokens: data.numTokens,
            tps: data.tps,
            totalTime: data.elapsed,
            ttft: data.ttft,
          });
          break;
        case "complete":
          setStatus("ready");
          setStats({
            numTokens: data.numTokens,
            tps: data.tps,
            totalTime: data.totalTime,
            ttft: data.ttft,
          });
          break;
        case "interrupted":
          setStatus("ready");
          break;
        case "unloaded":
          setStatus("idle");
          setCurrentVariant(null);
          break;
        case "error":
          setStatus("error");
          setError(data.error);
          break;
      }
    };

    worker.onerror = (event) => {
      setStatus("error");
      setError(event.message || "Worker crashed unexpectedly. Try reloading the page.");
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const loadModel = useCallback((variant: ModelVariant) => {
    if (!workerRef.current) {
      setError("Worker not initialized. Try reloading the page.");
      setStatus("error");
      return;
    }
    setError(null);
    workerRef.current.postMessage({ type: "load", variant });
  }, []);

  const generate = useCallback(
    (messages: ChatMessage[], images?: string[], audios?: string[]) => {
      if (!workerRef.current) {
        setError("Worker not initialized. Try reloading the page.");
        setStatus("error");
        return;
      }
      setOutput("");
      setStats(null);
      setStatus("generating");
      workerRef.current.postMessage({
        type: "generate",
        messages,
        images,
        audios,
      });
    },
    [],
  );

  const interrupt = useCallback(() => {
    workerRef.current?.postMessage({ type: "interrupt" });
  }, []);

  const unload = useCallback(() => {
    workerRef.current?.postMessage({ type: "unload" });
  }, []);

  return {
    status,
    progress,
    output,
    stats,
    loadModel,
    generate,
    interrupt,
    unload,
    error,
    currentVariant,
  };
}
