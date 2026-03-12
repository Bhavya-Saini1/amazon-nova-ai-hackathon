"""Configuration objects for training and serving."""

from dataclasses import dataclass
import os


@dataclass
class ServingConfig:
    model_dir: str = os.getenv("MODEL_DIR", "./artifacts/distilroberta-safety")
    pred_threshold: float = float(os.getenv("PRED_THRESHOLD", "0.5"))
    top_k_fallback: int = int(os.getenv("TOP_K_FALLBACK", "3"))
    max_length: int = int(os.getenv("MAX_LENGTH", "256"))
