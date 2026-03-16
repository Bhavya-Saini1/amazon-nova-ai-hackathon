"""
Simple test script to verify the severity model is working.
Run: python test_model.py
"""

import torch
from transformers import AutoTokenizer, AutoModel
from main import SeverityRegressor, scale_severity, boost_score_by_keywords
import os

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

# Load the models
tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
embedding_model = AutoModel.from_pretrained("distilbert-base-uncased").to(device)
embedding_model.eval()  # Set to inference mode (disable dropout)
regressor = SeverityRegressor().to(device)
regressor.eval()  # Set to inference mode (disable dropout)

# Try to load trained weights
script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, "severity_model.pt")
if os.path.exists(model_path):
    print(f"\nLoading {model_path}...")
    state = torch.load(model_path, map_location=device)
    print(f"State keys: {list(state.keys())}")
    regressor.load_state_dict(state)
    print("✓ Loaded trained model weights\n")
else:
    print(f"⚠ {model_path} NOT FOUND! Using untrained model\n")

# Test posts
test_posts = [
    ("Just had lunch with friends today", "benign"),
    ("Looking forward to the weekend", "neutral"),
    ("Someone followed me home from work and I felt very unsafe", "concerning"),
    ("A man made unwanted advances towards me on the street", "harassment"),
    ("I was physically grabbed and assaulted", "high-severity"),
    ("Rape reported in the park last night, stay safe everyone", "high-severity"),
    ("I JUST WITNESSED AN ASSAULT IN BROAD DAYLIGHT", "high-severity"),
]

print("=" * 60)
print("POST SEVERITY SCORING TEST")
print("=" * 60)

for i, (post_text, category) in enumerate(test_posts, 1):
    # Tokenize and embed
    inputs = tokenizer(post_text, return_tensors="pt", truncation=True, max_length=512).to(device)
    
    with torch.no_grad():
        outputs = embedding_model(**inputs)
        embeddings = outputs.last_hidden_state[:, 0, :]
        raw_score = regressor(embeddings).item()
    
    # Scale from [0, 1] to [1, 10] with temperature sharpening
    score = scale_severity(raw_score, temperature=0.4)
    
    # Apply keyword-based boosting
    score = boost_score_by_keywords(post_text, score)
    
    print(f"\n[Post {i}] ({category})")
    print(f"Text: {post_text}")
    print(f"Raw Score (sigmoid): {raw_score:.4f}")
    print(f"Severity Score: {score:.2f}/10")

print("\n" + "=" * 60)
