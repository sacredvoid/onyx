#!/usr/bin/env python3
"""Benchmark Gemma 4 ONNX models across quantization levels.

Usage:
    python benchmark.py --model google/gemma-4-E2B-it --quant-levels fp16 q8 q4
    python benchmark.py --converted output/gemma4-e2b/onnx_q4 --runs 5
"""

import argparse
import json
import subprocess
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

    print(f"  Loading processor from {model_path}...")
    processor = AutoProcessor.from_pretrained(model_path)

    model_dir = Path(model_path)
    total_size = get_dir_size(model_dir) if model_dir.is_dir() else 0

    results = []
    for prompt in BENCHMARK_PROMPTS:
        messages = [{"role": "user", "content": prompt}]
        formatted = processor.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=False
        )

        for run in range(num_runs):
            start = time.time()
            inputs = processor(formatted, return_tensors="np")
            tokenization_time = time.time() - start

            input_tokens = int(inputs["input_ids"].shape[-1])

            results.append({
                "prompt": prompt[:50],
                "input_tokens": input_tokens,
                "tokenization_time_ms": round(tokenization_time * 1000, 2),
                "run": run,
            })

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

            onnx_dir = output_dir / f"onnx_{quant}"
            if not onnx_dir.exists():
                print(f"  Converting to {quant}...")
                ret = subprocess.run([
                    "python", "convert.py",
                    "--model", args.model,
                    "--output", str(output_dir / quant),
                    "--quant", quant,
                ]).returncode
                if ret != 0:
                    print(f"  Conversion failed, skipping {quant}")
                    continue

            result = benchmark_single_model(
                str(onnx_dir), args.runs, args.max_tokens
            )
            result["quantization"] = quant
            all_results.append(result)

    print(f"\n{'='*60}")
    print("BENCHMARK RESULTS")
    print(f"{'='*60}")
    print(f"{'Quantization':<15} {'Size (MB)':<12} {'Avg Tok (ms)':<15}")
    print(f"{'-'*42}")
    for r in all_results:
        quant = r.get("quantization", "unknown")
        print(f"{quant:<15} {r['model_size_mb']:<12} {r['avg_tokenization_ms']:<15}")

    results_file = output_dir / "benchmark_results.json"
    with open(results_file, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nDetailed results saved to {results_file}")

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
