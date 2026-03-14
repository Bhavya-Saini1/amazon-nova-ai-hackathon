"""One-command workflow: download SafeCity data and train the model."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare SafeCity JSONL files and run multi-label training."
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip dataset download/conversion and use existing JSONL files.",
    )
    parser.add_argument("--train-file", type=str, default="./data/train.jsonl")
    parser.add_argument("--valid-file", type=str, default="./data/valid.jsonl")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./artifacts/safecity-distilroberta",
    )
    parser.add_argument("--model-name", type=str, default="distilroberta-base")
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        help="Freeze transformer backbone and train only classification head.",
    )
    parser.add_argument(
        "--use-pos-weight",
        action="store_true",
        help="Use class-balanced pos_weight in BCEWithLogitsLoss.",
    )
    parser.add_argument(
        "--max-pos-weight",
        type=float,
        default=10.0,
        help="Clamp computed class pos_weight to this max value.",
    )
    parser.add_argument(
        "--hf-home",
        type=str,
        default="./.hf_cache",
        help="Local HuggingFace cache directory used by subprocesses.",
    )
    return parser.parse_args()


def run_download(env: dict[str, str]) -> None:
    print("Preparing SafeCity JSONL files...")
    cmd = [sys.executable, "download_safecity_dataset.py"]
    subprocess.run(cmd, check=True, env=env)


def run_training(args: argparse.Namespace, env: dict[str, str]) -> None:
    print("Starting model training...")
    cmd = [
        sys.executable,
        "train.py",
        "--train-file",
        args.train_file,
        "--valid-file",
        args.valid_file,
        "--output-dir",
        args.output_dir,
        "--model-name",
        args.model_name,
        "--max-length",
        str(args.max_length),
        "--batch-size",
        str(args.batch_size),
        "--epochs",
        str(args.epochs),
        "--learning-rate",
        str(args.learning_rate),
        "--weight-decay",
        str(args.weight_decay),
        "--seed",
        str(args.seed),
        "--labels",
        "Commenting",
        "Ogling",
        "Groping",
    ]
    if args.freeze_backbone:
        cmd.append("--freeze-backbone")
    if args.use_pos_weight:
        cmd.extend(["--use-pos-weight", "--max-pos-weight", str(args.max_pos_weight)])
    subprocess.run(cmd, check=True, env=env)


def ensure_required_files(train_file: str, valid_file: str) -> None:
    train_path = Path(train_file)
    valid_path = Path(valid_file)
    if not train_path.exists():
        raise FileNotFoundError(f"Missing train file: {train_path}")
    if not valid_path.exists():
        raise FileNotFoundError(f"Missing valid file: {valid_path}")


def main() -> None:
    args = parse_args()
    env = dict(os.environ)
    env["HF_HOME"] = args.hf_home

    if not args.skip_download:
        run_download(env)

    ensure_required_files(args.train_file, args.valid_file)
    run_training(args, env)
    print(f"Done. Trained model artifacts are in: {args.output_dir}")


if __name__ == "__main__":
    main()
