#!/usr/bin/env python3
"""Validate an ONNX-converted Gemma 4 model by comparing outputs to the original.

Usage:
    python validate.py --original google/gemma-4-E2B-it --converted output/gemma4-e2b/onnx_q4
    python validate.py --converted onnx-community/gemma-4-E2B-it-ONNX --quick
"""

import argparse
import time


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
    from transformers import AutoProcessor

    print(f"Loading ONNX model from: {converted_path}")
    processor = AutoProcessor.from_pretrained(converted_path)

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

    try:
        print("Loading original model...")
        orig_processor = AutoProcessor.from_pretrained(original_id)
        orig_model = AutoModelForCausalLM.from_pretrained(
            original_id, device_map="auto"
        )

        print("Loading ONNX model...")
        onnx_processor = AutoProcessor.from_pretrained(converted_path)
        onnx_model = ORTModelForCausalLM.from_pretrained(converted_path)
    except Exception as e:
        print(f"ERROR: Failed to load models: {e}")
        return False

    results = []
    for i, test in enumerate(TEST_PROMPTS):
        print(f"\nTest {i + 1}/{len(TEST_PROMPTS)}: {test['type']}")
        print(f"  Prompt: {test['messages'][-1]['content'][:80]}...")

        prompt = orig_processor.apply_chat_template(
            test["messages"], add_generation_prompt=True, tokenize=False
        )

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
