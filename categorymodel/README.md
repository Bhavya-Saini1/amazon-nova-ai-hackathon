# Multi-label Safety Category Model

This module contains a complete PyTorch + HuggingFace Transformers pipeline for
multi-label text classification of harassment and safety incident reports, plus
a FastAPI service for inference.

## What it includes

- Lightweight Transformer fine-tuning (`distilroberta-base` by default)
- Multi-label classification head with raw logits output
- Explicit `BCEWithLogitsLoss` in a custom HuggingFace `Trainer`
- Custom PyTorch `Dataset` that tokenizes text and returns float multi-hot labels
- FastAPI app with one `POST /predict` endpoint

## Project structure

```text
categorymodel/
  api.py
  config.py
  data.py
  download_safecity_dataset.py
  inference.py
  labels.py
  modeling.py
  prepare_and_train.py
  train.py
  requirements.txt
```

## Data format

Training data should be JSONL with one example per line:

```json
{"text": "A user repeatedly sent threats in DMs.", "labels": ["threat", "harassment"]}
{"text": "Someone posted private home address publicly.", "labels": ["doxxing", "privacy_violation"]}
```

- `text`: raw incident report text
- `labels`: list of category names (multi-label allowed)

## Install

```bash
cd categorymodel
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Train

```bash
python train.py \
  --train-file ./data/train.jsonl \
  --valid-file ./data/valid.jsonl \
  --output-dir ./artifacts/distilroberta-safety \
  --model-name distilroberta-base \
  --epochs 3 \
  --batch-size 16
```

Optional custom labels:

```bash
python train.py \
  --train-file ./data/train.jsonl \
  --valid-file ./data/valid.jsonl \
  --labels spam threat harassment doxxing impersonation hate_speech self_harm
```

## One-command SafeCity prepare + train

This command downloads SafeCity CSVs from GitHub, converts them to JSONL, and starts training:

```bash
python prepare_and_train.py
```

Useful options:

```bash
python prepare_and_train.py \
  --epochs 1 \
  --batch-size 8 \
  --model-name distilroberta-base \
  --output-dir ./artifacts/safecity-distilroberta
```

If `data/train.jsonl` and `data/valid.jsonl` are already present:

```bash
python prepare_and_train.py --skip-download
```

For CPU/macOS environments where full fine-tuning is unstable, use head-only training:

```bash
python prepare_and_train.py --freeze-backbone
```

To improve recall on rarer labels (for example `Ogling`), enable class weighting:

```bash
python prepare_and_train.py --freeze-backbone --use-pos-weight
```

## Serve API

```bash
uvicorn api:app --host 0.0.0.0 --port 8000
```

The API uses these environment variables:

- `MODEL_DIR` (default: `./artifacts/safecity-distilroberta-stable-full-weighted`)
- `PRED_THRESHOLD` (default: `0.5`)
- `TOP_K_FALLBACK` (default: `3`) returns top classes if none pass threshold

## Inference API

`POST /predict`

Request:

```json
{"text": "They threatened to share my private photos online."}
```

Response:

```json
{
  "predictions": [
    {"category": "threat", "score": 0.91},
    {"category": "privacy_violation", "score": 0.83}
  ]
}
```
