"""Dataset and data-loading utilities for multi-label text classification."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

import torch
from torch.utils.data import Dataset
from transformers import PreTrainedTokenizerBase


@dataclass
class IncidentRecord:
    text: str
    labels: List[str]


def load_jsonl_records(path: str | Path) -> List[IncidentRecord]:
    """Load incident data from JSONL with `text` and `labels` fields."""
    records: List[IncidentRecord] = []
    with Path(path).open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            records.append(
                IncidentRecord(text=obj["text"], labels=list(obj.get("labels", [])))
            )
    return records


def build_label_mappings(labels: Sequence[str]) -> Dict[str, int]:
    return {label: idx for idx, label in enumerate(labels)}


def labels_to_multi_hot(example_labels: Iterable[str], label2id: Dict[str, int]) -> List[float]:
    multi_hot = [0.0] * len(label2id)
    for label in example_labels:
        if label in label2id:
            multi_hot[label2id[label]] = 1.0
    return multi_hot


class MultiLabelIncidentDataset(Dataset):
    """Tokenizes text and returns float multi-hot label tensors."""

    def __init__(
        self,
        records: Sequence[IncidentRecord],
        tokenizer: PreTrainedTokenizerBase,
        label2id: Dict[str, int],
        max_length: int = 256,
    ) -> None:
        self.records = list(records)
        self.tokenizer = tokenizer
        self.label2id = label2id
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        item = self.records[idx]
        encoded = self.tokenizer(
            item.text,
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="pt",
        )
        multi_hot = labels_to_multi_hot(item.labels, self.label2id)
        encoded = {k: v.squeeze(0) for k, v in encoded.items()}
        encoded["labels"] = torch.tensor(multi_hot, dtype=torch.float32)
        return encoded
