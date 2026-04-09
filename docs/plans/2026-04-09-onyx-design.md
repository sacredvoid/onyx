# Onyx - Gemma 4 in Your Browser

## Overview

Run Google's Gemma 4 entirely in the browser via WebGPU. No API keys, no server, no data leaving your machine.

Two components:
1. **Demo website** (Vite + React + TypeScript + Tailwind) - multimodal chat with text/image/audio, side-by-side E2B vs E4B sequential race comparison
2. **Conversion toolkit** (Python) - convert Gemma 4 variants to browser-ready ONNX, validate correctness, benchmark quantization levels

Mascot: Onix the Pokemon (rock snake, gem/ONNX wordplay).

## Architecture

### Demo Website (`web/`)

```
web/
├── src/
│   ├── components/
│   │   ├── Chat.tsx              # Main chat interface
│   │   ├── MessageBubble.tsx     # Individual message display
│   │   ├── InputBar.tsx          # Text input + image/audio upload
│   │   ├── ImageUpload.tsx       # Drag-drop / click image input
│   │   ├── AudioRecorder.tsx     # Record or upload audio
│   │   ├── ModelLoader.tsx       # Loading progress + WebGPU check
│   │   ├── Arena.tsx             # Side-by-side E2B vs E4B comparison
│   │   ├── ArenaResult.tsx       # Single model result card with stats
│   │   ├── Header.tsx            # Nav + model status indicator
│   │   └── FeatureCard.tsx       # Landing page feature highlights
│   ├── workers/
│   │   └── model-worker.ts       # Web Worker for model inference
│   ├── hooks/
│   │   ├── useModel.ts           # Model loading, inference, streaming
│   │   └── useArena.ts           # Sequential race logic + timing
│   ├── lib/
│   │   ├── model.ts              # Transformers.js model wrapper
│   │   └── utils.ts              # Formatting, timing helpers
│   ├── pages/
│   │   ├── Home.tsx              # Landing page with feature overview
│   │   ├── Playground.tsx        # Multimodal chat playground
│   │   └── Arena.tsx             # Side-by-side comparison page
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── onix-banner.png
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

**Key technical decisions:**
- Model inference runs in a Web Worker to keep the UI responsive
- Transformers.js `@huggingface/transformers` with `device: "webgpu"` and `dtype: "q4f16"`
- Model ID: `onnx-community/gemma-4-E2B-it-ONNX` (E2B) and `onnx-community/gemma-4-E4B-it-ONNX` (E4B)
- Models cached in browser after first download (IndexedDB via Transformers.js)
- Streaming output via TextStreamer

**Arena (side-by-side) flow:**
1. User enters a prompt (optionally with image/audio)
2. E2B loads and runs first, output streams in left panel, stats recorded (tok/s, TTFT, total time)
3. E2B unloads, E4B loads and runs same prompt
4. Both results displayed side by side with timing stats
5. Results persist so user can build up multiple comparisons

**Multimodal support:**
- Text: standard chat input
- Image: drag-drop or file picker, displayed inline, passed to model via `load_image()`
- Audio: record via MediaRecorder API or upload file, passed via `read_audio()`

### Conversion Toolkit (`toolkit/`)

```
toolkit/
├── convert.py          # Convert HF Gemma 4 model to ONNX with quantization
├── validate.py         # Run test prompts through ONNX model, compare to HF output
├── benchmark.py        # Measure size, speed, accuracy loss per quantization level
├── requirements.txt
└── README.md
```

**convert.py:**
- Input: HuggingFace model ID (e.g., `google/gemma-4-E2B-it`), quantization level (q4, q8, fp16)
- Uses `optimum` library for ONNX export
- Outputs browser-ready ONNX files (vision encoder, audio encoder, embed tokens, decoder)
- Progress reporting during conversion

**validate.py:**
- Loads both original HF model and converted ONNX model
- Runs a set of test prompts (text-only, image+text, audio+text)
- Compares outputs for semantic similarity
- Reports pass/fail with detailed diffs

**benchmark.py:**
- Converts model at multiple quantization levels
- Measures: file size, inference speed (tok/s), memory usage, output quality (perplexity or BLEU vs fp32 baseline)
- Outputs a summary table (markdown + CSV)

## Pages

### Landing Page (`/`)
- Onix mascot banner
- "Gemma 4 runs in your browser" headline
- WebGPU compatibility check (green/red indicator)
- Three feature cards: Multimodal Chat, Side-by-Side Arena, Open Source Toolkit
- CTA buttons to Playground and Arena

### Playground (`/playground`)
- Full-width chat interface
- Model selector dropdown (E2B / E4B)
- Loading progress bar with model size indicator
- Input bar with text field + image upload + audio record buttons
- Streaming response display
- Stats footer: tokens generated, tok/s, time elapsed

### Arena (`/arena`)
- Split-screen layout
- Shared input bar at top
- Left panel: E2B result + stats
- Right panel: E4B result + stats
- Sequential execution with progress indicator ("Running E2B..." / "Running E4B...")
- History of past comparisons below

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS 4 |
| ML inference | @huggingface/transformers (Transformers.js) |
| GPU acceleration | WebGPU |
| Model format | ONNX (q4f16 quantization) |
| Routing | React Router |
| Python toolkit | optimum, transformers, onnxruntime, numpy |

## Browser Requirements

- Chrome 113+ or Edge 113+ with WebGPU enabled
- Minimum 4GB available GPU memory for E2B, 8GB for E4B
- The site must gracefully degrade with a clear message if WebGPU is unavailable
