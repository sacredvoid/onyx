import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  load_image,
  read_audio,
  InterruptableStoppingCriteria,
  type PreTrainedModel,
  type Processor,
} from "@huggingface/transformers";

import type { ModelVariant, ChatMessage } from "../lib/types";

const MODEL_IDS: Record<ModelVariant, string> = {
  E2B: "onnx-community/gemma-4-E2B-it-ONNX",
  E4B: "onnx-community/gemma-4-E4B-it-ONNX",
};

let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let currentVariant: ModelVariant | null = null;
const stoppingCriteria = new InterruptableStoppingCriteria();

// Sequential task queue - chains async operations so they can't overlap
let taskQueue = Promise.resolve();

// Aggregate progress across all files, throttle updates, and ensure monotonic increase
const fileProgress = new Map<string, { loaded: number; total: number }>();
let lastProgressPost = 0;
let lastPostedLoaded = 0;
let lastPostedTotal = 0;
const PROGRESS_THROTTLE_MS = 150;

function resetProgress() {
  fileProgress.clear();
  lastProgressPost = 0;
  lastPostedLoaded = 0;
  lastPostedTotal = 0;
}

function handleProgress(info: any, variant: ModelVariant) {
  if (info.status !== "progress") return;

  fileProgress.set(info.file, { loaded: info.loaded, total: info.total });

  const now = performance.now();
  if (now - lastProgressPost < PROGRESS_THROTTLE_MS) return;
  lastProgressPost = now;

  let totalLoaded = 0;
  let totalSize = 0;
  for (const [, v] of fileProgress) {
    totalLoaded += v.loaded;
    totalSize += v.total;
  }

  // Keep total monotonically increasing so the bar never shrinks
  if (totalSize < lastPostedTotal) totalSize = lastPostedTotal;
  // Keep loaded monotonically increasing
  if (totalLoaded < lastPostedLoaded) totalLoaded = lastPostedLoaded;
  // Don't let loaded exceed total
  if (totalLoaded > totalSize) totalLoaded = totalSize;

  lastPostedLoaded = totalLoaded;
  lastPostedTotal = totalSize;

  self.postMessage({
    status: "progress",
    file: info.file,
    loaded: totalLoaded,
    total: totalSize,
    variant,
  });
}

interface GenerateMessage {
  type: "generate";
  messages: ChatMessage[];
  images?: string[];
  audios?: string[];
  maxNewTokens?: number;
  enableThinking?: boolean;
}

type WorkerMessage =
  | { type: "load"; variant: ModelVariant }
  | GenerateMessage
  | { type: "interrupt" }
  | { type: "unload" }
  | { type: "prefetch"; variant: ModelVariant };

let prefetchAbort: AbortController | null = null;
let prefetchedVariant: ModelVariant | null = null;

async function prefetchModel(variant: ModelVariant) {
  // Skip if already prefetched or currently loaded
  if (prefetchedVariant === variant || currentVariant === variant) return;

  prefetchAbort = new AbortController();

  try {
    const modelId = MODEL_IDS[variant];

    // Download processor files to cache (lightweight, mostly config/tokenizer)
    await AutoProcessor.from_pretrained(modelId);

    // Download model weights to cache without GPU compilation
    // Using dtype "q4f16" ensures we cache the same quantized files
    // that loadModel will need. device: null avoids GPU allocation.
    if (!prefetchAbort.signal.aborted) {
      await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
        dtype: "q4f16",
        device: "wasm" as any,
        progress_callback: (info: any) => {
          if (prefetchAbort?.signal.aborted) return;
          if (info.status === "progress") {
            self.postMessage({
              status: "prefetch-progress",
              file: info.file,
              loaded: info.loaded,
              total: info.total,
              variant,
            });
          }
        },
      });
    }

    if (!prefetchAbort.signal.aborted) {
      prefetchedVariant = variant;
      self.postMessage({ status: "prefetch-done", variant });
    }
  } catch {
    // Prefetch is best-effort - failures are fine
  } finally {
    prefetchAbort = null;
  }
}

function cancelPrefetch() {
  if (prefetchAbort) {
    prefetchAbort.abort();
    prefetchAbort = null;
  }
}

async function loadModel(variant: ModelVariant) {
  if (currentVariant === variant && model && processor) {
    self.postMessage({ status: "ready", variant });
    return;
  }

  try {
    // Unload existing model
    if (model) {
      await (model as any).dispose?.();
      model = null;
      processor = null;
      currentVariant = null;
    }

    self.postMessage({ status: "loading", variant });
    resetProgress();

    const modelId = MODEL_IDS[variant];

    processor = await AutoProcessor.from_pretrained(modelId, {
      progress_callback: (info: any) => handleProgress(info, variant),
    });

    model = await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
      dtype: "q4f16",
      device: "webgpu",
      progress_callback: (info: any) => handleProgress(info, variant),
    });

    currentVariant = variant;
    self.postMessage({ status: "ready", variant });
  } catch (e) {
    model = null;
    processor = null;
    currentVariant = null;
    self.postMessage({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function generate(data: GenerateMessage) {
  if (!model || !processor) {
    self.postMessage({ status: "error", error: "Model not loaded" });
    return;
  }

  let numTokens = 0;
  let startTime = performance.now();
  let firstTokenTime: number | null = null;

  try {
    stoppingCriteria.reset();

    const prompt = (processor as any).apply_chat_template(data.messages, {
      enable_thinking: data.enableThinking ?? false,
      add_generation_prompt: true,
    });

    // Process multimodal inputs
    const images = data.images
      ? await Promise.all(data.images.map((src) => load_image(src)))
      : null;
    const audios = data.audios
      ? await Promise.all(data.audios.map((src) => read_audio(src, 16000)))
      : null;

    // Processor signature is (text, image, audio, options) - always pass all 4 args
    const imageArg = images && images.length > 0 ? images[0] : null;
    const audioArg = audios && audios.length > 0 ? audios[0] : null;

    const inputs = await (processor as any)(prompt, imageArg, audioArg, {
      add_special_tokens: false,
    });

    startTime = performance.now();

    const streamer = new TextStreamer((processor as any).tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => {
        numTokens++;
        if (firstTokenTime === null) firstTokenTime = performance.now();

        const elapsed = performance.now() - startTime;
        const tps = elapsed > 0 ? numTokens / (elapsed / 1000) : 0;

        self.postMessage({
          status: "update",
          token,
          numTokens,
          tps,
          elapsed,
          ttft: firstTokenTime ? firstTokenTime - startTime : null,
        });
      },
    });

    await model.generate({
      ...inputs,
      max_new_tokens: data.maxNewTokens ?? 1024,
      do_sample: false,
      streamer,
      stopping_criteria: [stoppingCriteria],
    });

    const totalTime = performance.now() - startTime;
    self.postMessage({
      status: "complete",
      numTokens,
      tps: totalTime > 0 ? numTokens / (totalTime / 1000) : 0,
      totalTime,
      ttft: firstTokenTime ? firstTokenTime - startTime : null,
    });
  } catch (e) {
    if ((e as Error).message?.includes("interrupted")) {
      self.postMessage({ status: "interrupted" });
    } else {
      self.postMessage({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  // Interrupt is always allowed and runs immediately
  if (type === "interrupt") {
    stoppingCriteria.interrupt();
    return;
  }

  // Prefetch runs outside the queue (it's background, non-blocking)
  if (type === "prefetch") {
    prefetchModel(event.data.variant);
    return;
  }

  // Queue all other operations so they execute sequentially
  taskQueue = taskQueue.then(async () => {
    switch (type) {
      case "load":
        cancelPrefetch();
        await loadModel(event.data.variant);
        break;
      case "generate":
        await generate(event.data as any);
        break;
      case "unload":
        cancelPrefetch();
        if (model) {
          try {
            await (model as any).dispose?.();
          } catch {
            // dispose may fail if GPU context is already lost
          }
          model = null;
          processor = null;
          currentVariant = null;
        }
        self.postMessage({ status: "unloaded" });
        break;
    }
  });
});
