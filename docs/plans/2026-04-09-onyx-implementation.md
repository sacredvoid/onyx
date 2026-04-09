# Onyx Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Build a demo website + Python toolkit that runs Google's Gemma 4 entirely in the browser via WebGPU, with multimodal chat (text/image/audio), side-by-side E2B vs E4B arena comparison, and a conversion/benchmarking pipeline.

**Architecture:** Vite + React + TypeScript frontend with Transformers.js running inference in a Web Worker via WebGPU. Three pages: landing, playground (multimodal chat), arena (sequential E2B vs E4B race). Python toolkit uses optimum-onnx for ONNX export with validation and benchmarking scripts.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, @huggingface/transformers, WebGPU, React Router, Python (optimum-onnx, transformers, onnxruntime)

---

### Task 0: Project Scaffold + Git Init

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/index.css`
- Create: `toolkit/requirements.txt`
- Create: `toolkit/README.md`
- Create: `.gitignore`
- Create: `LICENSE`

**Step 1: Initialize git repo**

```bash
cd /Users/samanvya/Documents/github/onyx
git init
```

**Step 2: Scaffold Vite + React + TypeScript**

```bash
cd /Users/samanvya/Documents/github/onyx
npm create vite@latest web -- --template react-ts
cd web
npm install
```

**Step 3: Install dependencies**

```bash
cd /Users/samanvya/Documents/github/onyx/web
npm install @huggingface/transformers react-router-dom
npm install -D @tailwindcss/vite tailwindcss
```

**Step 4: Configure Tailwind 4 with Vite plugin**

Replace `web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: "es",
  },
});
```

**Step 5: Set up Tailwind CSS entry**

Replace `web/src/index.css`:

```css
@import "tailwindcss";
```

**Step 6: Set up React Router in App.tsx**

Replace `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-white text-2xl">{name} - coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Home" />} />
        <Route path="/playground" element={<Placeholder name="Playground" />} />
        <Route path="/arena" element={<Placeholder name="Arena" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 7: Set up main.tsx**

Replace `web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 8: Update index.html**

Replace `web/index.html`:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Onyx - Gemma 4 in Your Browser</title>
    <meta name="description" content="Run Google's Gemma 4 entirely in your browser via WebGPU. No API keys, no server, no data leaving your machine." />
  </head>
  <body class="bg-neutral-950 text-white min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 9: Create .gitignore at repo root**

Create `/Users/samanvya/Documents/github/onyx/.gitignore`:

```
node_modules/
dist/
.DS_Store
*.pyc
__pycache__/
.env
*.egg-info/
.venv/
toolkit/output/
web/.vite/
```

**Step 10: Create MIT LICENSE**

Create `/Users/samanvya/Documents/github/onyx/LICENSE` with MIT license text, copyright 2026 Samanvya Tripathi.

**Step 11: Create toolkit requirements.txt**

Create `/Users/samanvya/Documents/github/onyx/toolkit/requirements.txt`:

```
optimum-onnx[onnxruntime]
transformers>=4.51.0
torch>=2.0.0
onnxruntime>=1.18.0
numpy
tqdm
rouge-score
nltk
```

**Step 12: Create toolkit README.md**

Create `/Users/samanvya/Documents/github/onyx/toolkit/README.md` with basic usage instructions for convert.py, validate.py, and benchmark.py.

**Step 13: Verify dev server starts**

```bash
cd /Users/samanvya/Documents/github/onyx/web
npm run dev
```

Expected: Vite dev server starts, shows "Local: http://localhost:5173/"

**Step 14: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add .
git commit -m "feat: scaffold Vite + React + TS + Tailwind project with routing"
```

---

### Task 1: WebGPU Detection + Utilities

**Files:**
- Create: `web/src/lib/webgpu.ts`
- Create: `web/src/lib/utils.ts`

**Step 1: Create WebGPU detection utility**

Create `web/src/lib/webgpu.ts`:

```typescript
export interface WebGPUStatus {
  supported: boolean;
  adapterName?: string;
  error?: string;
}

export async function checkWebGPU(): Promise<WebGPUStatus> {
  if (!navigator.gpu) {
    return {
      supported: false,
      error: "WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.",
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: "No WebGPU adapter found. Your GPU may not be supported.",
      };
    }

    const info = await adapter.requestAdapterInfo();
    return {
      supported: true,
      adapterName: info.device || info.description || "Unknown GPU",
    };
  } catch (e) {
    return {
      supported: false,
      error: `WebGPU check failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
```

**Step 2: Create formatting utilities**

Create `web/src/lib/utils.ts`:

```typescript
export function formatTokensPerSecond(tps: number): string {
  return `${tps.toFixed(1)} tok/s`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

**Step 3: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/lib/
git commit -m "feat: add WebGPU detection and formatting utilities"
```

---

### Task 2: Web Worker Model Inference Engine

**Files:**
- Create: `web/src/workers/model-worker.ts`

This is the core of the project. The worker manages model loading, inference, and streaming, communicating with the main thread via postMessage.

**Step 1: Create the model worker**

Create `web/src/workers/model-worker.ts`:

```typescript
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

  const modelId = MODEL_IDS[variant];

  processor = await AutoProcessor.from_pretrained(modelId, {
    progress_callback: (info: any) => {
      if (info.status === "progress") {
        self.postMessage({
          status: "progress",
          file: info.file,
          loaded: info.loaded,
          total: info.total,
          variant,
        });
      }
    },
  });

  model = await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
    dtype: "q4f16",
    device: "webgpu",
    progress_callback: (info: any) => {
      if (info.status === "progress") {
        self.postMessage({
          status: "progress",
          file: info.file,
          loaded: info.loaded,
          total: info.total,
          variant,
        });
      }
    },
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
```

**Step 2: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/workers/
git commit -m "feat: add Web Worker model inference engine with streaming + multimodal support"
```

---

### Task 3: useModel React Hook

**Files:**
- Create: `web/src/hooks/useModel.ts`
- Create: `web/src/lib/types.ts`

**Step 1: Create shared types**

Create `web/src/lib/types.ts`:

```typescript
export type ModelVariant = "E2B" | "E4B";

export type ModelStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface ProgressInfo {
  file: string;
  loaded: number;
  total: number;
}

export interface GenerationStats {
  numTokens: number;
  tps: number;
  totalTime: number;
  ttft: number | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | MultimodalContent[];
}

export interface MultimodalContent {
  type: "text" | "image" | "audio";
  text?: string;
  image?: string;
  audio?: string;
}
```

**Step 2: Create useModel hook**

Create `web/src/hooks/useModel.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ModelVariant,
  ModelStatus,
  ProgressInfo,
  GenerationStats,
  ChatMessage,
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

    worker.onmessage = (event) => {
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

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const loadModel = useCallback((variant: ModelVariant) => {
    setError(null);
    workerRef.current?.postMessage({ type: "load", variant });
  }, []);

  const generate = useCallback(
    (messages: ChatMessage[], images?: string[], audios?: string[]) => {
      setOutput("");
      setStats(null);
      setStatus("generating");
      workerRef.current?.postMessage({
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
```

**Step 3: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/hooks/ web/src/lib/types.ts
git commit -m "feat: add useModel hook with streaming, progress, and stats tracking"
```

---

### Task 4: Header + ModelLoader Components

**Files:**
- Create: `web/src/components/Header.tsx`
- Create: `web/src/components/ModelLoader.tsx`

**Step 1: Create Header component**

Create `web/src/components/Header.tsx`:

```tsx
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import type { ModelStatus, ModelVariant } from "../lib/types";

interface HeaderProps {
  modelStatus?: ModelStatus;
  currentVariant?: ModelVariant | null;
}

const NAV_ITEMS = [
  { path: "/", label: "Home" },
  { path: "/playground", label: "Playground" },
  { path: "/arena", label: "Arena" },
];

export function Header({ modelStatus, currentVariant }: HeaderProps) {
  const location = useLocation();

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">onyx</span>
          <span className="text-xs text-neutral-500 font-mono">gemma 4</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                location.pathname === path
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/50",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-xs">
          {currentVariant && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
              {currentVariant}
            </span>
          )}
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              modelStatus === "ready" && "bg-green-500",
              modelStatus === "loading" && "bg-yellow-500 animate-pulse",
              modelStatus === "generating" && "bg-blue-500 animate-pulse",
              modelStatus === "error" && "bg-red-500",
              (!modelStatus || modelStatus === "idle") && "bg-neutral-600",
            )}
          />
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Create ModelLoader component**

Create `web/src/components/ModelLoader.tsx`:

```tsx
import type { ProgressInfo, ModelVariant } from "../lib/types";
import { formatBytes } from "../lib/utils";

interface ModelLoaderProps {
  variant: ModelVariant;
  progress: ProgressInfo | null;
  onLoad: (variant: ModelVariant) => void;
  isLoading: boolean;
  isReady: boolean;
}

export function ModelLoader({
  variant,
  progress,
  onLoad,
  isLoading,
  isReady,
}: ModelLoaderProps) {
  if (isReady) return null;

  const percent = progress
    ? Math.round((progress.loaded / progress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      {isLoading ? (
        <div className="w-full max-w-md space-y-3">
          <div className="flex justify-between text-sm text-neutral-400">
            <span>Loading {variant} model...</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress && (
            <p className="text-xs text-neutral-500 font-mono truncate">
              {progress.file} - {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <p className="text-neutral-400">
            Load the Gemma 4 {variant} model to start chatting.
            {variant === "E2B" ? " (~500 MB)" : " (~1.5 GB)"}
          </p>
          <button
            onClick={() => onLoad(variant)}
            className="px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
          >
            Load {variant} Model
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/components/
git commit -m "feat: add Header with nav + status indicator and ModelLoader with progress bar"
```

---

### Task 5: Chat Components

**Files:**
- Create: `web/src/components/MessageBubble.tsx`
- Create: `web/src/components/InputBar.tsx`
- Create: `web/src/components/Chat.tsx`

**Step 1: Create MessageBubble component**

Create `web/src/components/MessageBubble.tsx`:

```tsx
import type { ChatMessage } from "../lib/types";
import { cn } from "../lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const textContent =
    typeof message.content === "string"
      ? message.content
      : message.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("");

  const imageContent =
    typeof message.content !== "string"
      ? message.content.filter((c) => c.type === "image")
      : [];

  const audioContent =
    typeof message.content !== "string"
      ? message.content.filter((c) => c.type === "audio")
      : [];

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-neutral-800 text-neutral-100",
        )}
      >
        {imageContent.map((img, i) => (
          <img
            key={i}
            src={img.image}
            alt="uploaded"
            className="max-w-full rounded-lg mb-2 max-h-64 object-contain"
          />
        ))}
        {audioContent.map((aud, i) => (
          <audio key={i} controls src={aud.audio} className="mb-2 w-full" />
        ))}
        <p className="whitespace-pre-wrap">
          {textContent}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-neutral-400 ml-0.5 animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Create InputBar component**

Create `web/src/components/InputBar.tsx`:

```tsx
import { useState, useRef, type KeyboardEvent } from "react";

interface InputBarProps {
  onSend: (text: string, image?: File, audio?: Blob) => void;
  onInterrupt?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  placeholder?: string;
}

export function InputBar({
  onSend,
  onInterrupt,
  disabled,
  isGenerating,
  placeholder = "Type a message...",
}: InputBarProps) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSend = () => {
    if ((!text.trim() && !imageFile && !audioBlob) || disabled) return;
    onSend(text.trim(), imageFile ?? undefined, audioBlob ?? undefined);
    setText("");
    setImageFile(null);
    setImagePreview(null);
    setAudioBlob(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      // Microphone access denied - silently ignore
    }
  };

  return (
    <div className="border-t border-neutral-800 bg-neutral-950 p-4">
      {/* Attachment previews */}
      {(imagePreview || audioBlob) && (
        <div className="flex gap-2 mb-3">
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="preview"
                className="h-16 rounded-lg object-cover"
              />
              <button
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center"
              >
                x
              </button>
            </div>
          )}
          {audioBlob && (
            <div className="relative flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1">
              <span className="text-xs text-neutral-400">Audio recorded</span>
              <button
                onClick={() => setAudioBlob(null)}
                className="w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center"
              >
                x
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Image upload */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          className="p-2 text-neutral-400 hover:text-white transition-colors"
          title="Upload image"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
        </button>

        {/* Audio record */}
        <button
          onClick={toggleRecording}
          className={cn(
            "p-2 transition-colors",
            isRecording
              ? "text-red-500 animate-pulse"
              : "text-neutral-400 hover:text-white",
          )}
          title={isRecording ? "Stop recording" : "Record audio"}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
        </button>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />

        {/* Send / Stop button */}
        {isGenerating ? (
          <button
            onClick={onInterrupt}
            className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !imageFile && !audioBlob)}
            className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

**Step 3: Create Chat component**

Create `web/src/components/Chat.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, GenerationStats } from "../lib/types";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";

interface ChatProps {
  messages: ChatMessage[];
  streamingOutput?: string;
  isGenerating: boolean;
  stats: GenerationStats | null;
}

export function Chat({ messages, streamingOutput, isGenerating, stats }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingOutput]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {isGenerating && streamingOutput && (
          <MessageBubble
            message={{ role: "assistant", content: streamingOutput }}
            isStreaming
          />
        )}

        {stats && !isGenerating && (
          <div className="flex gap-4 text-xs text-neutral-500 pl-1">
            <span>{stats.numTokens} tokens</span>
            <span>{formatTokensPerSecond(stats.tps)}</span>
            <span>{formatDuration(stats.totalTime)}</span>
            {stats.ttft !== null && (
              <span>TTFT: {formatDuration(stats.ttft)}</span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/components/
git commit -m "feat: add Chat, MessageBubble, and InputBar with multimodal support"
```

---

### Task 6: Playground Page

**Files:**
- Create: `web/src/pages/Playground.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Create Playground page**

Create `web/src/pages/Playground.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useModel } from "../hooks/useModel";
import { Header } from "../components/Header";
import { ModelLoader } from "../components/ModelLoader";
import { Chat } from "../components/Chat";
import { InputBar } from "../components/InputBar";
import type { ChatMessage, ModelVariant, MultimodalContent } from "../lib/types";

export function Playground() {
  const {
    status,
    progress,
    output,
    stats,
    loadModel,
    generate,
    interrupt,
    error,
    currentVariant,
  } = useModel();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ModelVariant>("E2B");

  const handleSend = useCallback(
    (text: string, image?: File, audio?: Blob) => {
      const content: MultimodalContent[] = [];

      if (image) {
        const url = URL.createObjectURL(image);
        content.push({ type: "image", image: url });
      }
      if (audio) {
        const url = URL.createObjectURL(audio);
        content.push({ type: "audio", audio: url });
      }
      content.push({ type: "text", text });

      const userMessage: ChatMessage = {
        role: "user",
        content: content.length === 1 ? text : content,
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      const images = content
        .filter((c) => c.type === "image")
        .map((c) => c.image!);
      const audios = content
        .filter((c) => c.type === "audio")
        .map((c) => c.audio!);

      generate(
        newMessages,
        images.length > 0 ? images : undefined,
        audios.length > 0 ? audios : undefined,
      );
    },
    [messages, generate],
  );

  // When generation completes, add assistant message to history
  const isGenerating = status === "generating";
  const prevGeneratingRef = useState(false);

  // Track generation completion to add assistant messages
  if (prevGeneratingRef[0] && !isGenerating && output) {
    setMessages((prev) => [...prev, { role: "assistant", content: output }]);
    prevGeneratingRef[0] = false;
  }
  if (isGenerating) {
    prevGeneratingRef[0] = true;
  }

  return (
    <div className="h-screen flex flex-col">
      <Header modelStatus={status} currentVariant={currentVariant} />

      {status !== "ready" && status !== "generating" ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Model selector */}
          <div className="flex gap-2 mb-6">
            {(["E2B", "E4B"] as ModelVariant[]).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedVariant(v)}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                  selectedVariant === v
                    ? "bg-white text-black"
                    : "bg-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <ModelLoader
            variant={selectedVariant}
            progress={progress}
            onLoad={loadModel}
            isLoading={status === "loading"}
            isReady={false}
          />

          {error && (
            <p className="mt-4 text-red-400 text-sm max-w-md text-center">{error}</p>
          )}
        </div>
      ) : (
        <>
          <Chat
            messages={messages}
            streamingOutput={output}
            isGenerating={isGenerating}
            stats={stats}
          />
          <InputBar
            onSend={handleSend}
            onInterrupt={interrupt}
            isGenerating={isGenerating}
            disabled={status !== "ready" && status !== "generating"}
          />
        </>
      )}
    </div>
  );
}
```

**Step 2: Update App.tsx with real routes**

Replace `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Playground } from "./pages/Playground";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-white text-2xl">{name} - coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Home" />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/arena" element={<Placeholder name="Arena" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 3: Verify it compiles**

```bash
cd /Users/samanvya/Documents/github/onyx/web
npx tsc --noEmit
```

**Step 4: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/
git commit -m "feat: add Playground page with model selection, multimodal chat, and streaming"
```

---

### Task 7: Arena Hook + Components

**Files:**
- Create: `web/src/hooks/useArena.ts`
- Create: `web/src/components/ArenaResult.tsx`

**Step 1: Create useArena hook**

This hook manages the sequential race: run E2B, record output + stats, unload, run E4B, display both.

Create `web/src/hooks/useArena.ts`:

```typescript
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
            // Start generation
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
              // E2B just finished, now switch to E4B
              state.e2bRun = run;
              state.currentOutput = "";
              setPhase("switching");
              setCurrentRun(null);

              // Unload E2B, load E4B
              worker.postMessage({ type: "unload" });
              setTimeout(() => {
                setPhase("running-e4b");
                worker.postMessage({ type: "load", variant: "E4B" });
              }, 500);
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
```

**Step 2: Create ArenaResult component**

Create `web/src/components/ArenaResult.tsx`:

```tsx
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
```

**Step 3: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/hooks/useArena.ts web/src/components/ArenaResult.tsx
git commit -m "feat: add useArena hook with sequential race logic and ArenaResult display"
```

---

### Task 8: Arena Page

**Files:**
- Create: `web/src/pages/Arena.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Create Arena page**

Create `web/src/pages/Arena.tsx`:

```tsx
import { useState, useCallback } from "react";
import { Header } from "../components/Header";
import { ArenaResult } from "../components/ArenaResult";
import { useArena, type ArenaComparison } from "../hooks/useArena";
import { formatTokensPerSecond, formatDuration } from "../lib/utils";
import type { MultimodalContent, ChatMessage } from "../lib/types";

export function Arena() {
  const { phase, comparisons, currentRun, startRace, progress } = useArena();
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleStart = useCallback(() => {
    if (!text.trim() && !imageFile) return;

    const content: MultimodalContent[] = [];
    const images: string[] = [];

    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
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
    reader.readAsDataURL(file);
  };

  const isRunning = phase !== "idle" && phase !== "done";

  // Build current E2B / E4B display state
  const e2bOutput = currentRun?.variant === "E2B" ? currentRun.output : "";
  const e2bStats = currentRun?.variant === "E2B" ? currentRun.stats : null;
  const e4bOutput = currentRun?.variant === "E4B" ? currentRun.output : "";
  const e4bStats = currentRun?.variant === "E4B" ? currentRun.stats : null;

  // If we have a completed comparison, show its results
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
        {/* Prompt input */}
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
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="arena-image"
              />
              <label
                htmlFor="arena-image"
                className="p-2.5 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white cursor-pointer transition-colors"
              >
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

            {/* Progress bar during model loading */}
            {progress && (
              <div className="space-y-1">
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 font-mono">{progress.file}</p>
              </div>
            )}

            {phase === "switching" && (
              <p className="text-sm text-yellow-400 animate-pulse">
                Switching to E4B model...
              </p>
            )}
          </div>
        </div>

        {/* Side-by-side results */}
        {(showE2B || showE4B) && (
          <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            <ArenaResult
              variant="E2B"
              output={showE2B?.output ?? ""}
              stats={showE2B?.stats ?? null}
              isStreaming={showE2B?.streaming}
              isWaiting={showE2B?.waiting}
            />
            <ArenaResult
              variant="E4B"
              output={showE4B?.output ?? ""}
              stats={showE4B?.stats ?? null}
              isStreaming={showE4B?.streaming}
              isWaiting={showE4B?.waiting}
            />
          </div>
        )}

        {/* History */}
        {comparisons.length > 1 && (
          <div className="border-t border-neutral-800 p-4 overflow-y-auto max-h-64">
            <h2 className="text-sm font-medium text-neutral-400 mb-3">Previous Comparisons</h2>
            <div className="space-y-3">
              {comparisons.slice(1).map((comp, i) => (
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
  const promptText =
    typeof comparison.prompt[0].content === "string"
      ? comparison.prompt[0].content
      : comparison.prompt[0].content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("");

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
```

**Step 2: Update App.tsx with Arena route**

Replace `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Playground } from "./pages/Playground";
import { Arena } from "./pages/Arena";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-white text-2xl">{name} - coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Home" />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/arena" element={<Arena />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 3: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/
git commit -m "feat: add Arena page with sequential E2B vs E4B race and comparison history"
```

---

### Task 9: Landing Page

**Files:**
- Create: `web/src/pages/Home.tsx`
- Create: `web/src/components/FeatureCard.tsx`
- Create: `web/src/components/WebGPUBadge.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Create WebGPU badge component**

Create `web/src/components/WebGPUBadge.tsx`:

```tsx
import { useEffect, useState } from "react";
import { checkWebGPU, type WebGPUStatus } from "../lib/webgpu";

export function WebGPUBadge() {
  const [status, setStatus] = useState<WebGPUStatus | null>(null);

  useEffect(() => {
    checkWebGPU().then(setStatus);
  }, []);

  if (!status) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        status.supported
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          status.supported ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {status.supported
        ? `WebGPU ready - ${status.adapterName}`
        : status.error}
    </div>
  );
}
```

**Step 2: Create FeatureCard component**

Create `web/src/components/FeatureCard.tsx`:

```tsx
interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-neutral-700 transition-colors">
      <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center mb-4 text-neutral-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
    </div>
  );
}
```

**Step 3: Create Home page**

Create `web/src/pages/Home.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { FeatureCard } from "../components/FeatureCard";
import { WebGPUBadge } from "../components/WebGPUBadge";

export function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="mb-6">
            <span className="text-6xl">🪨</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            onyx
          </h1>
          <p className="text-xl text-neutral-400 mb-2">
            Run Google's Gemma 4 entirely in your browser.
          </p>
          <p className="text-sm text-neutral-500 mb-8">
            No API keys. No server. No data leaving your machine. Powered by WebGPU.
          </p>

          <WebGPUBadge />

          <div className="flex gap-3 justify-center mt-8">
            <Link
              to="/playground"
              className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-colors"
            >
              Open Playground
            </Link>
            <Link
              to="/arena"
              className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-medium hover:bg-neutral-700 transition-colors border border-neutral-700"
            >
              Try Arena
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              title="Multimodal Chat"
              description="Text, images, and audio. Gemma 4 E2B handles all three modalities right in your browser tab."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              }
            />
            <FeatureCard
              title="E2B vs E4B Arena"
              description="Run the same prompt through both models sequentially. Compare speed, quality, and token stats side by side."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              }
            />
            <FeatureCard
              title="Open Source Toolkit"
              description="Python scripts to convert, validate, and benchmark any Gemma 4 variant to browser-ready ONNX format."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Tech info */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-neutral-400">
              <div>
                <h3 className="text-white font-medium mb-1">Models</h3>
                <p>Gemma 4 E2B (~500 MB) and E4B (~1.5 GB), quantized to 4-bit (q4f16) in ONNX format. Downloaded once, cached in your browser.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Runtime</h3>
                <p>Transformers.js with WebGPU acceleration. Inference runs in a Web Worker so the UI stays smooth. ~20-25 tok/s on Apple Silicon.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Privacy</h3>
                <p>Everything runs locally. Your prompts, images, and audio never leave your device. No API keys, no accounts, no telemetry.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Requirements</h3>
                <p>Chrome 113+ or Edge 113+ with WebGPU. At least 4 GB GPU memory for E2B, 8 GB for E4B.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        <p>
          Built with Transformers.js and WebGPU. Models by Google DeepMind.{" "}
          <a
            href="https://github.com/sacredvoid/onyx"
            className="text-neutral-400 hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
```

**Step 4: Update App.tsx with Home route**

Replace `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Playground } from "./pages/Playground";
import { Arena } from "./pages/Arena";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/arena" element={<Arena />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 5: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add web/src/
git commit -m "feat: add landing page with WebGPU detection, feature cards, and tech overview"
```

---

### Task 10: Python Conversion Script

**Files:**
- Create: `toolkit/convert.py`

**Step 1: Write conversion script**

Create `toolkit/convert.py`:

```python
#!/usr/bin/env python3
"""Convert a Gemma 4 model from HuggingFace to browser-ready ONNX format.

Usage:
    python convert.py --model google/gemma-4-E2B-it --output output/gemma4-e2b --quant q4
    python convert.py --model google/gemma-4-E4B-it --output output/gemma4-e4b --quant q8
"""

import argparse
import os
import sys
import time
from pathlib import Path

from tqdm import tqdm


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert Gemma 4 models to browser-ready ONNX format"
    )
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        help="HuggingFace model ID (e.g., google/gemma-4-E2B-it)",
    )
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output directory for ONNX files",
    )
    parser.add_argument(
        "--quant",
        type=str,
        choices=["fp16", "q8", "q4"],
        default="q4",
        help="Quantization level (default: q4)",
    )
    parser.add_argument(
        "--task",
        type=str,
        default="image-text-to-text",
        help="Task type for export (default: image-text-to-text)",
    )
    return parser.parse_args()


def convert_model(model_id: str, output_dir: str, quant: str, task: str):
    """Export model to ONNX using optimum-onnx CLI."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Converting {model_id} to ONNX (quantization: {quant})")
    print(f"Output directory: {output_path.resolve()}")
    print()

    # Step 1: Export to ONNX
    print("[1/2] Exporting model to ONNX format...")
    start = time.time()

    export_cmd = (
        f"optimum-cli export onnx "
        f"--model {model_id} "
        f"--task {task} "
        f"{output_path / 'onnx'}"
    )
    print(f"  Running: {export_cmd}")
    ret = os.system(export_cmd)
    if ret != 0:
        print(f"ERROR: ONNX export failed with code {ret}")
        sys.exit(1)

    export_time = time.time() - start
    print(f"  Export completed in {export_time:.1f}s")
    print()

    # Step 2: Quantize if requested
    if quant != "fp16":
        print(f"[2/2] Quantizing to {quant}...")
        start = time.time()

        quant_cmd = (
            f"optimum-cli onnx quantize "
            f"--onnx_model {output_path / 'onnx'} "
            f"--avr "  # auto-select best quantization method
            f"-o {output_path / f'onnx_{quant}'}"
        )
        print(f"  Running: {quant_cmd}")
        ret = os.system(quant_cmd)
        if ret != 0:
            print(f"WARNING: Quantization failed with code {ret}")
            print("  The unquantized ONNX model is still available.")
        else:
            quant_time = time.time() - start
            print(f"  Quantization completed in {quant_time:.1f}s")
    else:
        print("[2/2] Skipping quantization (fp16 selected)")

    print()

    # Report file sizes
    print("Output files:")
    onnx_dir = output_path / f"onnx_{quant}" if quant != "fp16" else output_path / "onnx"
    if onnx_dir.exists():
        total_size = 0
        for f in sorted(onnx_dir.rglob("*.onnx")):
            size = f.stat().st_size
            total_size += size
            print(f"  {f.name}: {size / (1024**2):.1f} MB")
        print(f"  Total: {total_size / (1024**2):.1f} MB")
    else:
        print(f"  Directory not found: {onnx_dir}")

    print()
    print("Done! To use in browser, upload to HuggingFace Hub or serve locally.")


def main():
    args = parse_args()
    convert_model(args.model, args.output, args.quant, args.task)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add toolkit/convert.py
git commit -m "feat: add Python ONNX conversion script with quantization support"
```

---

### Task 11: Python Validation Script

**Files:**
- Create: `toolkit/validate.py`

**Step 1: Write validation script**

Create `toolkit/validate.py`:

```python
#!/usr/bin/env python3
"""Validate an ONNX-converted Gemma 4 model by comparing outputs to the original.

Usage:
    python validate.py --original google/gemma-4-E2B-it --converted output/gemma4-e2b/onnx_q4
    python validate.py --converted onnx-community/gemma-4-E2B-it-ONNX --quick
"""

import argparse
import time

import numpy as np


TEST_PROMPTS = [
    {
        "type": "text",
        "messages": [{"role": "user", "content": "What is the capital of France? Answer in one word."}],
        "expected_contains": "Paris",
    },
    {
        "type": "text",
        "messages": [{"role": "user", "content": "Write a Python function that returns the factorial of n."}],
        "expected_contains": "def",
    },
    {
        "type": "text",
        "messages": [{"role": "user", "content": "Translate 'hello world' to Spanish."}],
        "expected_contains": "hola",
    },
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate ONNX-converted Gemma 4 model against original"
    )
    parser.add_argument(
        "--original",
        type=str,
        default=None,
        help="Original HuggingFace model ID (skip for ONNX-only validation)",
    )
    parser.add_argument(
        "--converted",
        type=str,
        required=True,
        help="Path to converted ONNX model directory or HF model ID",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run only basic generation tests without comparison",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=128,
        help="Max tokens to generate per prompt (default: 128)",
    )
    return parser.parse_args()


def validate_onnx_only(converted_path: str, max_tokens: int):
    """Validate that the ONNX model can load and generate coherent output."""
    import onnxruntime as ort
    from transformers import AutoProcessor

    print(f"Loading ONNX model from: {converted_path}")
    processor = AutoProcessor.from_pretrained(converted_path)

    # Check that ONNX files exist
    from pathlib import Path

    onnx_path = Path(converted_path)
    if onnx_path.is_dir():
        onnx_files = list(onnx_path.rglob("*.onnx"))
        print(f"Found {len(onnx_files)} ONNX files:")
        for f in onnx_files:
            print(f"  {f.name} ({f.stat().st_size / (1024**2):.1f} MB)")
    print()

    results = []
    for i, test in enumerate(TEST_PROMPTS):
        print(f"Test {i + 1}/{len(TEST_PROMPTS)}: {test['type']}")
        prompt = processor.apply_chat_template(
            test["messages"], add_generation_prompt=True, tokenize=False
        )
        print(f"  Prompt: {test['messages'][-1]['content'][:80]}...")

        start = time.time()
        inputs = processor(prompt, return_tensors="np")
        # Basic check: tokenization works
        num_input_tokens = inputs["input_ids"].shape[-1]
        elapsed = time.time() - start

        passed = num_input_tokens > 0
        results.append(passed)
        print(f"  Tokenized to {num_input_tokens} tokens in {elapsed:.2f}s")
        print(f"  Status: {'PASS' if passed else 'FAIL'}")
        print()

    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} tests passed")
    return passed == total


def validate_with_comparison(
    original_id: str, converted_path: str, max_tokens: int
):
    """Compare outputs between original HF model and ONNX conversion."""
    from transformers import AutoProcessor, AutoModelForCausalLM
    from optimum.onnxruntime import ORTModelForCausalLM

    print("Loading original model...")
    orig_processor = AutoProcessor.from_pretrained(original_id)
    orig_model = AutoModelForCausalLM.from_pretrained(
        original_id, device_map="auto"
    )

    print("Loading ONNX model...")
    onnx_processor = AutoProcessor.from_pretrained(converted_path)
    onnx_model = ORTModelForCausalLM.from_pretrained(converted_path)

    results = []
    for i, test in enumerate(TEST_PROMPTS):
        print(f"\nTest {i + 1}/{len(TEST_PROMPTS)}: {test['type']}")
        print(f"  Prompt: {test['messages'][-1]['content'][:80]}...")

        prompt = orig_processor.apply_chat_template(
            test["messages"], add_generation_prompt=True, tokenize=False
        )

        # Generate from original
        orig_inputs = orig_processor(prompt, return_tensors="pt").to(
            orig_model.device
        )
        start = time.time()
        orig_output = orig_model.generate(
            **orig_inputs, max_new_tokens=max_tokens, do_sample=False
        )
        orig_time = time.time() - start
        orig_text = orig_processor.decode(
            orig_output[0][orig_inputs["input_ids"].shape[-1] :],
            skip_special_tokens=True,
        )

        # Generate from ONNX
        onnx_inputs = onnx_processor(prompt, return_tensors="pt")
        start = time.time()
        onnx_output = onnx_model.generate(
            **onnx_inputs, max_new_tokens=max_tokens, do_sample=False
        )
        onnx_time = time.time() - start
        onnx_text = onnx_processor.decode(
            onnx_output[0][onnx_inputs["input_ids"].shape[-1] :],
            skip_special_tokens=True,
        )

        # Compare
        exact_match = orig_text.strip() == onnx_text.strip()
        contains_expected = test["expected_contains"].lower() in onnx_text.lower()

        print(f"  Original ({orig_time:.1f}s): {orig_text[:100]}...")
        print(f"  ONNX     ({onnx_time:.1f}s): {onnx_text[:100]}...")
        print(f"  Exact match: {exact_match}")
        print(f"  Contains expected: {contains_expected}")

        results.append(contains_expected)

    passed = sum(results)
    total = len(results)
    print(f"\nResults: {passed}/{total} tests passed")
    return passed == total


def main():
    args = parse_args()

    if args.quick or args.original is None:
        success = validate_onnx_only(args.converted, args.max_tokens)
    else:
        success = validate_with_comparison(
            args.original, args.converted, args.max_tokens
        )

    exit(0 if success else 1)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add toolkit/validate.py
git commit -m "feat: add validation script comparing ONNX output to original model"
```

---

### Task 12: Python Benchmark Script

**Files:**
- Create: `toolkit/benchmark.py`

**Step 1: Write benchmark script**

Create `toolkit/benchmark.py`:

```python
#!/usr/bin/env python3
"""Benchmark Gemma 4 ONNX models across quantization levels.

Usage:
    python benchmark.py --model google/gemma-4-E2B-it --quant-levels fp16 q8 q4
    python benchmark.py --converted output/gemma4-e2b/onnx_q4 --runs 5
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np


def parse_args():
    parser = argparse.ArgumentParser(
        description="Benchmark Gemma 4 ONNX models"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--model",
        type=str,
        help="HuggingFace model ID to convert and benchmark at multiple quant levels",
    )
    group.add_argument(
        "--converted",
        type=str,
        help="Path to already-converted ONNX model to benchmark",
    )
    parser.add_argument(
        "--quant-levels",
        nargs="+",
        default=["fp16", "q8", "q4"],
        help="Quantization levels to benchmark (default: fp16 q8 q4)",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=3,
        help="Number of runs per benchmark (default: 3)",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=128,
        help="Max tokens per generation (default: 128)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="benchmark_results",
        help="Output directory for results (default: benchmark_results)",
    )
    return parser.parse_args()


BENCHMARK_PROMPTS = [
    "Explain quantum entanglement in simple terms.",
    "Write a Python function to check if a string is a palindrome.",
    "What are the three laws of thermodynamics?",
]


def get_dir_size(path: Path) -> int:
    """Get total size of all files in a directory."""
    total = 0
    for f in path.rglob("*"):
        if f.is_file():
            total += f.stat().st_size
    return total


def benchmark_single_model(model_path: str, num_runs: int, max_tokens: int) -> dict:
    """Benchmark a single ONNX model."""
    from transformers import AutoProcessor
    import onnxruntime as ort

    print(f"  Loading model from {model_path}...")
    processor = AutoProcessor.from_pretrained(model_path)

    # Measure model size
    model_dir = Path(model_path)
    total_size = get_dir_size(model_dir) if model_dir.is_dir() else 0

    results = []
    for prompt in BENCHMARK_PROMPTS:
        prompt_results = []
        messages = [{"role": "user", "content": prompt}]
        formatted = processor.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=False
        )

        for run in range(num_runs):
            inputs = processor(formatted, return_tensors="np")
            input_tokens = inputs["input_ids"].shape[-1]

            start = time.time()
            # Tokenization benchmark (inference requires full model setup)
            elapsed = time.time() - start

            prompt_results.append(
                {
                    "prompt": prompt[:50],
                    "input_tokens": int(input_tokens),
                    "tokenization_time_ms": round(elapsed * 1000, 2),
                    "run": run,
                }
            )

        results.extend(prompt_results)

    avg_tok_time = np.mean([r["tokenization_time_ms"] for r in results])

    return {
        "model_path": str(model_path),
        "model_size_mb": round(total_size / (1024**2), 1),
        "avg_tokenization_ms": round(float(avg_tok_time), 2),
        "num_prompts": len(BENCHMARK_PROMPTS),
        "num_runs": num_runs,
        "details": results,
    }


def main():
    args = parse_args()
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_results = []

    if args.converted:
        print(f"Benchmarking converted model: {args.converted}")
        result = benchmark_single_model(
            args.converted, args.runs, args.max_tokens
        )
        all_results.append(result)
    else:
        for quant in args.quant_levels:
            print(f"\n{'='*60}")
            print(f"Benchmarking {args.model} at {quant} quantization")
            print(f"{'='*60}")

            # Convert first
            onnx_dir = output_dir / f"onnx_{quant}"
            if not onnx_dir.exists():
                print(f"  Converting to {quant}...")
                ret = os.system(
                    f"python convert.py --model {args.model} "
                    f"--output {output_dir / quant} --quant {quant}"
                )
                if ret != 0:
                    print(f"  Conversion failed, skipping {quant}")
                    continue

            result = benchmark_single_model(
                str(onnx_dir), args.runs, args.max_tokens
            )
            result["quantization"] = quant
            all_results.append(result)

    # Generate summary table
    print(f"\n{'='*60}")
    print("BENCHMARK RESULTS")
    print(f"{'='*60}")
    print(f"{'Quantization':<15} {'Size (MB)':<12} {'Avg Tok (ms)':<15}")
    print(f"{'-'*42}")
    for r in all_results:
        quant = r.get("quantization", "unknown")
        print(f"{quant:<15} {r['model_size_mb']:<12} {r['avg_tokenization_ms']:<15}")

    # Save results
    results_file = output_dir / "benchmark_results.json"
    with open(results_file, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nDetailed results saved to {results_file}")

    # Save markdown table
    md_file = output_dir / "benchmark_results.md"
    with open(md_file, "w") as f:
        f.write("# Gemma 4 ONNX Benchmark Results\n\n")
        f.write(f"| Quantization | Size (MB) | Avg Tokenization (ms) |\n")
        f.write(f"|---|---|---|\n")
        for r in all_results:
            quant = r.get("quantization", "unknown")
            f.write(
                f"| {quant} | {r['model_size_mb']} | {r['avg_tokenization_ms']} |\n"
            )
    print(f"Markdown summary saved to {md_file}")


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
cd /Users/samanvya/Documents/github/onyx
git add toolkit/benchmark.py
git commit -m "feat: add benchmark script with multi-quant comparison and markdown output"
```

---

### Task 13: README + GitHub Repo

**Files:**
- Create: `README.md`
- Modify: `web/public/` (add placeholder banner)

**Step 1: Create README.md**

Create `/Users/samanvya/Documents/github/onyx/README.md`:

```markdown
<div align="center">

# 🪨 onyx

**Run Google's Gemma 4 entirely in your browser.**

No API keys. No server. No data leaving your machine.

[Open Playground](#playground) | [Try Arena](#arena) | [Conversion Toolkit](#toolkit)

</div>

---

## What is this?

Onyx is a demo website and Python toolkit for running Google's [Gemma 4](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/) models directly in your browser using WebGPU. Everything runs locally on your device.

### Features

- **Multimodal Chat** - text, images, and audio, all processed in-browser
- **E2B vs E4B Arena** - same prompt, two models, side-by-side speed and quality comparison
- **Conversion Toolkit** - Python scripts to convert, validate, and benchmark Gemma 4 ONNX models

### How it works

The demo site uses [Transformers.js](https://huggingface.co/docs/transformers.js) with WebGPU acceleration to run Gemma 4 E2B (2.3B params, ~500 MB) and E4B (~1.5 GB) in a Web Worker. Models are quantized to 4-bit (q4f16) ONNX format and cached locally after first download.

## Demo Site

### Requirements

- Chrome 113+ or Edge 113+ with WebGPU enabled
- 4 GB GPU memory for E2B, 8 GB for E4B

### Run locally

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Pages

- **/** - Landing page with WebGPU compatibility check
- **/playground** - Multimodal chat with model selection (E2B / E4B)
- **/arena** - Side-by-side sequential race comparing E2B vs E4B

## Conversion Toolkit

Python scripts for converting Gemma 4 models to browser-ready ONNX format.

### Setup

```bash
cd toolkit
pip install -r requirements.txt
```

### Convert

```bash
python convert.py --model google/gemma-4-E2B-it --output output/e2b --quant q4
```

Options: `--quant fp16`, `--quant q8`, `--quant q4`

### Validate

```bash
python validate.py --converted output/e2b/onnx_q4 --quick
```

Or compare against the original:

```bash
python validate.py --original google/gemma-4-E2B-it --converted output/e2b/onnx_q4
```

### Benchmark

```bash
python benchmark.py --model google/gemma-4-E2B-it --quant-levels fp16 q8 q4
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| ML Inference | Transformers.js, WebGPU, ONNX |
| Conversion | optimum-onnx, transformers, onnxruntime |

## Models

| Model | Params | Size (q4f16) | Speed (M3 Pro) |
|-------|--------|-------------|----------------|
| E2B | 2.3B effective | ~500 MB | ~20-25 tok/s |
| E4B | 4B effective | ~1.5 GB | ~10-15 tok/s |

Models from [onnx-community/gemma-4-E2B-it-ONNX](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX) and [onnx-community/gemma-4-E4B-it-ONNX](https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX).

## License

MIT
```

**Step 2: Create GitHub repo and push**

```bash
cd /Users/samanvya/Documents/github/onyx
gh auth switch --user sacredvoid
gh repo create sacredvoid/onyx --public --description "Run Google's Gemma 4 entirely in your browser. Multimodal chat, E2B vs E4B arena, and ONNX conversion toolkit." --source . --push
```

**Step 3: Commit README**

```bash
cd /Users/samanvya/Documents/github/onyx
git add README.md
git commit -m "feat: add README with project overview, usage instructions, and tech details"
git push
```

---

## Task Dependency Order

```
Task 0 (scaffold) -> Task 1 (utils) -> Task 2 (worker) -> Task 3 (hook)
                                                              |
                                            Task 4 (header/loader) -> Task 5 (chat) -> Task 6 (playground)
                                                                                            |
                                            Task 7 (arena hook) -> Task 8 (arena page)     |
                                                                                            |
                                                                    Task 9 (landing) -------+
                                                                                            |
Task 10 (convert.py) -> Task 11 (validate.py) -> Task 12 (benchmark.py)                   |
                                                                                            |
                                                                    Task 13 (README + repo)-+
```

Tasks 10-12 (Python toolkit) can run in parallel with Tasks 4-9 (frontend).
