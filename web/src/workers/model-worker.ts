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

type ModelVariant = "E2B" | "E4B";

const MODEL_IDS: Record<ModelVariant, string> = {
  E2B: "onnx-community/gemma-4-E2B-it-ONNX",
  E4B: "onnx-community/gemma-4-E4B-it-ONNX",
};

let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let currentVariant: ModelVariant | null = null;
const stoppingCriteria = new InterruptableStoppingCriteria();

// Aggregate progress across all files and throttle updates
const fileProgress = new Map<string, { loaded: number; total: number }>();
let lastProgressPost = 0;
const PROGRESS_THROTTLE_MS = 100;

function resetProgress() {
  fileProgress.clear();
  lastProgressPost = 0;
}

function handleProgress(info: any, variant: ModelVariant) {
  if (info.status !== "progress") return;

  fileProgress.set(info.file, { loaded: info.loaded, total: info.total });

  const now = performance.now();
  if (now - lastProgressPost < PROGRESS_THROTTLE_MS) return;
  lastProgressPost = now;

  let totalLoaded = 0;
  let totalSize = 0;
  let currentFile = info.file;
  for (const [, v] of fileProgress) {
    totalLoaded += v.loaded;
    totalSize += v.total;
  }

  self.postMessage({
    status: "progress",
    file: currentFile,
    loaded: totalLoaded,
    total: totalSize,
    variant,
  });
}

interface LoadMessage {
  type: "load";
  variant: ModelVariant;
}

interface GenerateMessage {
  type: "generate";
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image?: string; audio?: string }>;
  }>;
  images?: string[];
  audios?: string[];
  maxNewTokens?: number;
  enableThinking?: boolean;
}

interface InterruptMessage {
  type: "interrupt";
}

interface UnloadMessage {
  type: "unload";
}

type WorkerMessage = LoadMessage | GenerateMessage | InterruptMessage | UnloadMessage;

async function loadModel(variant: ModelVariant) {
  if (currentVariant === variant && model && processor) {
    self.postMessage({ status: "ready", variant });
    return;
  }

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
}

async function generate(data: GenerateMessage) {
  if (!model || !processor) {
    self.postMessage({ status: "error", error: "Model not loaded" });
    return;
  }

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
    ? await Promise.all(data.audios.map((src) => read_audio(src)))
    : null;

  const processorArgs: any[] = [prompt];
  if (images && images.length > 0) processorArgs.push(images[0]);
  else processorArgs.push(null);
  if (audios && audios.length > 0) processorArgs.push(audios[0]);

  const inputs = await (processor as any)(...processorArgs, {
    add_special_tokens: false,
  });

  let numTokens = 0;
  const startTime = performance.now();
  let firstTokenTime: number | null = null;

  const streamer = new TextStreamer((processor as any).tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => {
      numTokens++;
      if (firstTokenTime === null) firstTokenTime = performance.now();

      const elapsed = performance.now() - startTime;
      const tps = numTokens / (elapsed / 1000);

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

  try {
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
      tps: numTokens / (totalTime / 1000),
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

self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case "load":
      await loadModel(event.data.variant);
      break;
    case "generate":
      await generate(event.data);
      break;
    case "interrupt":
      stoppingCriteria.interrupt();
      break;
    case "unload":
      if (model) {
        await (model as any).dispose?.();
        model = null;
        processor = null;
        currentVariant = null;
      }
      self.postMessage({ status: "unloaded" });
      break;
  }
});
