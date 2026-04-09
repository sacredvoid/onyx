# Onyx Toolkit

Python utilities for converting, validating, and benchmarking Gemma models for browser inference.

## Setup

```bash
cd toolkit
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Scripts

### convert.py

Convert a HuggingFace Gemma model to ONNX format optimized for browser inference.

```bash
python convert.py --model google/gemma-4-1b-it --output ./output/gemma-4-1b-it
```

### validate.py

Validate that a converted ONNX model produces correct outputs by comparing against the original HuggingFace model.

```bash
python validate.py --original google/gemma-4-1b-it --converted ./output/gemma-4-1b-it
```

### benchmark.py

Benchmark inference speed and memory usage of a converted model.

```bash
python benchmark.py --model ./output/gemma-4-1b-it --prompts benchmarks/prompts.txt
```
