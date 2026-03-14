from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
import torch
import torch.nn as nn
import os
from typing import Optional

app = FastAPI()

# Device selection
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load HuggingFace pre-trained model for embeddings
model_name = "distilbert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
embedding_model = AutoModel.from_pretrained(model_name).to(device)
embedding_model.eval()  # Set to inference mode for deterministic results

# Simple regression head (PyTorch)
def scale_severity(sigmoid_output, temperature=0.7):
    """
    Convert sigmoid output [0, 1] to severity scale [1, 10].
    Temperature < 1 sharpens predictions (more extreme).
    Temperature > 1 flattens predictions (more conservative).
    """
    # Clamp input to prevent logit from returning inf
    clamped = max(0.001, min(0.999, float(sigmoid_output)))
    
    # Apply temperature scaling: lower temperature = more extreme predictions
    # Re-apply sigmoid with temperature to sharpen
    logit_val = torch.logit(torch.tensor(clamped))
    sharpened = 1 / (1 + torch.exp(-logit_val / temperature))
    result = float(sharpened * 9 + 1)  # Convert to float
    return result

def boost_score_by_keywords(text, base_score):
    """
    Boost severity score based on high-risk keywords detected in text.
    Accounts for cases where the model may underestimate severity due to phrasing.
    """
    text_upper = text.upper()
    
    # Critical keywords that indicate very high severity
    critical_keywords = ["ASSAULT", "ATTACKED", "VIOLENCE", "VIOLENT", "RAPE", "RAPED", "MURDERED", "HOMICIDAL"]
    
    # High-severity keywords that indicate significant threat
    high_keywords = ["GRABBED", "THREATENED", "THREATENING", "WEAPON", "KNIFE", "GUN", "ABUSE", "ABUSIVE"]
    
    # Check for critical keywords - boost significantly
    for keyword in critical_keywords:
        if keyword in text_upper:
            # Boost by up to 4 points if score is too low
            if base_score < 7:
                return min(10.0, base_score + 3.5)
            return min(10.0, base_score + 1.5)
    
    # Check for high-severity keywords - moderate boost
    for keyword in high_keywords:
        if keyword in text_upper:
            if base_score < 6:
                return min(10.0, base_score + 2.0)
            return min(10.0, base_score + 0.8)
    
    return base_score

class SeverityRegressor(nn.Module):
    def __init__(self, input_dim=768):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, 256)
        self.dropout = nn.Dropout(0.3)
        self.fc2 = nn.Linear(256, 1)
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        x = self.sigmoid(x)  # Output in [0, 1] range
        return x

# Initialize the regression model
regressor = SeverityRegressor().to(device)
regressor.eval()  # Set to inference mode for deterministic results

# Try to load trained weights if they exist
script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, "severity_model.pt")
if os.path.exists(model_path):
    regressor.load_state_dict(torch.load(model_path, map_location=device))
    print(f"Loaded trained model from {model_path}")
else:
    print("Using untrained regressor - train on SafeCity dataset to improve accuracy")

class PostRequest(BaseModel):
    text: str
    post_id: Optional[str] = None

class ScoreResponse(BaseModel):
    post_id: str
    score: float
    confidence: float

@app.post("/score", response_model=ScoreResponse)
async def score_post(request: PostRequest):
    """
    Score a post severity from 1-10 (continuous scale) based on content.
    Uses HuggingFace embeddings + PyTorch regression head.
    """
    try:
        if not request.text or len(request.text.strip()) == 0:
            raise ValueError("Post text cannot be empty")
        
        # Tokenize and embed the text
        inputs = tokenizer(request.text, return_tensors="pt", truncation=True, max_length=512).to(device)
        
        with torch.no_grad():
            outputs = embedding_model(**inputs)
            # Use [CLS] token embedding (pooled representation)
            embeddings = outputs.last_hidden_state[:, 0, :]
        
        # Get severity score from regression model
        with torch.no_grad():
            raw_score = regressor(embeddings).item()
        
        # Scale from [0, 1] to [1, 10] with temperature sharpening
        score = scale_severity(raw_score, temperature=0.4)
        
        # Apply keyword-based boosting for very severe content
        score = boost_score_by_keywords(request.text, score)
        
        return ScoreResponse(
            post_id=request.post_id or "unknown",
            score=round(score, 2),
            confidence=0.0  # Can be computed from training loss/uncertainty if needed
        )
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
