"""Download and convert SafeCity multilabel CSV files to JSONL.

Output format per line:
{"text": "raw incident description text", "labels": ["Commenting", "Groping"]}
"""

from __future__ import annotations

import json
from io import BytesIO, StringIO
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import pandas as pd
import requests


BASE_URL = (
    "https://raw.githubusercontent.com/swkarlekar/safecity/master/"
    "multilabel_classification"
)

SPLIT_URLS: Dict[str, List[str]] = {
    "train": [f"{BASE_URL}/train.csv", f"{BASE_URL}/train.csv.zip"],
    "valid": [f"{BASE_URL}/dev.csv", f"{BASE_URL}/dev.csv.zip"],
}

LABEL_NAMES = ["Commenting", "Ogling", "Groping"]


def read_remote_csv(url: str) -> pd.DataFrame:
    """Read a CSV file from URL with basic validation."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        if url.endswith(".zip"):
            frame = pd.read_csv(BytesIO(response.content), header=None, compression="zip")
        else:
            frame = pd.read_csv(StringIO(response.text), header=None)
    except Exception as exc:  # pragma: no cover - network/IO dependent
        raise RuntimeError(f"Failed to download or parse CSV from {url}: {exc}") from exc

    if frame.shape[1] < 4:
        raise ValueError(
            f"Expected at least 4 columns in CSV from {url}, got {frame.shape[1]}"
        )
    return frame.iloc[:, :4].copy()


def row_to_record(row: pd.Series, labels: Iterable[str]) -> Dict[str, object]:
    """Convert one CSV row into the target JSON object."""
    text = str(row.iloc[0]).strip()
    active_labels: List[str] = []

    for idx, label_name in enumerate(labels, start=1):
        raw_value = row.iloc[idx]
        value = 0
        if pd.notna(raw_value):
            text_value = str(raw_value).strip().lower()
            if text_value in {"1", "1.0", "true"}:
                value = 1
            elif text_value in {"0", "0.0", "false", ""}:
                value = 0
            else:
                # Handle unexpected non-binary values gracefully.
                try:
                    value = int(float(text_value))
                except ValueError:
                    value = 0
        if value == 1:
            active_labels.append(label_name)

    return {"text": text, "labels": active_labels}


def ensure_output_dir(path: Path) -> None:
    """Create output directory with explicit error handling."""
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise RuntimeError(f"Could not create output directory '{path}': {exc}") from exc

    if not path.exists() or not path.is_dir():
        raise RuntimeError(f"Output path '{path}' is not a valid directory.")


def convert_split(urls: List[str], output_file: Path) -> Tuple[int, Path]:
    """Download one split and write JSONL file."""
    frame = None
    errors: List[str] = []
    for url in urls:
        try:
            frame = read_remote_csv(url)
            break
        except Exception as exc:
            errors.append(str(exc))

    if frame is None:
        raise RuntimeError(
            "All source URLs failed:\n" + "\n".join(f"- {err}" for err in errors)
        )

    # Drop header row when CSV is read without headers.
    first_row = [str(frame.iloc[0, i]).strip().lower() for i in range(min(4, frame.shape[1]))]
    if len(first_row) >= 4 and first_row[1:] == [name.lower() for name in LABEL_NAMES]:
        frame = frame.iloc[1:].reset_index(drop=True)

    records = [row_to_record(row, LABEL_NAMES) for _, row in frame.iterrows()]
    if records:
        first_text = str(records[0]["text"]).strip().lower()
        if first_text in {"description", "text"} and not records[0]["labels"]:
            records = records[1:]

    with output_file.open("w", encoding="utf-8") as f:
        for record in records:
            line = json.dumps(record, ensure_ascii=False)
            f.write(line + "\n")

    return len(records), output_file


def main() -> None:
    output_dir = Path("data")
    ensure_output_dir(output_dir)

    outputs = {
        "train": output_dir / "train.jsonl",
        "valid": output_dir / "valid.jsonl",
    }

    for split_name, urls in SPLIT_URLS.items():
        count, output_path = convert_split(urls, outputs[split_name])
        print(f"Wrote {count} records to {output_path}")


if __name__ == "__main__":
    main()
