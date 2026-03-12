"""Training entrypoint for multi-label incident category classification."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List

from transformers import AutoTokenizer, TrainingArguments, set_seed

from data import MultiLabelIncidentDataset, build_label_mappings, load_jsonl_records
from labels import DEFAULT_CATEGORIES
from modeling import MultiLabelTrainer, build_compute_metrics, build_model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train multi-label safety classifier")
    parser.add_argument("--train-file", type=str, required=True, help="Path to train JSONL")
    parser.add_argument("--valid-file", type=str, required=True, help="Path to validation JSONL")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./artifacts/distilroberta-safety",
        help="Directory to save model artifacts",
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="distilroberta-base",
        help="HuggingFace model checkpoint",
    )
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--labels",
        nargs="*",
        default=None,
        help="Optional explicit label list; defaults to built-in categories",
    )
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        help="Freeze transformer backbone and train only classification head.",
    )
    return parser.parse_args()


def freeze_backbone_parameters(model) -> int:
    """Freeze all parameters except classification head for stability."""
    frozen = 0
    for name, param in model.named_parameters():
        if not name.startswith("classifier"):
            param.requires_grad = False
            frozen += 1
    return frozen


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    labels: List[str] = args.labels if args.labels else DEFAULT_CATEGORIES
    label2id = build_label_mappings(labels)

    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    model = build_model(args.model_name, labels)
    if args.freeze_backbone:
        frozen_count = freeze_backbone_parameters(model)
        print(f"Frozen backbone parameters: {frozen_count}")

    train_records = load_jsonl_records(args.train_file)
    valid_records = load_jsonl_records(args.valid_file)

    train_dataset = MultiLabelIncidentDataset(
        records=train_records,
        tokenizer=tokenizer,
        label2id=label2id,
        max_length=args.max_length,
    )
    valid_dataset = MultiLabelIncidentDataset(
        records=valid_records,
        tokenizer=tokenizer,
        label2id=label2id,
        max_length=args.max_length,
    )

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=args.weight_decay,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="micro_f1",
        greater_is_better=True,
        report_to="none",
    )

    trainer = MultiLabelTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=valid_dataset,
        compute_metrics=build_compute_metrics(threshold=0.5),
    )

    trainer.train()
    trainer.evaluate()
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "labels.json").open("w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=True, indent=2)

    print(f"Saved model and tokenizer to: {args.output_dir}")


if __name__ == "__main__":
    main()
