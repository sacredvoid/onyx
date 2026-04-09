#!/usr/bin/env python3
"""Convert a Gemma 4 model from HuggingFace to browser-ready ONNX format.

Usage:
    python convert.py --model google/gemma-4-E2B-it --output output/gemma4-e2b --quant q4
    python convert.py --model google/gemma-4-E4B-it --output output/gemma4-e4b --quant q8
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path


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

    export_args = [
        "optimum-cli", "export", "onnx",
        "--model", model_id,
        "--task", task,
        str(output_path / "onnx"),
    ]
    print(f"  Running: {' '.join(export_args)}")
    ret = subprocess.run(export_args).returncode
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

        quant_args = [
            "optimum-cli", "onnx", "quantize",
            "--onnx_model", str(output_path / "onnx"),
            "--avr",
            "-o", str(output_path / f"onnx_{quant}"),
        ]
        print(f"  Running: {' '.join(quant_args)}")
        ret = subprocess.run(quant_args).returncode
        if ret != 0:
            print(f"ERROR: Quantization to {quant} failed with code {ret}")
            print(f"  The unquantized ONNX model is available at: {output_path / 'onnx'}")
            sys.exit(1)
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
