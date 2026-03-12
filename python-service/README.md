# Post Severity Scoring Service

Continuous 1-10 severity regression using HuggingFace + PyTorch.

## Setup

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Service runs on `http://localhost:5000`

## How It Works

### Architecture
- **Embeddings**: DistilBERT (HuggingFace) → 768-dim vectors
- **Regression Head**: PyTorch linear layers → continuous 1-10 score
- **Initial State**: Untrained (random weights) - needs SafeCity training data

### API Endpoint

**POST** `/score`
```json
{
  "text": "post content here",
  "post_id": "optional_id"
}
```

Response:
```json
{
  "post_id": "optional_id",
  "score": 5.42,
  "confidence": 0.0
}
```

## Training on SafeCity Dataset

### 1. Prepare Dataset
Create `data.json` in `python-service/` with format:
```json
[
  {"text": "post 1 content", "severity": 2.5},
  {"text": "post 2 content", "severity": 7.8},
  ...
]
```

### 2. Train Model
```powershell
python train.py
```

This will:
- Load SafeCity posts + your severity labels
- Generate embeddings using DistilBERT
- Train regression head (10 epochs default)
- Save trained weights to `severity_model.pt`

### 3. Use Trained Model
Restart `main.py` - it automatically loads `severity_model.pt` if it exists.

## Customization

**Change HuggingFace Model**: Edit `model_name` in `main.py` and `train.py`
- Smaller: `"distilbert-base-uncased"` (current)
- Larger: `"bert-base-uncased"`, `"roberta-base"`

**Adjust Regression Head**: Edit `SeverityRegressor` class in `main.py`
- Add/remove layers
- Change dropout rate
- Modify activation functions

## Notes
- Untrained model will output random 1-10 scores
- First run downloads ~256MB of HuggingFace models
- GPU recommended for training (CPU works but slower)
