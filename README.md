<div align="center">

# onyx

**Run Google's Gemma 4 entirely in your browser.**

No API keys. No server. No data leaving your machine.

[Open Playground](#demo-site) | [Try Arena](#demo-site) | [Conversion Toolkit](#conversion-toolkit)

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
