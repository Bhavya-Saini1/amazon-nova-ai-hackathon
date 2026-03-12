"""Inference utilities for multi-label category prediction."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from config import ServingConfig


class MultiLabelPredictor:
    def __init__(self, cfg: ServingConfig):
        self.cfg = cfg
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.tokenizer = AutoTokenizer.from_pretrained(cfg.model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(cfg.model_dir)
        self.model.to(self.device)
        self.model.eval()

        labels_path = Path(cfg.model_dir) / "labels.json"
        if labels_path.exists():
            with labels_path.open("r", encoding="utf-8") as f:
                self.labels = json.load(f)
        else:
            id2label = self.model.config.id2label
            self.labels = [id2label[str(i)] if str(i) in id2label else id2label[i] for i in range(self.model.config.num_labels)]

    @staticmethod
    def _sigmoid(logits: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(logits)

    def predict(self, text: str) -> List[Dict[str, float]]:
        encoded = self.tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=self.cfg.max_length,
            return_tensors="pt",
        )
        encoded = {k: v.to(self.device) for k, v in encoded.items()}

        with torch.no_grad():
            outputs = self.model(**encoded)
            logits = outputs.logits.squeeze(0)
            probs = self._sigmoid(logits).cpu().tolist()

        scored = [
            {"category": category, "score": float(score)}
            for category, score in zip(self.labels, probs)
        ]
        above_threshold = [row for row in scored if row["score"] >= self.cfg.pred_threshold]

        if above_threshold:
            return sorted(above_threshold, key=lambda x: x["score"], reverse=True)
        return sorted(scored, key=lambda x: x["score"], reverse=True)[: self.cfg.top_k_fallback]
