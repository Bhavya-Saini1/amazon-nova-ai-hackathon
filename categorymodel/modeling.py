"""Model, custom Trainer, and metrics for multi-label text classification."""

from __future__ import annotations

from typing import Dict, Sequence

import numpy as np
import torch
from torch import nn
from sklearn.metrics import f1_score, precision_recall_fscore_support
from transformers import (
    AutoConfig,
    AutoModelForSequenceClassification,
    Trainer,
)


def build_model(model_name: str, labels: Sequence[str]):
    """Create a sequence classification model that outputs raw logits."""
    label2id = {label: idx for idx, label in enumerate(labels)}
    id2label = {idx: label for label, idx in label2id.items()}
    config = AutoConfig.from_pretrained(
        model_name,
        num_labels=len(labels),
        label2id=label2id,
        id2label=id2label,
        problem_type="multi_label_classification",
    )
    return AutoModelForSequenceClassification.from_pretrained(model_name, config=config)


class MultiLabelTrainer(Trainer):
    """HuggingFace Trainer with explicit BCEWithLogitsLoss."""

    def __init__(self, *args, pos_weight: torch.Tensor | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.pos_weight = pos_weight

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        loss_fn = nn.BCEWithLogitsLoss(
            pos_weight=self.pos_weight.to(logits.device)
            if self.pos_weight is not None
            else None
        )
        loss = loss_fn(logits, labels)
        return (loss, outputs) if return_outputs else loss


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def build_compute_metrics(threshold: float = 0.5):
    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        probs = sigmoid(logits)
        preds = (probs >= threshold).astype(int)
        labels_int = labels.astype(int)

        micro_f1 = f1_score(labels_int, preds, average="micro", zero_division=0)
        macro_f1 = f1_score(labels_int, preds, average="macro", zero_division=0)
        precision, recall, _, _ = precision_recall_fscore_support(
            labels_int,
            preds,
            average="micro",
            zero_division=0,
        )
        return {
            "micro_f1": micro_f1,
            "macro_f1": macro_f1,
            "precision_micro": precision,
            "recall_micro": recall,
        }

    return compute_metrics
