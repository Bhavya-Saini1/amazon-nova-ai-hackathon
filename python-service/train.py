"""
Training script for severity regression model using SafeCity dataset.
This script trains the PyTorch regression head on severity-labeled posts.
"""

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, TensorDataset
from transformers import AutoTokenizer, AutoModel
import json
from pathlib import Path
import sys
from main import SeverityRegressor

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class SeverityDataset(Dataset):
    """Custom dataset for severity-labeled posts."""
    
    def __init__(self, embeddings, severities):
        """
        Args:
            embeddings: Pre-computed embeddings tensor
            severities: Severity labels tensor
        """
        self.embeddings = embeddings
        self.severities = severities
    
    def __len__(self):
        return len(self.embeddings)
    
    def __getitem__(self, idx):
        return self.embeddings[idx], self.severities[idx]


def train(data_file, epochs=10, batch_size=32, learning_rate=1e-3, max_samples=None):
    """Train the severity regression model."""
    
    # Get the directory where this script is located
    script_dir = Path(__file__).parent.absolute()
    
    print("Loading data...")
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    embedding_model = AutoModel.from_pretrained("distilbert-base-uncased").to(device)
    embedding_model.eval()
    
    # Load data
    with open(data_file, 'r') as f:
        data = json.load(f)
    
    # Limit samples if requested (for faster testing)
    if max_samples and len(data) > max_samples:
        data = data[:max_samples]
    
    print(f"✓ Loaded {len(data)} posts")
    
    # Pre-compute all embeddings
    print("Computing embeddings (this may take a moment)...")
    all_embeddings = []
    all_severities = []
    
    for i, item in enumerate(data):
        text = item["text"]
        severity = item["severity"]
        
        # Tokenize
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        # Move to same device as model
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Get embedding
        with torch.no_grad():
            outputs = embedding_model(**inputs)
            embedding = outputs.last_hidden_state[:, 0, :].squeeze()  # [CLS] token
        
        all_embeddings.append(embedding.cpu())
        all_severities.append(severity / 10.0)  # Normalize to 0-1
        
        if (i + 1) % max(1, len(data) // 5) == 0:
            print(f"  {i+1}/{len(data)} embeddings computed")
    
    # Convert to tensors
    embeddings_tensor = torch.stack(all_embeddings).to(device)
    severities_tensor = torch.tensor(all_severities, dtype=torch.float32).to(device)
    print(f"✓ Embeddings shape: {embeddings_tensor.shape}")
    
    # Create dataset
    dataset = SeverityDataset(embeddings_tensor, severities_tensor)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # Initialize model
    print("\nStarting training...")
    model = SeverityRegressor().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    criterion = nn.MSELoss()
    
    # Training loop
    for epoch in range(epochs):
        total_loss = 0
        batch_count = 0
        for embeddings, severity in dataloader:
            embeddings = embeddings.to(device)
            severity = severity.to(device)
            
            # Forward pass
            outputs = model(embeddings)
            loss = criterion(outputs.squeeze(), severity)
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            batch_count += 1
        
        avg_loss = total_loss / batch_count if batch_count > 0 else 0
        print(f"Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f}")
    
    # Save model to the script's directory
    model_path = script_dir / "severity_model.pt"
    torch.save(model.state_dict(), model_path)
    print(f"\n✓ Model saved to {model_path}")


if __name__ == "__main__":
    # Usage: python train.py [data_file] [num_training_samples]
    # num_training_samples: optional max number of posts to train on (default: all)
    
    import sys
    data_file = sys.argv[1] if len(sys.argv) > 1 else "data.json"
    max_samples = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not Path(data_file).exists():
        print(f"Error: {data_file} not found!")
        print("\nTo use this training script, create a JSON file with this format:")
        print('[')
        print('  {"text": "post 1 content", "severity": 2.5},')
        print('  {"text": "post 2 content", "severity": 7.8},')
        print('  ...')
        print(']')
        print(f"\nSave it as {data_file} and run: python train.py {data_file}")
        print(f"Optionally limit training samples: python train.py {data_file} 100")
        sys.exit(1)
    
    train(data_file, epochs=10, batch_size=32, max_samples=max_samples)
